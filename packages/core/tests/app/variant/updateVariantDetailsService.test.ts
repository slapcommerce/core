import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDatabase, closeTestDatabase } from '../../helpers/database'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { UpdateVariantDetailsService } from '../../../src/app/variant/updateVariantDetailsService'
import { VariantAggregate } from '../../../src/domain/variant/aggregate'
import { ProductAggregate } from '../../../src/domain/product/aggregate'
import type { UpdateVariantDetailsCommand } from '../../../src/app/variant/commands'

async function setupTestEnvironment() {
  const db = createTestDatabase()
  const batcher = new TransactionBatcher(db, {
    flushIntervalMs: 50,
    batchSizeThreshold: 10,
    maxQueueDepth: 100
  })
  batcher.start()
  const unitOfWork = new UnitOfWork(db, batcher)
  return { db, batcher, unitOfWork }
}

function createValidCommand(): UpdateVariantDetailsCommand {
  return {
    type: 'updateVariantDetails',
    id: 'variant-123',
    userId: 'user-123',
    options: { Size: 'L', Color: 'Red' },
    expectedVersion: 0,
  }
}

async function createVariantInDatabase(
  unitOfWork: UnitOfWork,
  variantId: string,
  productId: string,
  options: Record<string, string>
) {
  await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
    const variantAggregate = VariantAggregate.create({
      id: variantId,
      correlationId: 'test-correlation',
      userId: 'user-123',
      productId,
      sku: 'TEST-SKU',
      price: 1000,
      inventory: 50,
      options,
    })

    snapshotRepository.saveSnapshot({
      aggregate_id: variantAggregate.id,
      correlation_id: 'test-correlation',
      version: variantAggregate.version,
      payload: variantAggregate.toSnapshot(),
    })

    for (const event of variantAggregate.uncommittedEvents) {
      eventRepository.addEvent(event)
      outboxRepository.addOutboxEvent(event, { id: crypto.randomUUID() })
    }
  })
}

async function createProductInDatabase(
  unitOfWork: UnitOfWork,
  productId: string,
  variantOptions: { name: string; values: string[] }[]
) {
  await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
    const productAggregate = ProductAggregate.create({
      id: productId,
      correlationId: 'test-correlation',
      userId: 'user-123',
      title: 'Test Product',
      shortDescription: 'Test description',
      slug: 'test-product',
      collectionIds: ['collection-1'],
      variantIds: [],
      richDescriptionUrl: 'https://example.com',
      productType: 'physical',
      fulfillmentType: 'dropship',
      vendor: 'Test Vendor',
      variantOptions,
      metaTitle: 'Test Product',
      metaDescription: 'Test description',
      tags: [],
      taxable: true,
      taxId: 'TAX123',
      dropshipSafetyBuffer: 0,
    })

    snapshotRepository.saveSnapshot({
      aggregate_id: productAggregate.id,
      correlation_id: 'test-correlation',
      version: productAggregate.version,
      payload: productAggregate.toSnapshot(),
    })

    for (const event of productAggregate.uncommittedEvents) {
      eventRepository.addEvent(event)
      outboxRepository.addOutboxEvent(event, { id: crypto.randomUUID() })
    }
  })
}

