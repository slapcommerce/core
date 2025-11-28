import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDatabase, closeTestDatabase } from '../../../../../helpers/database'
import { TransactionBatcher } from '../../../../../../src/api/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../../../../src/api/infrastructure/unitOfWork'
import { UnpublishProductService } from '../../../../../../src/api/app/product/commands/admin/unpublishProductService'
import { ProductAggregate } from '../../../../../../src/api/domain/product/aggregate'
import type { UnpublishProductCommand } from '../../../../../../src/api/app/product/commands/admin/commands'

function createValidProductParams() {
  return {
    id: 'product-123',
    correlationId: 'correlation-123',
    userId: 'user-123',
    name: 'Test Product',
    description: 'A test product',
    slug: 'test-product',
    collections: ['collection-1'],
    variantIds: ['variant-1'],
    richDescriptionUrl: 'https://example.com/description',
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

async function createPublishedProductInDatabase(unitOfWork: UnitOfWork, params: ReturnType<typeof createValidProductParams>) {
  await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
    const product = ProductAggregate.create(params)
    product.publish('user-123')

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

describe('UnpublishProductService', () => {
  test('should successfully unpublish a product', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      await createPublishedProductInDatabase(unitOfWork, productParams)

      const service = new UnpublishProductService(unitOfWork)
      const command: UnpublishProductCommand = {
        type: 'unpublishProduct',
        id: productParams.id,
        userId: 'user-456',
        expectedVersion: 1, // Product is at version 1 after publishing
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
      expect(updatedSnapshot.version).toBe(2)
      const payload = JSON.parse(updatedSnapshot.payload)
      expect(payload.status).toBe('draft')
      expect(payload.publishedAt).toBeNull()

      // Verify event was saved
      const events = db.query(`
        SELECT * FROM events
        WHERE aggregateId = ? AND version = 2
      `).all(productParams.id) as any[]

      expect(events).toHaveLength(1)
      expect(events[0].eventType).toBe('product.unpublished')

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
      const service = new UnpublishProductService(unitOfWork)
      const command: UnpublishProductCommand = {
        type: 'unpublishProduct',
        id: 'non-existent-product',
        userId: 'user-456',
        expectedVersion: 1,
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
      await createPublishedProductInDatabase(unitOfWork, productParams)

      const service = new UnpublishProductService(unitOfWork)
      const command: UnpublishProductCommand = {
        type: 'unpublishProduct',
        id: productParams.id,
        userId: 'user-456',
        expectedVersion: 5, // Wrong version - product is at version 1
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow('Optimistic concurrency conflict: expected version 5 but found version 1')
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
      await createPublishedProductInDatabase(unitOfWork, productParams)

      const service = new UnpublishProductService(unitOfWork)
      const command: UnpublishProductCommand = {
        type: 'unpublishProduct',
        id: productParams.id,
        userId: 'user-456',
        expectedVersion: 1,
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

      expect(updatedSnapshot.version).toBe(2)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should set status to draft when unpublished', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      await createPublishedProductInDatabase(unitOfWork, productParams)

      const service = new UnpublishProductService(unitOfWork)
      const command: UnpublishProductCommand = {
        type: 'unpublishProduct',
        id: productParams.id,
        userId: 'user-456',
        expectedVersion: 1,
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
      expect(payload.status).toBe('draft')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should clear publishedAt timestamp when unpublished', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      await createPublishedProductInDatabase(unitOfWork, productParams)

      // Verify product was published with publishedAt set
      const beforeUnpublish = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregateId = ?
      `).get(productParams.id) as any
      const beforePayload = JSON.parse(beforeUnpublish.payload)
      expect(beforePayload.publishedAt).toBeTruthy()

      const service = new UnpublishProductService(unitOfWork)
      const command: UnpublishProductCommand = {
        type: 'unpublishProduct',
        id: productParams.id,
        userId: 'user-456',
        expectedVersion: 1,
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
      expect(payload.publishedAt).toBeNull()
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should preserve other product fields when unpublishing', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      await createPublishedProductInDatabase(unitOfWork, productParams)

      const service = new UnpublishProductService(unitOfWork)
      const command: UnpublishProductCommand = {
        type: 'unpublishProduct',
        id: productParams.id,
        userId: 'user-456',
        expectedVersion: 1,
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
      await createPublishedProductInDatabase(unitOfWork, productParams)

      // Get initial state
      const initialSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregateId = ?
      `).get(productParams.id) as any

      const initialEventCount = db.query(`
        SELECT COUNT(*) as count FROM events
        WHERE aggregateId = ?
      `).get(productParams.id) as any

      const service = new UnpublishProductService(unitOfWork)
      const command: UnpublishProductCommand = {
        type: 'unpublishProduct',
        id: productParams.id,
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
