import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDatabase, closeTestDatabase } from '../../../../../helpers/database'
import { TransactionBatcher } from '../../../../../../src/api/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../../../../src/api/infrastructure/unitOfWork'
import { CreateCollectionService } from '../../../../../../src/api/app/collection/commands/admin/createCollectionService'
import { SlugAggregate } from '../../../../../../src/api/domain/slug/slugAggregate'
import type { CreateCollectionCommand } from '../../../../../../src/api/app/collection/commands/admin/commands'

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

async function reserveSlugInDatabase(unitOfWork: UnitOfWork, slug: string, resourceId: string) {
  await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
    const slugAggregate = SlugAggregate.create({
      slug,
      correlationId: 'test-correlation',
    })
    slugAggregate.reserveSlug(resourceId, 'collection', 'test-user')

    // Save snapshot
    snapshotRepository.saveSnapshot({
      aggregateId: slugAggregate.id,
      correlationId: 'test-correlation',
      version: slugAggregate.version,
      payload: slugAggregate.toSnapshot(),
    })

    // Save events
    for (const event of slugAggregate.uncommittedEvents) {
      eventRepository.addEvent(event)
      outboxRepository.addOutboxEvent(event, { id: crypto.randomUUID() })
    }
  })
}

describe('CreateCollectionService', () => {
  test('should successfully create collection with available slug', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateCollectionService(unitOfWork)
      const command: CreateCollectionCommand = {
        type: 'createCollection',
        id: 'collection-123',
        correlationId: 'correlation-123',
        userId: 'user-123',
        name: 'Test Collection',
        description: 'A test collection',
        slug: 'test-collection',
      }

      // Act
      await service.execute(command)

      // Assert - Verify collection snapshot was created
      const collectionSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregateId = ?
        ORDER BY version DESC
        LIMIT 1
      `).get(command.id) as any

      expect(collectionSnapshot).not.toBeNull()
      expect(collectionSnapshot.version).toBe(0)
      const collectionPayload = JSON.parse(collectionSnapshot.payload)
      expect(collectionPayload.id).toBe(command.id)
      expect(collectionPayload.name).toBe(command.name)
      expect(collectionPayload.description).toBe(command.description)
      expect(collectionPayload.slug).toBe(command.slug)
      expect(collectionPayload.status).toBe('draft')

      // Verify slug snapshot was created
      const slugSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregateId = ?
        ORDER BY version DESC
        LIMIT 1
      `).get(command.slug) as any

      expect(slugSnapshot).not.toBeNull()
      expect(slugSnapshot.version).toBe(1) // Version 0 for create, version 1 for reserve
      const slugPayload = JSON.parse(slugSnapshot.payload)
      expect(slugPayload.slug).toBe(command.slug)
      expect(slugPayload.entityId).toBe(command.id)
      expect(slugPayload.entityType).toBe('collection')

      // Verify collection events were saved
      const collectionEvents = db.query(`
        SELECT * FROM events
        WHERE aggregateId = ?
      `).all(command.id) as any[]

      expect(collectionEvents.length).toBeGreaterThanOrEqual(1)
      expect(collectionEvents[0].eventType).toBe('collection.created')

      // Verify slug events were saved
      const slugEvents = db.query(`
        SELECT * FROM events
        WHERE aggregateId = ?
      `).all(command.slug) as any[]

      expect(slugEvents.length).toBeGreaterThanOrEqual(1) // reserved event

      // Verify outbox entries were created for both aggregates
      const collectionOutboxEvents = db.query(`
        SELECT * FROM outbox
        WHERE aggregateId = ?
      `).all(command.id) as any[]

      expect(collectionOutboxEvents.length).toBeGreaterThanOrEqual(1)

      const slugOutboxEvents = db.query(`
        SELECT * FROM outbox
        WHERE aggregateId = ?
      `).all(command.slug) as any[]

      expect(slugOutboxEvents.length).toBeGreaterThanOrEqual(1)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when slug is already in use', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      // Reserve the slug first
      await reserveSlugInDatabase(unitOfWork, 'taken-slug', 'existing-resource')

      const service = new CreateCollectionService(unitOfWork)
      const command: CreateCollectionCommand = {
        type: 'createCollection',
        id: 'collection-456',
        correlationId: 'correlation-456',
        userId: 'user-456',
        name: 'Another Collection',
        description: 'Another test collection',
        slug: 'taken-slug',
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow('Slug "taken-slug" is already in use')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should rollback on error', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      // Reserve the slug first
      await reserveSlugInDatabase(unitOfWork, 'taken-slug', 'existing-resource')

      // Get initial state
      const initialSnapshotCount = db.query(`
        SELECT COUNT(*) as count FROM snapshots
      `).get() as any

      const initialEventCount = db.query(`
        SELECT COUNT(*) as count FROM events
      `).get() as any

      const service = new CreateCollectionService(unitOfWork)
      const command: CreateCollectionCommand = {
        type: 'createCollection',
        id: 'collection-789',
        correlationId: 'correlation-789',
        userId: 'user-789',
        name: 'Failed Collection',
        description: 'This should fail',
        slug: 'taken-slug', // Already in use
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow()

      // Verify no new snapshots or events were created
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

  test('should create collection with correct initial status as draft', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateCollectionService(unitOfWork)
      const command: CreateCollectionCommand = {
        type: 'createCollection',
        id: 'collection-status-test',
        correlationId: 'correlation-status',
        userId: 'user-status',
        name: 'Status Test Collection',
        description: 'Testing initial status',
        slug: 'status-test-collection',
      }

      // Act
      await service.execute(command)

      // Assert
      const snapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregateId = ?
      `).get(command.id) as any

      const payload = JSON.parse(snapshot.payload)
      expect(payload.status).toBe('draft')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should save event with correct data structure', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateCollectionService(unitOfWork)
      const command: CreateCollectionCommand = {
        type: 'createCollection',
        id: 'collection-event-test',
        correlationId: 'correlation-event',
        userId: 'user-event',
        name: 'Event Test Collection',
        description: 'Testing event structure',
        slug: 'event-test-collection',
      }

      // Act
      await service.execute(command)

      // Assert
      const event = db.query(`
        SELECT * FROM events
        WHERE aggregateId = ? AND eventType = 'collection.created'
      `).get(command.id) as any

      expect(event).not.toBeNull()
      expect(event.aggregateId).toBe(command.id)
      expect(event.correlationId).toBe(command.correlationId)
      expect(event.version).toBe(0)

      const eventPayload = JSON.parse(event.payload)
      expect(eventPayload.newState.name).toBe(command.name)
      expect(eventPayload.newState.description).toBe(command.description)
      expect(eventPayload.newState.slug).toBe(command.slug)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should create unique collection IDs for different collections', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateCollectionService(unitOfWork)

      // Act - Create first collection
      await service.execute({
        type: 'createCollection',
        id: 'collection-1',
        correlationId: 'correlation-1',
        userId: 'user-1',
        name: 'Collection 1',
        description: 'First collection',
        slug: 'collection-1',
      })

      // Act - Create second collection
      await service.execute({
        type: 'createCollection',
        id: 'collection-2',
        correlationId: 'correlation-2',
        userId: 'user-2',
        name: 'Collection 2',
        description: 'Second collection',
        slug: 'collection-2',
      })

      // Assert
      const snapshots = db.query(`
        SELECT aggregateId FROM snapshots
        WHERE aggregateId LIKE 'collection-%'
      `).all() as any[]

      const collectionIds = snapshots.map(s => s.aggregateId)
      expect(collectionIds).toContain('collection-1')
      expect(collectionIds).toContain('collection-2')
      expect(new Set(collectionIds).size).toBe(2) // Ensure they're unique
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
