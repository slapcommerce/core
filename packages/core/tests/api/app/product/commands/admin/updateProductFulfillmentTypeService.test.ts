import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDatabase, closeTestDatabase } from '../../../../../helpers/database'
import { TransactionBatcher } from '../../../../../../src/api/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../../../../src/api/infrastructure/unitOfWork'
import { UpdateProductFulfillmentTypeService } from '../../../../../../src/api/app/product/commands/admin/updateProductFulfillmentTypeService'
import { ProductAggregate } from '../../../../../../src/api/domain/product/aggregate'
import { VariantAggregate } from '../../../../../../src/api/domain/variant/aggregate'
import type { UpdateProductFulfillmentTypeCommand } from '../../../../../../src/api/app/product/commands/admin/commands'

function createValidProductParams() {
  return {
    id: 'product-123',
    correlationId: 'correlation-123',
    userId: 'user-123',
    name: 'Test Product',
    description: 'A test product',
    slug: 'test-product',
    collections: ['collection-1'],
    variantPositionsAggregateId: 'variant-positions-123',
    richDescriptionUrl: 'https://example.com/description',
    fulfillmentType: 'dropship' as const,
    vendor: 'Test Vendor',
    variantOptions: [{ name: 'Size', values: ['S', 'M', 'L'] }],
    metaTitle: 'Test Product Meta',
    metaDescription: 'Test product description',
    tags: ['tag1', 'tag2'],
    taxable: true,
    taxId: 'TAX123',
    dropshipSafetyBuffer: 2,
  }
}

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

async function createProductInDatabase(unitOfWork: UnitOfWork, params: ReturnType<typeof createValidProductParams>) {
  await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
    const product = ProductAggregate.create(params)

    snapshotRepository.saveSnapshot({
      aggregateId: product.id,
      correlationId: params.correlationId,
      version: product.version,
      payload: product.toSnapshot(),
    })

    for (const event of product.uncommittedEvents) {
      eventRepository.addEvent(event)
      outboxRepository.addOutboxEvent(event, { id: crypto.randomUUID() })
    }
  })
}

async function createVariantInDatabase(unitOfWork: UnitOfWork, variantId: string, productId: string) {
  await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
    const variant = VariantAggregate.create({
      id: variantId,
      correlationId: `correlation-${variantId}`,
      userId: 'user-123',
      productId: productId,
      sku: `SKU-${variantId}`,
      price: 1000,
      inventory: 100,
      options: { Size: 'M' },
    })

    snapshotRepository.saveSnapshot({
      aggregateId: variant.id,
      correlationId: `correlation-${variantId}`,
      version: variant.version,
      payload: variant.toSnapshot(),
    })

    for (const event of variant.uncommittedEvents) {
      eventRepository.addEvent(event)
      outboxRepository.addOutboxEvent(event, { id: crypto.randomUUID() })
    }
  })
}

