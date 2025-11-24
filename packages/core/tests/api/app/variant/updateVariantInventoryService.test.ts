import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDatabase, closeTestDatabase } from '../../helpers/database'
import { TransactionBatcher } from '../../../../src/api/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../../src/api/infrastructure/unitOfWork'
import { UpdateVariantInventoryService } from '../../../../src/api/app/variant/updateVariantInventoryService'
import { VariantAggregate } from '../../../../src/api/domain/variant/aggregate'
import { ProductAggregate } from '../../../../src/api/domain/product/aggregate'
import type { UpdateVariantInventoryCommand } from '../../../../src/api/app/variant/commands'

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

function createValidCommand(): UpdateVariantInventoryCommand {
  return {
    type: 'updateVariantInventory',
    id: 'variant-123',
    userId: 'user-123',
    inventory: 75,
    expectedVersion: 0,
  }
}

async function createVariantInDatabase(
  unitOfWork: UnitOfWork,
  variantId: string,
  productId: string,
  inventory: number
) {
  await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
    const variantAggregate = VariantAggregate.create({
      id: variantId,
      correlationId: 'test-correlation',
      userId: 'user-123',
      productId,
      sku: 'TEST-SKU',
      price: 1999,
      inventory,
      options: { Size: 'M' },
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
  fulfillmentType: 'dropship' | 'digital'
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
      fulfillmentType,
      vendor: 'Test Vendor',
      variantOptions: [],
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

describe('UpdateVariantInventoryService', () => {
  test('should successfully update variant inventory', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      const productId = 'product-123'

      await createProductInDatabase(unitOfWork, productId, 'dropship')
      await createVariantInDatabase(unitOfWork, command.id, productId, 50)

      const service = new UpdateVariantInventoryService(unitOfWork)

      // Act
      await service.execute(command)

      // Assert
      const variantSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregate_id = ?
      `).get(command.id) as any

      expect(variantSnapshot).not.toBeNull()
      expect(variantSnapshot.version).toBe(1)

      const variantPayload = JSON.parse(variantSnapshot.payload)
      expect(variantPayload.inventory).toBe(command.inventory)

      // Verify event was saved
      const events = db.query(`
        SELECT * FROM events
        WHERE aggregate_id = ? AND version = 1
      `).all(command.id) as any[]

      expect(events.length).toBeGreaterThan(0)
      expect(events[0].event_type).toBe('variant.inventory_updated')

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

  test('should update inventory to zero', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      command.inventory = 0
      const productId = 'product-123'

      await createProductInDatabase(unitOfWork, productId, 'dropship')
      await createVariantInDatabase(unitOfWork, command.id, productId, 50)

      const service = new UpdateVariantInventoryService(unitOfWork)

      // Act
      await service.execute(command)

      // Assert
      const variantSnapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregate_id = ?
      `).get(command.id) as any

      const variantPayload = JSON.parse(variantSnapshot.payload)
      expect(variantPayload.inventory).toBe(0)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should update inventory to -1 for digital products', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      command.inventory = -1
      const productId = 'product-123'

      await createProductInDatabase(unitOfWork, productId, 'digital')
      await createVariantInDatabase(unitOfWork, command.id, productId, -1)

      const service = new UpdateVariantInventoryService(unitOfWork)

      // Act
      await service.execute(command)

      // Assert
      const variantSnapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregate_id = ?
      `).get(command.id) as any

      const variantPayload = JSON.parse(variantSnapshot.payload)
      expect(variantPayload.inventory).toBe(-1)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when trying to set tracked inventory for digital product', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      command.inventory = 100
      const productId = 'product-123'

      await createProductInDatabase(unitOfWork, productId, 'digital')
      await createVariantInDatabase(unitOfWork, command.id, productId, -1)

      const service = new UpdateVariantInventoryService(unitOfWork)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow('Digital products cannot have tracked inventory')
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
      const service = new UpdateVariantInventoryService(unitOfWork)

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
      command.expectedVersion = 5
      const productId = 'product-123'

      await createProductInDatabase(unitOfWork, productId, 'dropship')
      await createVariantInDatabase(unitOfWork, command.id, productId, 50)

      const service = new UpdateVariantInventoryService(unitOfWork)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow(
        'Optimistic concurrency conflict: expected version 5 but found version 0'
      )
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

      await createProductInDatabase(unitOfWork, productId, 'dropship')
      await createVariantInDatabase(unitOfWork, command.id, productId, 50)

      const service = new UpdateVariantInventoryService(unitOfWork)

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

      await createProductInDatabase(unitOfWork, productId, 'dropship')

      await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
        const variantAggregate = VariantAggregate.create({
          id: command.id,
          correlationId: originalCorrelationId,
          userId: 'user-123',
          productId,
          sku: 'TEST-SKU',
          price: 1999,
          inventory: 50,
          options: { Size: 'M' },
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

      const service = new UpdateVariantInventoryService(unitOfWork)

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
      const service = new UpdateVariantInventoryService(unitOfWork)

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
      command.inventory = 100
      const productId = 'product-123'

      await createProductInDatabase(unitOfWork, productId, 'digital')
      await createVariantInDatabase(unitOfWork, command.id, productId, -1)

      const service = new UpdateVariantInventoryService(unitOfWork)

      // Get initial state
      const initialSnapshot = db.query(`
        SELECT payload, version FROM snapshots
        WHERE aggregate_id = ?
      `).get(command.id) as any

      const initialPayload = JSON.parse(initialSnapshot.payload)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow()

      // Verify state wasn't modified
      const finalSnapshot = db.query(`
        SELECT payload, version FROM snapshots
        WHERE aggregate_id = ?
      `).get(command.id) as any

      const finalPayload = JSON.parse(finalSnapshot.payload)

      expect(finalSnapshot.version).toBe(initialSnapshot.version)
      expect(finalPayload.inventory).toBe(initialPayload.inventory)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should handle large inventory values', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      command.inventory = 999999
      const productId = 'product-123'

      await createProductInDatabase(unitOfWork, productId, 'dropship')
      await createVariantInDatabase(unitOfWork, command.id, productId, 50)

      const service = new UpdateVariantInventoryService(unitOfWork)

      // Act
      await service.execute(command)

      // Assert
      const variantSnapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregate_id = ?
      `).get(command.id) as any

      const variantPayload = JSON.parse(variantSnapshot.payload)
      expect(variantPayload.inventory).toBe(999999)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
