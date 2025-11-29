import { describe, test, expect } from 'bun:test'
import { createTestDatabase, closeTestDatabase } from '../../../../../helpers/database'
import { TransactionBatcher } from '../../../../../../src/api/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../../../../src/api/infrastructure/unitOfWork'
import { CreateBundleService } from '../../../../../../src/api/app/bundle/commands/admin/createBundleService'
import { ChangeBundleSlugService } from '../../../../../../src/api/app/bundle/commands/admin/changeBundleSlugService'
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

function createValidBundleCommand(): CreateBundleCommand {
  return {
    type: 'createBundle',
    id: '01930000-0000-7000-8000-000000000001',
    correlationId: '01930000-0000-7000-8000-000000000002',
    userId: 'user-123',
    name: 'Test Bundle',
    description: 'A test bundle',
    slug: 'test-bundle',
    items: [{ variantId: '01930000-0000-7000-8000-000000000003', quantity: 2 }],
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

async function createBundleInDatabase(unitOfWork: UnitOfWork, command: CreateBundleCommand) {
  const createService = new CreateBundleService(unitOfWork)
  await createService.execute(command)
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

describe('ChangeBundleSlugService', () => {
  test('should successfully change bundle slug', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      const service = new ChangeBundleSlugService(unitOfWork)
      await service.execute({
        type: 'changeBundleSlug',
        id: createCommand.id,
        userId: 'user-123',
        newSlug: 'new-bundle-slug',
        expectedVersion: 0,
      })

      // Verify bundle snapshot has new slug
      const bundleSnapshot = db.query(`
        SELECT payload, version FROM snapshots WHERE aggregateId = ?
      `).get(createCommand.id) as any

      expect(bundleSnapshot.version).toBe(1)
      const bundlePayload = JSON.parse(bundleSnapshot.payload)
      expect(bundlePayload.slug).toBe('new-bundle-slug')

      // Verify new slug is reserved
      const newSlugSnapshot = db.query(`
        SELECT payload FROM snapshots WHERE aggregateId = ?
      `).get('new-bundle-slug') as any

      expect(newSlugSnapshot).not.toBeNull()
      const newSlugPayload = JSON.parse(newSlugSnapshot.payload)
      expect(newSlugPayload.entityId).toBe(createCommand.id)
      expect(newSlugPayload.status).toBe('active')

      // Verify old slug is marked as redirect
      const oldSlugSnapshot = db.query(`
        SELECT payload FROM snapshots WHERE aggregateId = ?
      `).get(createCommand.slug) as any

      expect(oldSlugSnapshot).not.toBeNull()
      const oldSlugPayload = JSON.parse(oldSlugSnapshot.payload)
      expect(oldSlugPayload.status).toBe('redirect')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when bundle not found', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const service = new ChangeBundleSlugService(unitOfWork)

      await expect(service.execute({
        type: 'changeBundleSlug',
        id: '01930000-0000-7000-8000-000000000099',
        userId: 'user-123',
        newSlug: 'new-slug',
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error on version mismatch', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      const service = new ChangeBundleSlugService(unitOfWork)

      await expect(service.execute({
        type: 'changeBundleSlug',
        id: createCommand.id,
        userId: 'user-123',
        newSlug: 'new-slug',
        expectedVersion: 5,
      })).rejects.toThrow('concurrency')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when new slug is same as current', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      const service = new ChangeBundleSlugService(unitOfWork)

      await expect(service.execute({
        type: 'changeBundleSlug',
        id: createCommand.id,
        userId: 'user-123',
        newSlug: createCommand.slug, // Same slug
        expectedVersion: 0,
      })).rejects.toThrow('New slug must be different from current slug')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when new slug is already in use', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      // Reserve the new slug for another entity
      await reserveSlugInDatabase(unitOfWork, 'taken-slug', 'other-bundle-id', 'user-456')

      const service = new ChangeBundleSlugService(unitOfWork)

      await expect(service.execute({
        type: 'changeBundleSlug',
        id: createCommand.id,
        userId: 'user-123',
        newSlug: 'taken-slug',
        expectedVersion: 0,
      })).rejects.toThrow('Slug "taken-slug" is already in use')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should add all events to outbox', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      const initialOutboxCount = db.query(`
        SELECT COUNT(*) as count FROM outbox
      `).get() as any

      const service = new ChangeBundleSlugService(unitOfWork)
      await service.execute({
        type: 'changeBundleSlug',
        id: createCommand.id,
        userId: 'user-123',
        newSlug: 'new-bundle-slug',
        expectedVersion: 0,
      })

      const finalOutboxCount = db.query(`
        SELECT COUNT(*) as count FROM outbox
      `).get() as any

      // Should have 3 new events: bundle slug changed, new slug reserved, old slug redirect
      expect(finalOutboxCount.count).toBe(initialOutboxCount.count + 3)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should create new slug snapshot when slug does not exist', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      // Verify new slug doesn't exist yet
      const newSlugBefore = db.query(`
        SELECT * FROM snapshots WHERE aggregateId = ?
      `).get('brand-new-slug')
      expect(newSlugBefore).toBeNull()

      const service = new ChangeBundleSlugService(unitOfWork)
      await service.execute({
        type: 'changeBundleSlug',
        id: createCommand.id,
        userId: 'user-123',
        newSlug: 'brand-new-slug',
        expectedVersion: 0,
      })

      // Verify new slug now exists
      const newSlugAfter = db.query(`
        SELECT payload FROM snapshots WHERE aggregateId = ?
      `).get('brand-new-slug') as any

      expect(newSlugAfter).not.toBeNull()
      const payload = JSON.parse(newSlugAfter.payload)
      expect(payload.entityId).toBe(createCommand.id)
      expect(payload.entityType).toBe('bundle')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should update all three snapshots correctly', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      const service = new ChangeBundleSlugService(unitOfWork)
      await service.execute({
        type: 'changeBundleSlug',
        id: createCommand.id,
        userId: 'user-123',
        newSlug: 'new-slug',
        expectedVersion: 0,
      })

      // Check bundle snapshot
      const bundleSnapshot = db.query(`
        SELECT payload FROM snapshots WHERE aggregateId = ?
      `).get(createCommand.id) as any
      const bundlePayload = JSON.parse(bundleSnapshot.payload)
      expect(bundlePayload.slug).toBe('new-slug')

      // Check new slug snapshot
      const newSlugSnapshot = db.query(`
        SELECT payload FROM snapshots WHERE aggregateId = ?
      `).get('new-slug') as any
      const newSlugPayload = JSON.parse(newSlugSnapshot.payload)
      expect(newSlugPayload.entityId).toBe(createCommand.id)
      expect(newSlugPayload.status).toBe('active')

      // Check old slug snapshot
      const oldSlugSnapshot = db.query(`
        SELECT payload FROM snapshots WHERE aggregateId = ?
      `).get(createCommand.slug) as any
      const oldSlugPayload = JSON.parse(oldSlugSnapshot.payload)
      expect(oldSlugPayload.status).toBe('redirect')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
