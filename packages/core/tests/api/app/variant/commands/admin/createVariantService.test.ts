import { describe, test, expect } from 'bun:test'
import { createTestDatabase, closeTestDatabase } from '../../../../../helpers/database'
import { TransactionBatcher } from '../../../../../../src/api/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../../../../src/api/infrastructure/unitOfWork'
import { CreateVariantService } from '../../../../../../src/api/app/variant/commands/admin/createVariantService'
import { ProductAggregate } from '../../../../../../src/api/domain/product/aggregate'
import { SkuAggregate } from '../../../../../../src/api/domain/sku/skuAggregate'
import type { CreateVariantCommand } from '../../../../../../src/api/app/variant/commands/admin/commands'

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

function createValidCommand(): CreateVariantCommand {
  return {
    type: 'createVariant',
    id: 'variant-123',
    correlationId: 'correlation-123',
    userId: 'user-123',
    productId: 'product-123',
    sku: 'TEST-SKU-001',
    price: 1999,
    inventory: 100,
    options: { Size: 'M', Color: 'Blue' },
  }
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
      name: 'Test Product',
      description: 'Test description',
      slug: 'test-product',
      collections: [{ collectionId: 'collection-1', position: 0 }],
      variantIds: [],
      richDescriptionUrl: 'https://example.com',
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
      aggregateId: productAggregate.id,
      correlationId: 'test-correlation',
      version: productAggregate.version,
      payload: productAggregate.toSnapshot(),
    })

    for (const event of productAggregate.uncommittedEvents) {
      eventRepository.addEvent(event)
      outboxRepository.addOutboxEvent(event, { id: crypto.randomUUID() })
    }
  })
}

