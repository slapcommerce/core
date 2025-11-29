import { describe, test, expect } from 'bun:test'
import { createTestDatabase, closeTestDatabase } from '../../../../../helpers/database'
import { TransactionBatcher } from '../../../../../../src/api/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../../../../src/api/infrastructure/unitOfWork'
import { CreateBundleService } from '../../../../../../src/api/app/bundle/commands/admin/createBundleService'
import { SlugAggregate } from '../../../../../../src/api/domain/slug/slugAggregate'
import type { CreateBundleCommand } from '../../../../../../src/api/app/bundle/commands/admin/commands'

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

function createValidCommand(): CreateBundleCommand {
  return {
    type: 'createBundle',
    id: '01930000-0000-7000-8000-000000000001',
    correlationId: '01930000-0000-7000-8000-000000000002',
    userId: 'user-123',
    name: 'Test Bundle',
    description: 'A test bundle',
    slug: 'test-bundle',
    items: [
      { variantId: '01930000-0000-7000-8000-000000000003', quantity: 2 },
      { variantId: '01930000-0000-7000-8000-000000000004', quantity: 1 },
    ],
    price: 99.99,
    compareAtPrice: 129.99,
    metaTitle: 'Test Bundle Meta',
    metaDescription: 'Test bundle description',
    richDescriptionUrl: 'https://example.com/description',
    tags: ['tag1', 'tag2'],
    collections: [],
    taxable: true,
    taxId: 'TAX123',
  }
}

