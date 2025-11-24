import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDatabase, closeTestDatabase } from '../../helpers/database'
import { TransactionBatcher } from '../../../../src/api/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../../src/api/infrastructure/unitOfWork'
import { UpdateProductTagsService } from '../../../../src/api/app/product/updateProductTagsService'
import { ProductAggregate } from '../../../../src/api/domain/product/aggregate'
import type { UpdateProductTagsCommand } from '../../../../src/api/app/product/commands'

function createValidProductParams() {
  return {
    id: 'product-123',
    correlationId: 'correlation-123',
    userId: 'user-123',
    title: 'Test Product',
    shortDescription: 'A test product',
    slug: 'test-product',
    collectionIds: ['collection-1'],
    variantIds: ['variant-1'],
    richDescriptionUrl: 'https://example.com/description',
    productType: 'physical',
    fulfillmentType: 'digital' as const,
    vendor: 'Test Vendor',
    variantOptions: [{ name: 'Size', values: ['S', 'M', 'L'] }],
    metaTitle: 'Test Product Meta',
    metaDescription: 'Test product description',
    tags: ['original-tag-1', 'original-tag-2'],
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
      aggregate_id: product.id,
      correlation_id: params.correlationId,
      version: product.version,
      payload: product.toSnapshot(),
    })

    for (const event of product.uncommittedEvents) {
      eventRepository.addEvent(event)
      outboxRepository.addOutboxEvent(event, { id: crypto.randomUUID() })
    }
  })
}