describe('CreateVariantService', () => {
  test('should successfully create a new variant with SKU', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      await createProductInDatabase(unitOfWork, command.productId, [
        { name: 'Size', values: ['S', 'M', 'L'] },
        { name: 'Color', values: ['Red', 'Blue', 'Green'] },
      ])

      const service = new CreateVariantService(unitOfWork)

      // Act
      await service.execute(command)

      // Assert - Verify variant snapshot was created
      const variantSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregateId = ?
      `).get(command.id) as any

      expect(variantSnapshot).not.toBeNull()
      expect(variantSnapshot.version).toBe(0)
      expect(variantSnapshot.correlationId).toBe(command.correlationId)

      const variantPayload = JSON.parse(variantSnapshot.payload)
      expect(variantPayload.productId).toBe(command.productId)
      expect(variantPayload.sku).toBe(command.sku)
      expect(variantPayload.price).toBe(command.price)
      expect(variantPayload.inventory).toBe(command.inventory)
      expect(variantPayload.options).toEqual(command.options)

      // Verify SKU snapshot was created and reserved
      const skuSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregateId = ?
      `).get(command.sku) as any

      expect(skuSnapshot).not.toBeNull()
      const skuPayload = JSON.parse(skuSnapshot.payload)
      expect(skuPayload.variantId).toBe(command.id)
      expect(skuPayload.status).toBe('active')

      // Verify variant events were saved
      const variantEvents = db.query(`
        SELECT * FROM events
        WHERE aggregateId = ?
      `).all(command.id) as any[]

      expect(variantEvents.length).toBeGreaterThan(0)
      expect(variantEvents[0].eventType).toBe('variant.created')

      // Verify SKU events were saved
      const skuEvents = db.query(`
        SELECT * FROM events
        WHERE aggregateId = ?
      `).all(command.sku) as any[]

      expect(skuEvents.length).toBeGreaterThan(0)

      // Verify all events added to outbox
      const variantOutboxCount = db.query(`
        SELECT COUNT(*) as count FROM outbox
        WHERE aggregateId = ?
      `).get(command.id) as any

      const skuOutboxCount = db.query(`
        SELECT COUNT(*) as count FROM outbox
        WHERE aggregateId = ?
      `).get(command.sku) as any

      expect(variantOutboxCount.count).toBeGreaterThan(0)
      expect(skuOutboxCount.count).toBeGreaterThan(0)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should create variant without SKU when SKU is empty string', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      command.sku = ''
      await createProductInDatabase(unitOfWork, command.productId, [
        { name: 'Size', values: ['S', 'M', 'L'] },
        { name: 'Color', values: ['Red', 'Blue', 'Green'] },
      ])

      const service = new CreateVariantService(unitOfWork)

      // Act
      await service.execute(command)

      // Assert - Verify variant snapshot was created
      const variantSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregateId = ?
      `).get(command.id) as any

      expect(variantSnapshot).not.toBeNull()

      // Verify NO SKU snapshot was created
      const skuSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregateId = ?
      `).get(command.sku)

      expect(skuSnapshot).toBeNull()
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when SKU is already in use', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      await createProductInDatabase(unitOfWork, command.productId, [
        { name: 'Size', values: ['S', 'M', 'L'] },
        { name: 'Color', values: ['Red', 'Blue', 'Green'] },
      ])

      // Reserve the SKU for another variant
      await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
        const skuAggregate = SkuAggregate.create({
          sku: command.sku,
          correlationId: 'test-correlation',
        })
        skuAggregate.reserveSku('other-variant-id', 'user-456')

        snapshotRepository.saveSnapshot({
          aggregateId: skuAggregate.id,
          correlationId: 'test-correlation',
          version: skuAggregate.version,
          payload: skuAggregate.toSnapshot(),
        })

        for (const event of skuAggregate.uncommittedEvents) {
          eventRepository.addEvent(event)
          outboxRepository.addOutboxEvent(event, { id: crypto.randomUUID() })
        }
      })

      const service = new CreateVariantService(unitOfWork)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow(`SKU "${command.sku}" is already in use`)

      // Verify no variant snapshot was created
      const variantSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregateId = ?
      `).get(command.id)

      expect(variantSnapshot).toBeNull()
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
      const service = new CreateVariantService(unitOfWork)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow(`Product with id ${command.productId} not found`)

      // Verify no variant snapshot was created
      const variantSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregateId = ?
      `).get(command.id)

      expect(variantSnapshot).toBeNull()
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when variant option is not valid for product', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      command.options = { Size: 'M', InvalidOption: 'Value' }
      await createProductInDatabase(unitOfWork, command.productId, [
        { name: 'Size', values: ['S', 'M', 'L'] },
        { name: 'Color', values: ['Red', 'Blue', 'Green'] },
      ])

      const service = new CreateVariantService(unitOfWork)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow('Option "InvalidOption" is not valid for this product')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when missing required variant option', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      command.options = { Size: 'M' } // Missing Color option
      await createProductInDatabase(unitOfWork, command.productId, [
        { name: 'Size', values: ['S', 'M', 'L'] },
        { name: 'Color', values: ['Red', 'Blue', 'Green'] },
      ])

      const service = new CreateVariantService(unitOfWork)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow('Missing required option "Color"')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when variant option value is invalid', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      command.options = { Size: 'M', Color: 'Purple' } // Purple is not a valid value
      await createProductInDatabase(unitOfWork, command.productId, [
        { name: 'Size', values: ['S', 'M', 'L'] },
        { name: 'Color', values: ['Red', 'Blue', 'Green'] },
      ])

      const service = new CreateVariantService(unitOfWork)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow('Value "Purple" is not valid for option "Color"')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should create variant with initial version 0', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      await createProductInDatabase(unitOfWork, command.productId, [
        { name: 'Size', values: ['S', 'M', 'L'] },
        { name: 'Color', values: ['Red', 'Blue', 'Green'] },
      ])

      const service = new CreateVariantService(unitOfWork)

      // Act
      await service.execute(command)

      // Assert
      const variantSnapshot = db.query(`
        SELECT version FROM snapshots
        WHERE aggregateId = ?
      `).get(command.id) as any

      expect(variantSnapshot.version).toBe(0)

      const skuSnapshot = db.query(`
        SELECT version FROM snapshots
        WHERE aggregateId = ?
      `).get(command.sku) as any

      expect(skuSnapshot.version).toBe(1) // SKU has 2 events: created + reserved
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should use same correlationId for variant and SKU events', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      await createProductInDatabase(unitOfWork, command.productId, [
        { name: 'Size', values: ['S', 'M', 'L'] },
        { name: 'Color', values: ['Red', 'Blue', 'Green'] },
      ])

      const service = new CreateVariantService(unitOfWork)

      // Act
      await service.execute(command)

      // Assert
      const variantEvents = db.query(`
        SELECT correlationId FROM events
        WHERE aggregateId = ?
      `).all(command.id) as any[]

      const skuEvents = db.query(`
        SELECT correlationId FROM events
        WHERE aggregateId = ?
      `).all(command.sku) as any[]

      // All events should have the same correlationId
      for (const event of variantEvents) {
        expect(event.correlationId).toBe(command.correlationId)
      }

      for (const event of skuEvents) {
        expect(event.correlationId).toBe(command.correlationId)
      }
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should create both variant and SKU snapshots', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      await createProductInDatabase(unitOfWork, command.productId, [
        { name: 'Size', values: ['S', 'M', 'L'] },
        { name: 'Color', values: ['Red', 'Blue', 'Green'] },
      ])

      const service = new CreateVariantService(unitOfWork)

      // Act
      await service.execute(command)

      // Assert
      const snapshots = db.query(`
        SELECT aggregateId FROM snapshots
        WHERE correlationId = ?
      `).all(command.correlationId) as any[]

      expect(snapshots.length).toBeGreaterThanOrEqual(2) // At least variant and SKU

      const aggregateIds = snapshots.map(s => s.aggregateId)
      expect(aggregateIds).toContain(command.id)
      expect(aggregateIds).toContain(command.sku)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should add all events to outbox', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      await createProductInDatabase(unitOfWork, command.productId, [
        { name: 'Size', values: ['S', 'M', 'L'] },
        { name: 'Color', values: ['Red', 'Blue', 'Green'] },
      ])

      const service = new CreateVariantService(unitOfWork)

      // Act
      await service.execute(command)

      // Assert
      const variantEvents = db.query(`
        SELECT COUNT(*) as count FROM events
        WHERE aggregateId = ?
      `).get(command.id) as any

      const skuEvents = db.query(`
        SELECT COUNT(*) as count FROM events
        WHERE aggregateId = ?
      `).get(command.sku) as any

      const variantOutboxEvents = db.query(`
        SELECT COUNT(*) as count FROM outbox
        WHERE aggregateId = ?
      `).get(command.id) as any

      const skuOutboxEvents = db.query(`
        SELECT COUNT(*) as count FROM outbox
        WHERE aggregateId = ?
      `).get(command.sku) as any

      // All variant and SKU events should be in outbox
      expect(variantOutboxEvents.count).toBe(variantEvents.count)
      expect(skuOutboxEvents.count).toBe(skuEvents.count)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should create variant with default values when optional fields are omitted', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command: CreateVariantCommand = {
        type: 'createVariant',
        id: 'variant-123',
        correlationId: 'correlation-123',
        userId: 'user-123',
        productId: 'product-123',
        sku: '',
        price: 0,
        inventory: 0,
        options: {},
      }
      await createProductInDatabase(unitOfWork, command.productId, [])

      const service = new CreateVariantService(unitOfWork)

      // Act
      await service.execute(command)

      // Assert
      const snapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregateId = ?
      `).get(command.id) as any

      const payload = JSON.parse(snapshot.payload)
      expect(payload.sku).toBe('')
      expect(payload.price).toBe(0)
      expect(payload.inventory).toBe(0)
      expect(payload.options).toEqual({})
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should rollback on error and not create any data', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      await createProductInDatabase(unitOfWork, command.productId, [
        { name: 'Size', values: ['S', 'M', 'L'] },
        { name: 'Color', values: ['Red', 'Blue', 'Green'] },
      ])

      // Reserve the SKU first
      await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
        const skuAggregate = SkuAggregate.create({
          sku: command.sku,
          correlationId: 'test-correlation',
        })
        skuAggregate.reserveSku('other-variant-id', 'user-456')

        snapshotRepository.saveSnapshot({
          aggregateId: skuAggregate.id,
          correlationId: 'test-correlation',
          version: skuAggregate.version,
          payload: skuAggregate.toSnapshot(),
        })

        for (const event of skuAggregate.uncommittedEvents) {
          eventRepository.addEvent(event)
          outboxRepository.addOutboxEvent(event, { id: crypto.randomUUID() })
        }
      })

      // Get initial counts
      const initialSnapshotCount = db.query(`
        SELECT COUNT(*) as count FROM snapshots
      `).get() as any

      const initialEventCount = db.query(`
        SELECT COUNT(*) as count FROM events
      `).get() as any

      const service = new CreateVariantService(unitOfWork)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow()

      // Verify no new variant data was created
      const variantSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregateId = ?
      `).get(command.id)

      expect(variantSnapshot).toBeNull()

      // Verify total counts didn't increase (transaction rolled back)
      const finalSnapshotCount = db.query(`
        SELECT COUNT(*) as count FROM snapshots
      `).get() as any

      const finalEventCount = db.query(`
        SELECT COUNT(*) as count FROM events
      `).get() as any

      expect(finalSnapshotCount.count).toBe(initialSnapshotCount.count)
      expect(finalEventCount.count).toBe(initialEventCount.count)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
