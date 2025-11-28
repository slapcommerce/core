import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDatabase, closeTestDatabase } from '../../../../../helpers/database'
import { TransactionBatcher } from '../../../../../../src/api/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../../../../src/api/infrastructure/unitOfWork'
import { UpdateProductDetailsService } from '../../../../../../src/api/app/product/commands/admin/updateProductDetailsService'
import { ProductAggregate } from '../../../../../../src/api/domain/product/aggregate'
import type { UpdateProductDetailsCommand } from '../../../../../../src/api/app/product/commands/admin/commands'

function createValidProductParams() {
  return {
    id: 'product-123',
    correlationId: 'correlation-123',
    userId: 'user-123',
    name: 'Original Name',
    description: 'Original description',
    slug: 'test-product',
    collectionIds: ['collection-1'],
    variantIds: ['variant-1'],
    richDescriptionUrl: 'https://example.com/original-description',
    fulfillmentType: 'digital' as const,
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

describe('UpdateProductDetailsService', () => {
  test('should successfully update product details', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      await createProductInDatabase(unitOfWork, productParams)

      const service = new UpdateProductDetailsService(unitOfWork)
      const command: UpdateProductDetailsCommand = {
        type: 'updateProductDetails',
        id: productParams.id,
        name: 'Updated Name',
        description: 'Updated description',
        richDescriptionUrl: 'https://example.com/new-description',
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
      expect(payload.name).toBe('Updated Name')
      expect(payload.description).toBe('Updated description')
      expect(payload.richDescriptionUrl).toBe('https://example.com/new-description')

      // Verify event was saved
      const events = db.query(`
        SELECT * FROM events
        WHERE aggregateId = ? AND version = 1
      `).all(productParams.id) as any[]

      expect(events).toHaveLength(1)
      expect(events[0].eventType).toBe('product.details_updated')

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

  test('should throw error when product not found', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new UpdateProductDetailsService(unitOfWork)
      const command: UpdateProductDetailsCommand = {
        type: 'updateProductDetails',
        id: 'non-existent-product',
        name: 'Updated Name',
        description: 'Updated description',
        richDescriptionUrl: 'https://example.com/new-description',
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

      const service = new UpdateProductDetailsService(unitOfWork)
      const command: UpdateProductDetailsCommand = {
        type: 'updateProductDetails',
        id: productParams.id,
        name: 'Updated Name',
        description: 'Updated description',
        richDescriptionUrl: 'https://example.com/new-description',
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

      const service = new UpdateProductDetailsService(unitOfWork)
      const command: UpdateProductDetailsCommand = {
        type: 'updateProductDetails',
        id: productParams.id,
        name: 'Updated Name',
        description: 'Updated description',
        richDescriptionUrl: 'https://example.com/new-description',
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

  test('should save event with correct priorState and newState', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      await createProductInDatabase(unitOfWork, productParams)

      const service = new UpdateProductDetailsService(unitOfWork)
      const command: UpdateProductDetailsCommand = {
        type: 'updateProductDetails',
        id: productParams.id,
        name: 'Updated Name',
        description: 'Updated description',
        richDescriptionUrl: 'https://example.com/new-description',
        userId: 'user-456',
        expectedVersion: 0,
      }

      // Act
      await service.execute(command)

      // Assert
      const event = db.query(`
        SELECT payload FROM events
        WHERE aggregateId = ? AND version = 1
      `).get(productParams.id) as any

      const eventPayload = JSON.parse(event.payload)
      expect(eventPayload.priorState.name).toBe(productParams.name)
      expect(eventPayload.priorState.description).toBe(productParams.description)
      expect(eventPayload.priorState.richDescriptionUrl).toBe(productParams.richDescriptionUrl)
      expect(eventPayload.newState.name).toBe('Updated Name')
      expect(eventPayload.newState.description).toBe('Updated description')
      expect(eventPayload.newState.richDescriptionUrl).toBe('https://example.com/new-description')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should preserve other product fields when updating details', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      await createProductInDatabase(unitOfWork, productParams)

      const service = new UpdateProductDetailsService(unitOfWork)
      const command: UpdateProductDetailsCommand = {
        type: 'updateProductDetails',
        id: productParams.id,
        name: 'Updated Name',
        description: 'Updated description',
        richDescriptionUrl: 'https://example.com/new-description',
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
      expect(payload.slug).toBe(productParams.slug)
      expect(payload.vendor).toBe(productParams.vendor)
      expect(payload.taxable).toBe(productParams.taxable)
      expect(payload.taxId).toBe(productParams.taxId)
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

      const service = new UpdateProductDetailsService(unitOfWork)

      // Act - First update
      await service.execute({
        type: 'updateProductDetails',
        id: productParams.id,
        name: 'Title V1',
        description: 'Description V1',
        richDescriptionUrl: 'https://example.com/v1',
        userId: 'user-456',
        expectedVersion: 0,
      })

      // Act - Second update
      await service.execute({
        type: 'updateProductDetails',
        id: productParams.id,
        name: 'Name V2',
        description: 'Description V2',
        richDescriptionUrl: 'https://example.com/v2',
        userId: 'user-789',
        expectedVersion: 1,
      })

      // Assert
      const finalSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregateId = ?
        ORDER BY version DESC
        LIMIT 1
      `).get(productParams.id) as any

      expect(finalSnapshot.version).toBe(2)
      const payload = JSON.parse(finalSnapshot.payload)
      expect(payload.name).toBe('Name V2')
      expect(payload.description).toBe('Description V2')
      expect(payload.richDescriptionUrl).toBe('https://example.com/v2')

      // Verify all events were saved
      const eventCount = db.query(`
        SELECT COUNT(*) as count FROM events
        WHERE aggregateId = ?
      `).get(productParams.id) as any

      expect(eventCount.count).toBe(3) // created + 2 updates
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

      const service = new UpdateProductDetailsService(unitOfWork)
      const command: UpdateProductDetailsCommand = {
        type: 'updateProductDetails',
        id: productParams.id,
        name: 'Updated Name',
        description: 'Updated description',
        richDescriptionUrl: 'https://example.com/new-description',
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
