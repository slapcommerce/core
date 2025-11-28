import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDatabase, closeTestDatabase } from '../../../../../helpers/database'
import { TransactionBatcher } from '../../../../../../src/api/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../../../../src/api/infrastructure/unitOfWork'
import { CreateProductService } from '../../../../../../src/api/app/product/commands/admin/createProductService'
import { SlugAggregate } from '../../../../../../src/api/domain/slug/slugAggregate'
import type { CreateProductCommand } from '../../../../../../src/api/app/product/commands/admin/commands'

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

function createValidCommand(): CreateProductCommand {
  return {
    type: 'createProduct',
    id: 'product-123',
    correlationId: 'correlation-123',
    userId: 'user-123',
    name: 'Test Product',
    description: 'A test product',
    slug: 'test-product',
    collections: [{ collectionId: 'collection-1', position: 0 }],
    variantIds: ['variant-1'],
    richDescriptionUrl: 'https://example.com/description',
    fulfillmentType: 'digital',
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

async function reserveSlugInDatabase(unitOfWork: UnitOfWork, slug: string, targetId: string, userId: string) {
  await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
    const slugAggregate = SlugAggregate.create({
      slug,
      correlationId: 'test-correlation',
    })
    slugAggregate.reserveSlug(targetId, userId)

    snapshotRepository.saveSnapshot({
      aggregateId: slugAggregate.id,
      correlationId: 'test-correlation',
      version: slugAggregate.version,
      payload: slugAggregate.toSnapshot(),
    })

    for (const event of slugAggregate.uncommittedEvents) {
      eventRepository.addEvent(event)
      outboxRepository.addOutboxEvent(event, { id: crypto.randomUUID() })
    }
  })
}