describe('UpdateVariantDetailsService', () => {
  test('should successfully update variant options', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      const productId = 'product-123'

      await createProductInDatabase(unitOfWork, productId, [
        { name: 'Size', values: ['S', 'M', 'L', 'XL'] },
        { name: 'Color', values: ['Red', 'Blue', 'Green'] },
      ])

      await createVariantInDatabase(unitOfWork, command.id, productId, {
        Size: 'M',
        Color: 'Blue',
      })

      const service = new UpdateVariantDetailsService(unitOfWork)

      // Act
      await service.execute(command)

      // Assert
      const variantSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregate_id = ?
      `).get(command.id) as any

      expect(variantSnapshot).not.toBeNull()
      expect(variantSnapshot.version).toBe(1) // Version incremented

      const variantPayload = JSON.parse(variantSnapshot.payload)
      expect(variantPayload.options).toEqual(command.options)

      // Verify event was saved
      const events = db.query(`
        SELECT * FROM events
        WHERE aggregate_id = ? AND version = 1
      `).all(command.id) as any[]

      expect(events.length).toBeGreaterThan(0)
      expect(events[0].event_type).toBe('variant.details_updated')

      // Verify event added to outbox
      const outboxCount = db.query(`
        SELECT COUNT(*) as count FROM outbox
        WHERE aggregate_id = ?
      `).get(command.id) as any

      expect(outboxCount.count).toBeGreaterThan(0)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when variant does not exist', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      const service = new UpdateVariantDetailsService(unitOfWork)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow(`Variant with id ${command.id} not found`)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error on optimistic concurrency conflict', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      command.expectedVersion = 5 // Wrong version
      const productId = 'product-123'

      await createProductInDatabase(unitOfWork, productId, [
        { name: 'Size', values: ['S', 'M', 'L', 'XL'] },
        { name: 'Color', values: ['Red', 'Blue', 'Green'] },
      ])

      await createVariantInDatabase(unitOfWork, command.id, productId, {
        Size: 'M',
        Color: 'Blue',
      })

      const service = new UpdateVariantDetailsService(unitOfWork)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow(
        'Optimistic concurrency conflict: expected version 5 but found version 0'
      )
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when product does not exist', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      const productId = 'product-123'

      await createVariantInDatabase(unitOfWork, command.id, productId, {
        Size: 'M',
        Color: 'Blue',
      })

      const service = new UpdateVariantDetailsService(unitOfWork)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow('Product not found for variant')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when option is not valid for product', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      command.options = { Size: 'L', InvalidOption: 'Value' }
      const productId = 'product-123'

      await createProductInDatabase(unitOfWork, productId, [
        { name: 'Size', values: ['S', 'M', 'L', 'XL'] },
        { name: 'Color', values: ['Red', 'Blue', 'Green'] },
      ])

      await createVariantInDatabase(unitOfWork, command.id, productId, {
        Size: 'M',
        Color: 'Blue',
      })

      const service = new UpdateVariantDetailsService(unitOfWork)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow('Option "InvalidOption" is not valid for this product')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when missing required option', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      command.options = { Size: 'L' } // Missing Color
      const productId = 'product-123'

      await createProductInDatabase(unitOfWork, productId, [
        { name: 'Size', values: ['S', 'M', 'L', 'XL'] },
        { name: 'Color', values: ['Red', 'Blue', 'Green'] },
      ])

      await createVariantInDatabase(unitOfWork, command.id, productId, {
        Size: 'M',
        Color: 'Blue',
      })

      const service = new UpdateVariantDetailsService(unitOfWork)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow('Missing required option "Color"')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when option value is invalid', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      command.options = { Size: 'L', Color: 'Purple' } // Purple is invalid
      const productId = 'product-123'

      await createProductInDatabase(unitOfWork, productId, [
        { name: 'Size', values: ['S', 'M', 'L', 'XL'] },
        { name: 'Color', values: ['Red', 'Blue', 'Green'] },
      ])

      await createVariantInDatabase(unitOfWork, command.id, productId, {
        Size: 'M',
        Color: 'Blue',
      })

      const service = new UpdateVariantDetailsService(unitOfWork)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow('Value "Purple" is not valid for option "Color"')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should increment version after update', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      const productId = 'product-123'

      await createProductInDatabase(unitOfWork, productId, [
        { name: 'Size', values: ['S', 'M', 'L', 'XL'] },
        { name: 'Color', values: ['Red', 'Blue', 'Green'] },
      ])

      await createVariantInDatabase(unitOfWork, command.id, productId, {
        Size: 'M',
        Color: 'Blue',
      })

      const service = new UpdateVariantDetailsService(unitOfWork)

      // Act
      await service.execute(command)

      // Assert
      const snapshot = db.query(`
        SELECT version FROM snapshots
        WHERE aggregate_id = ?
      `).get(command.id) as any

      expect(snapshot.version).toBe(1)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should preserve correlationId from original snapshot', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      const productId = 'product-123'
      const originalCorrelationId = 'original-correlation-123'

      await createProductInDatabase(unitOfWork, productId, [
        { name: 'Size', values: ['S', 'M', 'L', 'XL'] },
        { name: 'Color', values: ['Red', 'Blue', 'Green'] },
      ])

      // Create variant with specific correlationId
      await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
        const variantAggregate = VariantAggregate.create({
          id: command.id,
          correlationId: originalCorrelationId,
          userId: 'user-123',
          productId,
          sku: 'TEST-SKU',
          price: 1000,
          inventory: 50,
          options: { Size: 'M', Color: 'Blue' },
        })

        snapshotRepository.saveSnapshot({
          aggregate_id: variantAggregate.id,
          correlation_id: originalCorrelationId,
          version: variantAggregate.version,
          payload: variantAggregate.toSnapshot(),
        })

        for (const event of variantAggregate.uncommittedEvents) {
          eventRepository.addEvent(event)
          outboxRepository.addOutboxEvent(event, { id: crypto.randomUUID() })
        }
      })

      const service = new UpdateVariantDetailsService(unitOfWork)

      // Act
      await service.execute(command)

      // Assert
      const snapshot = db.query(`
        SELECT correlation_id FROM snapshots
        WHERE aggregate_id = ? AND version = 1
      `).get(command.id) as any

      expect(snapshot.correlation_id).toBe(originalCorrelationId)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should set correct access level', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new UpdateVariantDetailsService(unitOfWork)

      // Assert
      expect(service.accessLevel).toBe('admin')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should rollback on error and not modify data', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      command.options = { Size: 'L', Color: 'InvalidColor' }
      const productId = 'product-123'

      await createProductInDatabase(unitOfWork, productId, [
        { name: 'Size', values: ['S', 'M', 'L', 'XL'] },
        { name: 'Color', values: ['Red', 'Blue', 'Green'] },
      ])

      await createVariantInDatabase(unitOfWork, command.id, productId, {
        Size: 'M',
        Color: 'Blue',
      })

      const service = new UpdateVariantDetailsService(unitOfWork)

      // Get initial state
      const initialSnapshot = db.query(`
        SELECT payload, version FROM snapshots
        WHERE aggregate_id = ?
      `).get(command.id) as any

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow()

      // Verify state wasn't modified
      const finalSnapshot = db.query(`
        SELECT payload, version FROM snapshots
        WHERE aggregate_id = ?
      `).get(command.id) as any

      expect(finalSnapshot.version).toBe(initialSnapshot.version)
      expect(finalSnapshot.payload).toBe(initialSnapshot.payload)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
