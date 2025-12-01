import { describe, test, expect } from 'bun:test'
import { createTestDatabase, closeTestDatabase } from '../../../../../helpers/database'
import { TransactionBatcher } from '../../../../../../src/api/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../../../../src/api/infrastructure/unitOfWork'
import { CreateDigitalDownloadableProductService } from '../../../../../../src/api/app/digitalDownloadableProduct/commands/admin/createDigitalDownloadableProductService'
import { SlugAggregate } from '../../../../../../src/api/domain/slug/slugAggregate'
import type { CreateDigitalDownloadableProductCommand } from '../../../../../../src/api/app/digitalDownloadableProduct/commands/admin/commands'

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

function createValidCommand(): CreateDigitalDownloadableProductCommand {
  return {
    type: 'createDigitalDownloadableProduct',
    id: 'product-123',
    correlationId: 'correlation-123',
    userId: 'user-123',
    name: 'Test Digital Product',
    description: 'A test digital product',
    slug: 'test-digital-product',
    collections: ['collection-1'],
    richDescriptionUrl: 'https://example.com/description',
    vendor: 'Test Vendor',
    variantOptions: [{ name: 'Size', values: ['S', 'M', 'L'] }],
    metaTitle: 'Test Product Meta',
    metaDescription: 'Test product description',
    tags: ['tag1', 'tag2'],
    taxable: true,
    taxId: 'TAX123',
    maxDownloads: 5,
    accessDurationDays: 30,
  }
}

async function reserveSlugInDatabase(unitOfWork: UnitOfWork, slug: string, targetId: string, userId: string) {
  await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
    const slugAggregate = SlugAggregate.create({
      slug,
      correlationId: 'test-correlation',
    })
    slugAggregate.reserveSlug(targetId, 'digital_downloadable_product', userId)

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

describe('CreateDigitalDownloadableProductService', () => {
  test('should successfully create a new digital downloadable product with slug', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateDigitalDownloadableProductService(unitOfWork)
      const command = createValidCommand()

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
      expect(productPayload.productType).toBe('digital_downloadable')
      expect(productPayload.maxDownloads).toBe(5)
      expect(productPayload.accessDurationDays).toBe(30)

      // Verify slug snapshot was created
      const slugSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregateId = ?
      `).get(command.slug) as any

      expect(slugSnapshot).not.toBeNull()
      const slugPayload = JSON.parse(slugSnapshot.payload)
      expect(slugPayload.entityId).toBe(command.id)
      expect(slugPayload.entityType).toBe('digital_downloadable_product')
      expect(slugPayload.status).toBe('active')

      // Verify product events were saved
      const productEvents = db.query(`
        SELECT * FROM events
        WHERE aggregateId = ?
      `).all(command.id) as any[]

      expect(productEvents.length).toBeGreaterThan(0)
      expect(productEvents[0].eventType).toBe('digital_downloadable_product.created')

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
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()

      // Reserve the slug for a different product
      await reserveSlugInDatabase(unitOfWork, command.slug, 'other-product-id', 'user-456')

      const service = new CreateDigitalDownloadableProductService(unitOfWork)

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
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateDigitalDownloadableProductService(unitOfWork)
      const command = createValidCommand()

      await service.execute(command)

      const productSnapshot = db.query(`
        SELECT version FROM snapshots
        WHERE aggregateId = ?
      `).get(command.id) as any

      expect(productSnapshot.version).toBe(0)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should use same correlationId for product and slug events', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateDigitalDownloadableProductService(unitOfWork)
      const command = createValidCommand()

      await service.execute(command)

      const productEvents = db.query(`
        SELECT correlationId FROM events
        WHERE aggregateId = ?
      `).all(command.id) as any[]

      const slugEvents = db.query(`
        SELECT correlationId FROM events
        WHERE aggregateId = ?
      `).all(command.slug) as any[]

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

  test('should save product with all required fields including digital downloadable fields', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateDigitalDownloadableProductService(unitOfWork)
      const command = createValidCommand()

      await service.execute(command)

      const snapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregateId = ?
      `).get(command.id) as any

      const payload = JSON.parse(snapshot.payload)
      expect(payload.id).toBe(command.id)
      expect(payload.name).toBe(command.name)
      expect(payload.description).toBe(command.description)
      expect(payload.slug).toBe(command.slug)
      expect(payload.vendor).toBe(command.vendor)
      expect(payload.collections).toEqual(command.collections)
      expect(payload.tags).toEqual(command.tags)
      expect(payload.taxable).toBe(command.taxable)
      expect(payload.taxId).toBe(command.taxId)
      expect(payload.maxDownloads).toBe(command.maxDownloads)
      expect(payload.accessDurationDays).toBe(command.accessDurationDays)
      expect(payload.productType).toBe('digital_downloadable')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should create product with null download settings when not provided', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateDigitalDownloadableProductService(unitOfWork)
      const command = {
        ...createValidCommand(),
        maxDownloads: null,
        accessDurationDays: null,
      }

      await service.execute(command)

      const snapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregateId = ?
      `).get(command.id) as any

      const payload = JSON.parse(snapshot.payload)
      expect(payload.maxDownloads).toBeNull()
      expect(payload.accessDurationDays).toBeNull()
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should rollback on error and not create any data', async () => {
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

      const service = new CreateDigitalDownloadableProductService(unitOfWork)

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