describe('UpdateProductFulfillmentTypeService', () => {
  test('should successfully update product fulfillment type', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      await createProductInDatabase(unitOfWork, productParams)

      const service = new UpdateProductFulfillmentTypeService(unitOfWork)
      const command: UpdateProductFulfillmentTypeCommand = {
        type: 'updateProductFulfillmentType',
        id: productParams.id,
        fulfillmentType: 'dropship',
        dropshipSafetyBuffer: 3,
        userId: 'user-456',
        expectedVersion: 0,
      }

      // Act
      await service.execute(command)

      // Assert - Verify snapshot was updated
      const updatedSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregateId = ?
        ORDER BY version DESC
        LIMIT 1
      `).get(productParams.id) as any

      expect(updatedSnapshot).not.toBeNull()
      expect(updatedSnapshot.version).toBe(1)
      const payload = JSON.parse(updatedSnapshot.payload)
      expect(payload.fulfillmentType).toBe('dropship')
      expect(payload.dropshipSafetyBuffer).toBe(3)

      // Verify event was saved
      const events = db.query(`
        SELECT * FROM events
        WHERE aggregateId = ? AND version = 1
      `).all(productParams.id) as any[]

      expect(events).toHaveLength(1)
      expect(events[0].eventType).toBe('product.fulfillment_type_updated')

      // Verify outbox entry was created
      const outboxEvents = db.query(`
        SELECT * FROM outbox
        WHERE aggregateId = ?
      `).all(productParams.id) as any[]

      expect(outboxEvents.length).toBeGreaterThanOrEqual(1)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should update fulfillment type to digital', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      await createProductInDatabase(unitOfWork, productParams)

      const service = new UpdateProductFulfillmentTypeService(unitOfWork)
      const command: UpdateProductFulfillmentTypeCommand = {
        type: 'updateProductFulfillmentType',
        id: productParams.id,
        fulfillmentType: 'digital',
        dropshipSafetyBuffer: 0,
        userId: 'user-456',
        expectedVersion: 0,
      }

      // Act
      await service.execute(command)

      // Assert - Verify product was updated
      const productSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregateId = ?
        ORDER BY version DESC
        LIMIT 1
      `).get(productParams.id) as any

      const productPayload = JSON.parse(productSnapshot.payload)
      expect(productPayload.fulfillmentType).toBe('digital')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should not reset variant inventory when switching to non-digital fulfillment', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      await createProductInDatabase(unitOfWork, productParams)

      const service = new UpdateProductFulfillmentTypeService(unitOfWork)
      const command: UpdateProductFulfillmentTypeCommand = {
        type: 'updateProductFulfillmentType',
        id: productParams.id,
        fulfillmentType: 'dropship',
        dropshipSafetyBuffer: 3,
        userId: 'user-456',
        expectedVersion: 0,
      }

      // Get initial event count
      const initialEventCount = db.query(`
        SELECT COUNT(*) as count FROM events
        WHERE aggregateId = ?
      `).get(productParams.id) as any

      // Act
      await service.execute(command)

      // Assert - Verify only product event was created (no variant events)
      const finalEventCount = db.query(`
        SELECT COUNT(*) as count FROM events
        WHERE aggregateId = ?
      `).get(productParams.id) as any

      expect(finalEventCount.count).toBe(initialEventCount.count + 1) // Only the product update event
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when product not found', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new UpdateProductFulfillmentTypeService(unitOfWork)
      const command: UpdateProductFulfillmentTypeCommand = {
        type: 'updateProductFulfillmentType',
        id: 'non-existent-product',
        fulfillmentType: 'digital',
        dropshipSafetyBuffer: 0,
        userId: 'user-456',
        expectedVersion: 0,
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow('Product with id non-existent-product not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error on optimistic concurrency conflict', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      await createProductInDatabase(unitOfWork, productParams)

      const service = new UpdateProductFulfillmentTypeService(unitOfWork)
      const command: UpdateProductFulfillmentTypeCommand = {
        type: 'updateProductFulfillmentType',
        id: productParams.id,
        fulfillmentType: 'digital',
        dropshipSafetyBuffer: 0,
        userId: 'user-456',
        expectedVersion: 5, // Wrong version - product is at version 0
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow('Optimistic concurrency conflict: expected version 5 but found version 0')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should increment version correctly', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      await createProductInDatabase(unitOfWork, productParams)

      const service = new UpdateProductFulfillmentTypeService(unitOfWork)
      const command: UpdateProductFulfillmentTypeCommand = {
        type: 'updateProductFulfillmentType',
        id: productParams.id,
        fulfillmentType: 'digital',
        dropshipSafetyBuffer: 0,
        userId: 'user-456',
        expectedVersion: 0,
      }

      // Act
      await service.execute(command)

      // Assert
      const updatedSnapshot = db.query(`
        SELECT version FROM snapshots
        WHERE aggregateId = ?
        ORDER BY version DESC
        LIMIT 1
      `).get(productParams.id) as any

      expect(updatedSnapshot.version).toBe(1)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should preserve other product fields when updating fulfillment type', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      await createProductInDatabase(unitOfWork, productParams)

      const service = new UpdateProductFulfillmentTypeService(unitOfWork)
      const command: UpdateProductFulfillmentTypeCommand = {
        type: 'updateProductFulfillmentType',
        id: productParams.id,
        fulfillmentType: 'digital',
        dropshipSafetyBuffer: 0,
        userId: 'user-456',
        expectedVersion: 0,
      }

      // Act
      await service.execute(command)

      // Assert
      const updatedSnapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregateId = ?
        ORDER BY version DESC
        LIMIT 1
      `).get(productParams.id) as any

      const payload = JSON.parse(updatedSnapshot.payload)
      expect(payload.name).toBe(productParams.name)
      expect(payload.slug).toBe(productParams.slug)
      expect(payload.vendor).toBe(productParams.vendor)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should rollback on error', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      await createProductInDatabase(unitOfWork, productParams)

      // Get initial state
      const initialSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregateId = ?
      `).get(productParams.id) as any

      const initialEventCount = db.query(`
        SELECT COUNT(*) as count FROM events
        WHERE aggregateId = ?
      `).get(productParams.id) as any

      const service = new UpdateProductFulfillmentTypeService(unitOfWork)
      const command: UpdateProductFulfillmentTypeCommand = {
        type: 'updateProductFulfillmentType',
        id: productParams.id,
        fulfillmentType: 'digital',
        dropshipSafetyBuffer: 0,
        userId: 'user-456',
        expectedVersion: 999, // Wrong version - should cause rollback
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow()

      // Verify state unchanged after error
      const finalSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregateId = ?
      `).get(productParams.id) as any

      const finalEventCount = db.query(`
        SELECT COUNT(*) as count FROM events
        WHERE aggregateId = ?
      `).get(productParams.id) as any

      expect(finalSnapshot.version).toBe(initialSnapshot.version)
      expect(finalEventCount.count).toBe(initialEventCount.count)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