async function reserveSlugInDatabase(unitOfWork: UnitOfWork, slug: string, targetId: string, userId: string) {
  await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
    const slugAggregate = SlugAggregate.create({
      slug,
      correlationId: 'test-correlation',
    })
    slugAggregate.reserveSlug(targetId, 'bundle', userId)

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

describe('CreateBundleService', () => {
  test('should successfully create a new bundle with slug', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateBundleService(unitOfWork)
      const command = createValidCommand()

      // Act
      await service.execute(command)

      // Assert - Verify bundle snapshot was created
      const bundleSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregateId = ?
      `).get(command.id) as any

      expect(bundleSnapshot).not.toBeNull()
      expect(bundleSnapshot.version).toBe(0)
      expect(bundleSnapshot.correlationId).toBe(command.correlationId)

      const bundlePayload = JSON.parse(bundleSnapshot.payload)
      expect(bundlePayload.name).toBe(command.name)
      expect(bundlePayload.slug).toBe(command.slug)
      expect(bundlePayload.price).toBe(command.price)
      expect(bundlePayload.items).toEqual(command.items)

      // Verify slug snapshot was created
      const slugSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregateId = ?
      `).get(command.slug) as any

      expect(slugSnapshot).not.toBeNull()
      const slugPayload = JSON.parse(slugSnapshot.payload)
      expect(slugPayload.entityId).toBe(command.id)
      expect(slugPayload.entityType).toBe('bundle')
      expect(slugPayload.status).toBe('active')

      // Verify bundle events were saved
      const bundleEvents = db.query(`
        SELECT * FROM events
        WHERE aggregateId = ?
      `).all(command.id) as any[]

      expect(bundleEvents.length).toBeGreaterThan(0)
      expect(bundleEvents[0].eventType).toBe('bundle.created')

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

      // Reserve the slug for a different bundle
      await reserveSlugInDatabase(unitOfWork, command.slug, 'other-bundle-id', 'user-456')

      const service = new CreateBundleService(unitOfWork)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow(`Slug "${command.slug}" is already in use`)

      // Verify no bundle snapshot was created
      const bundleSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregateId = ?
      `).get(command.id)

      expect(bundleSnapshot).toBeNull()
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should create bundle with initial version 0', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateBundleService(unitOfWork)
      const command = createValidCommand()

      // Act
      await service.execute(command)

      // Assert
      const bundleSnapshot = db.query(`
        SELECT version FROM snapshots
        WHERE aggregateId = ?
      `).get(command.id) as any

      expect(bundleSnapshot.version).toBe(0)

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

  test('should use same correlationId for bundle and slug events', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateBundleService(unitOfWork)
      const command = createValidCommand()

      // Act
      await service.execute(command)

      // Assert
      const bundleEvents = db.query(`
        SELECT correlationId FROM events
        WHERE aggregateId = ?
      `).all(command.id) as any[]

      const slugEvents = db.query(`
        SELECT correlationId FROM events
        WHERE aggregateId = ?
      `).all(command.slug) as any[]

      // All events should have the same correlationId
      for (const event of bundleEvents) {
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

  test('should create both bundle and slug snapshots', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateBundleService(unitOfWork)
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
      const service = new CreateBundleService(unitOfWork)
      const command = createValidCommand()

      // Act
      await service.execute(command)

      // Assert
      const bundleEvents = db.query(`
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
      const totalEvents = bundleEvents.count + slugEvents.count
      expect(outboxEvents.count).toBe(totalEvents)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should save bundle with all required fields', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateBundleService(unitOfWork)
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
      expect(payload.items).toEqual(command.items)
      expect(payload.price).toBe(command.price)
      expect(payload.compareAtPrice).toBe(command.compareAtPrice)
      expect(payload.metaTitle).toBe(command.metaTitle)
      expect(payload.metaDescription).toBe(command.metaDescription)
      expect(payload.richDescriptionUrl).toBe(command.richDescriptionUrl)
      expect(payload.tags).toEqual(command.tags)
      expect(payload.collections).toEqual(command.collections)
      expect(payload.taxable).toBe(command.taxable)
      expect(payload.taxId).toBe(command.taxId)
      expect(payload.status).toBe('draft')
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
      await reserveSlugInDatabase(unitOfWork, command.slug, 'other-bundle-id', 'user-456')

      // Get initial counts
      const initialSnapshotCount = db.query(`
        SELECT COUNT(*) as count FROM snapshots
      `).get() as any

      const initialEventCount = db.query(`
        SELECT COUNT(*) as count FROM events
      `).get() as any

      const service = new CreateBundleService(unitOfWork)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow()

      // Verify no new bundle data was created
      const bundleSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregateId = ?
      `).get(command.id)

      expect(bundleSnapshot).toBeNull()

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

  test('should create bundle with default values when optional fields not provided', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateBundleService(unitOfWork)
      const command: CreateBundleCommand = {
        type: 'createBundle',
        id: '01930000-0000-7000-8000-000000000001',
        correlationId: '01930000-0000-7000-8000-000000000002',
        userId: 'user-123',
        name: 'Minimal Bundle',
        description: '',
        slug: 'minimal-bundle',
        items: [{ variantId: '01930000-0000-7000-8000-000000000003', quantity: 1 }],
        price: 50,
        compareAtPrice: null,
        metaTitle: '',
        metaDescription: '',
        richDescriptionUrl: '',
        tags: [],
        collections: [],
        taxable: true,
        taxId: '',
      }

      // Act
      await service.execute(command)

      // Assert
      const snapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregateId = ?
      `).get(command.id) as any

      const payload = JSON.parse(snapshot.payload)
      expect(payload.compareAtPrice).toBeNull()
      expect(payload.metaTitle).toBe('')
      expect(payload.metaDescription).toBe('')
      expect(payload.richDescriptionUrl).toBe('')
      expect(payload.tags).toEqual([])
      expect(payload.collections).toEqual([])
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should create bundle with multiple items', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateBundleService(unitOfWork)
      const command = createValidCommand()
      command.items = [
        { variantId: '01930000-0000-7000-8000-000000000003', quantity: 1 },
        { variantId: '01930000-0000-7000-8000-000000000004', quantity: 2 },
        { variantId: '01930000-0000-7000-8000-000000000005', quantity: 3 },
        { variantId: '01930000-0000-7000-8000-000000000006', quantity: 4 },
      ]

      // Act
      await service.execute(command)

      // Assert
      const snapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregateId = ?
      `).get(command.id) as any

      const payload = JSON.parse(snapshot.payload)
      expect(payload.items).toHaveLength(4)
      expect(payload.items).toEqual(command.items)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