describe('CreateProductService', () => {
  test('should successfully create a new product with slug', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateProductService(unitOfWork)
      const command = createValidCommand()

      // Act
      await service.execute(command)

      // Assert - Verify product snapshot was created
      const productSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregateId = ?
      `).get(command.id) as any

      expect(productSnapshot).not.toBeNull()
      expect(productSnapshot.version).toBe(0)
      expect(productSnapshot.correlationId).toBe(command.correlationId)

      const productPayload = JSON.parse(productSnapshot.payload)
      expect(productPayload.name).toBe(command.name)
      expect(productPayload.slug).toBe(command.slug)
      expect(productPayload.vendor).toBe(command.vendor)

      // Verify slug snapshot was created
      const slugSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregateId = ?
      `).get(command.slug) as any

      expect(slugSnapshot).not.toBeNull()
      const slugPayload = JSON.parse(slugSnapshot.payload)
      expect(slugPayload.productId).toBe(command.id)
      expect(slugPayload.status).toBe('active')

      // Verify product events were saved
      const productEvents = db.query(`
        SELECT * FROM events
        WHERE aggregateId = ?
      `).all(command.id) as any[]

      expect(productEvents.length).toBeGreaterThan(0)
      expect(productEvents[0].eventType).toBe('product.created')

      // Verify slug events were saved
      const slugEvents = db.query(`
        SELECT * FROM events
        WHERE aggregateId = ?
      `).all(command.slug) as any[]

      expect(slugEvents.length).toBeGreaterThan(0)

      // Verify all events added to outbox
      const outboxCount = db.query(`
        SELECT COUNT(*) as count FROM outbox
        WHERE aggregateId IN (?, ?)
      `).get(command.id, command.slug) as any

      expect(outboxCount.count).toBeGreaterThan(0)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when slug is already in use', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()

      // Reserve the slug for a different product
      await reserveSlugInDatabase(unitOfWork, command.slug, 'other-product-id', 'user-456')

      const service = new CreateProductService(unitOfWork)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow(`Slug "${command.slug}" is already in use`)

      // Verify no product snapshot was created
      const productSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregateId = ?
      `).get(command.id)

      expect(productSnapshot).toBeNull()
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should create product with initial version 0', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateProductService(unitOfWork)
      const command = createValidCommand()

      // Act
      await service.execute(command)

      // Assert
      const productSnapshot = db.query(`
        SELECT version FROM snapshots
        WHERE aggregateId = ?
      `).get(command.id) as any

      expect(productSnapshot.version).toBe(0)

      const slugSnapshot = db.query(`
        SELECT version FROM snapshots
        WHERE aggregateId = ?
      `).get(command.slug) as any

      expect(slugSnapshot.version).toBe(1) // Slug has 2 events: created + reserved
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should use same correlationId for product and slug events', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateProductService(unitOfWork)
      const command = createValidCommand()

      // Act
      await service.execute(command)

      // Assert
      const productEvents = db.query(`
        SELECT correlationId FROM events
        WHERE aggregateId = ?
      `).all(command.id) as any[]

      const slugEvents = db.query(`
        SELECT correlationId FROM events
        WHERE aggregateId = ?
      `).all(command.slug) as any[]

      // All events should have the same correlationId
      for (const event of productEvents) {
        expect(event.correlationId).toBe(command.correlationId)
      }

      for (const event of slugEvents) {
        expect(event.correlationId).toBe(command.correlationId)
      }
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should create both product and slug snapshots', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateProductService(unitOfWork)
      const command = createValidCommand()

      // Act
      await service.execute(command)

      // Assert
      const snapshots = db.query(`
        SELECT aggregateId FROM snapshots
        WHERE correlationId = ?
      `).all(command.correlationId) as any[]

      expect(snapshots).toHaveLength(2)

      const aggregateIds = snapshots.map(s => s.aggregateId)
      expect(aggregateIds).toContain(command.id)
      expect(aggregateIds).toContain(command.slug)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should add all events to outbox', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateProductService(unitOfWork)
      const command = createValidCommand()

      // Act
      await service.execute(command)

      // Assert
      const productEvents = db.query(`
        SELECT COUNT(*) as count FROM events
        WHERE aggregateId = ?
      `).get(command.id) as any

      const slugEvents = db.query(`
        SELECT COUNT(*) as count FROM events
        WHERE aggregateId = ?
      `).get(command.slug) as any

      const outboxEvents = db.query(`
        SELECT COUNT(*) as count FROM outbox
        WHERE aggregateId IN (?, ?)
      `).get(command.id, command.slug) as any

      // All events should be in outbox
      const totalEvents = productEvents.count + slugEvents.count
      expect(outboxEvents.count).toBe(totalEvents)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should save product with all required fields', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateProductService(unitOfWork)
      const command = createValidCommand()

      // Act
      await service.execute(command)

      // Assert
      const snapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregateId = ?
      `).get(command.id) as any

      const payload = JSON.parse(snapshot.payload)
      expect(payload.id).toBe(command.id)
      expect(payload.name).toBe(command.name)
      expect(payload.description).toBe(command.description)
      expect(payload.slug).toBe(command.slug)
      expect(payload.fulfillmentType).toBe(command.fulfillmentType)
      expect(payload.vendor).toBe(command.vendor)
      expect(payload.collections).toEqual(command.collections)
      expect(payload.variantIds).toEqual(command.variantIds)
      expect(payload.tags).toEqual(command.tags)
      expect(payload.taxable).toBe(command.taxable)
      expect(payload.taxId).toBe(command.taxId)
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

      // Reserve the slug first
      await reserveSlugInDatabase(unitOfWork, command.slug, 'other-product-id', 'user-456')

      // Get initial counts
      const initialSnapshotCount = db.query(`
        SELECT COUNT(*) as count FROM snapshots
      `).get() as any

      const initialEventCount = db.query(`
        SELECT COUNT(*) as count FROM events
      `).get() as any

      const service = new CreateProductService(unitOfWork)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow()

      // Verify no new product data was created
      const productSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregateId = ?
      `).get(command.id)

      expect(productSnapshot).toBeNull()

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