describe('UpdateProductTagsService', () => {
  test('should successfully update product tags', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      await createProductInDatabase(unitOfWork, productParams)

      const service = new UpdateProductTagsService(unitOfWork)
      const command: UpdateProductTagsCommand = {
        type: 'updateProductTags',
        id: productParams.id,
        tags: ['new-tag-1', 'new-tag-2', 'new-tag-3'],
        userId: 'user-456',
        expectedVersion: 0,
      }

      // Act
      await service.execute(command)

      // Assert - Verify snapshot was updated
      const updatedSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregate_id = ?
        ORDER BY version DESC
        LIMIT 1
      `).get(productParams.id) as any

      expect(updatedSnapshot).not.toBeNull()
      expect(updatedSnapshot.version).toBe(1)
      const payload = JSON.parse(updatedSnapshot.payload)
      expect(payload.tags).toEqual(['new-tag-1', 'new-tag-2', 'new-tag-3'])

      // Verify event was saved
      const events = db.query(`
        SELECT * FROM events
        WHERE aggregate_id = ? AND version = 1
      `).all(productParams.id) as any[]

      expect(events).toHaveLength(1)
      expect(events[0].event_type).toBe('product.tags_updated')

      // Verify outbox entry was created
      const outboxEvents = db.query(`
        SELECT * FROM outbox
        WHERE aggregate_id = ?
      `).all(productParams.id) as any[]

      expect(outboxEvents.length).toBeGreaterThanOrEqual(1)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when product not found', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new UpdateProductTagsService(unitOfWork)
      const command: UpdateProductTagsCommand = {
        type: 'updateProductTags',
        id: 'non-existent-product',
        tags: ['new-tag'],
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

      const service = new UpdateProductTagsService(unitOfWork)
      const command: UpdateProductTagsCommand = {
        type: 'updateProductTags',
        id: productParams.id,
        tags: ['new-tag'],
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

      const service = new UpdateProductTagsService(unitOfWork)
      const command: UpdateProductTagsCommand = {
        type: 'updateProductTags',
        id: productParams.id,
        tags: ['new-tag'],
        userId: 'user-456',
        expectedVersion: 0,
      }

      // Act
      await service.execute(command)

      // Assert
      const updatedSnapshot = db.query(`
        SELECT version FROM snapshots
        WHERE aggregate_id = ?
        ORDER BY version DESC
        LIMIT 1
      `).get(productParams.id) as any

      expect(updatedSnapshot.version).toBe(1)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should save event with correct priorState and newState', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      await createProductInDatabase(unitOfWork, productParams)

      const service = new UpdateProductTagsService(unitOfWork)
      const command: UpdateProductTagsCommand = {
        type: 'updateProductTags',
        id: productParams.id,
        tags: ['new-tag-1', 'new-tag-2'],
        userId: 'user-456',
        expectedVersion: 0,
      }

      // Act
      await service.execute(command)

      // Assert
      const event = db.query(`
        SELECT payload FROM events
        WHERE aggregate_id = ? AND version = 1
      `).get(productParams.id) as any

      const eventPayload = JSON.parse(event.payload)
      expect(eventPayload.priorState.tags).toEqual(productParams.tags)
      expect(eventPayload.newState.tags).toEqual(['new-tag-1', 'new-tag-2'])
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should preserve other product fields when updating tags', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      await createProductInDatabase(unitOfWork, productParams)

      const service = new UpdateProductTagsService(unitOfWork)
      const command: UpdateProductTagsCommand = {
        type: 'updateProductTags',
        id: productParams.id,
        tags: ['new-tag'],
        userId: 'user-456',
        expectedVersion: 0,
      }

      // Act
      await service.execute(command)

      // Assert
      const updatedSnapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregate_id = ?
        ORDER BY version DESC
        LIMIT 1
      `).get(productParams.id) as any

      const payload = JSON.parse(updatedSnapshot.payload)
      expect(payload.title).toBe(productParams.title)
      expect(payload.slug).toBe(productParams.slug)
      expect(payload.vendor).toBe(productParams.vendor)
      expect(payload.productType).toBe(productParams.productType)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should handle multiple sequential updates', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      await createProductInDatabase(unitOfWork, productParams)

      const service = new UpdateProductTagsService(unitOfWork)

      // Act - First update
      await service.execute({
        type: 'updateProductTags',
        id: productParams.id,
        tags: ['tag-a', 'tag-b'],
        userId: 'user-456',
        expectedVersion: 0,
      })

      // Act - Second update
      await service.execute({
        type: 'updateProductTags',
        id: productParams.id,
        tags: ['tag-c', 'tag-d', 'tag-e'],
        userId: 'user-789',
        expectedVersion: 1,
      })

      // Assert
      const finalSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregate_id = ?
        ORDER BY version DESC
        LIMIT 1
      `).get(productParams.id) as any

      expect(finalSnapshot.version).toBe(2)
      const payload = JSON.parse(finalSnapshot.payload)
      expect(payload.tags).toEqual(['tag-c', 'tag-d', 'tag-e'])

      // Verify all events were saved
      const eventCount = db.query(`
        SELECT COUNT(*) as count FROM events
        WHERE aggregate_id = ?
      `).get(productParams.id) as any

      expect(eventCount.count).toBe(3) // created + 2 updates
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should handle empty tags array', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      await createProductInDatabase(unitOfWork, productParams)

      const service = new UpdateProductTagsService(unitOfWork)
      const command: UpdateProductTagsCommand = {
        type: 'updateProductTags',
        id: productParams.id,
        tags: [],
        userId: 'user-456',
        expectedVersion: 0,
      }

      // Act
      await service.execute(command)

      // Assert
      const updatedSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregate_id = ?
        ORDER BY version DESC
        LIMIT 1
      `).get(productParams.id) as any

      const payload = JSON.parse(updatedSnapshot.payload)
      expect(payload.tags).toEqual([])
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
        WHERE aggregate_id = ?
      `).get(productParams.id) as any

      const initialEventCount = db.query(`
        SELECT COUNT(*) as count FROM events
        WHERE aggregate_id = ?
      `).get(productParams.id) as any

      const service = new UpdateProductTagsService(unitOfWork)
      const command: UpdateProductTagsCommand = {
        type: 'updateProductTags',
        id: productParams.id,
        tags: ['new-tag'],
        userId: 'user-456',
        expectedVersion: 999, // Wrong version - should cause rollback
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow()

      // Verify state unchanged after error
      const finalSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregate_id = ?
      `).get(productParams.id) as any

      const finalEventCount = db.query(`
        SELECT COUNT(*) as count FROM events
        WHERE aggregate_id = ?
      `).get(productParams.id) as any

      expect(finalSnapshot.version).toBe(initialSnapshot.version)
      expect(finalEventCount.count).toBe(initialEventCount.count)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should set correct access level', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new UpdateProductTagsService(unitOfWork)

      // Assert
      expect(service.accessLevel).toBe('admin')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
