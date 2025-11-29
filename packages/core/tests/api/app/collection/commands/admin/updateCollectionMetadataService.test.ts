import { describe, test, expect } from 'bun:test'
import { randomUUIDv7 } from 'bun'
import { Database } from 'bun:sqlite'
import { createTestDatabase, closeTestDatabase } from '../../../../../helpers/database'
import { TransactionBatcher } from '../../../../../../src/api/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../../../../src/api/infrastructure/unitOfWork'
import { UpdateCollectionMetadataService } from '../../../../../../src/api/app/collection/commands/admin/updateCollectionMetadataService'
import { CollectionAggregate } from '../../../../../../src/api/domain/collection/aggregate'
import { SlugAggregate } from '../../../../../../src/api/domain/slug/slugAggregate'
import type { UpdateCollectionMetadataCommand } from '../../../../../../src/api/app/collection/commands/admin/commands'

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

async function createCollectionInDatabase(
  unitOfWork: UnitOfWork,
  id: string,
  name: string,
  description: string,
  slug: string,
  status: 'draft' | 'active' | 'archived' = 'draft'
) {
  await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
    // Create collection
    const collection = CollectionAggregate.create({
      id,
      correlationId: 'test-correlation',
      userId: 'test-user',
      name,
      description,
      slug,
      productPositionsAggregateId: randomUUIDv7(),
    })

    // If active, publish it
    if (status === 'active') {
      collection.publish('test-user')
    } else if (status === 'archived') {
      collection.archive('test-user')
    }

    // Create and reserve slug
    const slugAggregate = SlugAggregate.create({
      slug,
      correlationId: 'test-correlation',
    })
    slugAggregate.reserveSlug(id, 'collection', 'test-user')

    // Save collection snapshot
    snapshotRepository.saveSnapshot({
      aggregateId: collection.id,
      correlationId: 'test-correlation',
      version: collection.version,
      payload: collection.toSnapshot(),
    })

    // Save slug snapshot
    snapshotRepository.saveSnapshot({
      aggregateId: slugAggregate.id,
      correlationId: slugAggregate.id,
      version: slugAggregate.version,
      payload: slugAggregate.toSnapshot(),
    })

    // Save events
    for (const event of collection.uncommittedEvents) {
      eventRepository.addEvent(event)
      outboxRepository.addOutboxEvent(event, { id: crypto.randomUUID() })
    }
    for (const event of slugAggregate.uncommittedEvents) {
      eventRepository.addEvent(event)
      outboxRepository.addOutboxEvent(event, { id: crypto.randomUUID() })
    }
  })
}

describe('UpdateCollectionMetadataService', () => {
  test('should successfully update metadata without slug change', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionInDatabase(
        unitOfWork,
        'collection-123',
        'Original Name',
        'Original Description',
        'original-slug'
      )

      const service = new UpdateCollectionMetadataService(unitOfWork)
      const command: UpdateCollectionMetadataCommand = {
        type: 'updateCollectionMetadata',
        id: 'collection-123',
        name: 'Updated Name',
        description: 'Updated Description',
        newSlug: 'original-slug', // Same slug
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
      `).get('collection-123') as any

      expect(updatedSnapshot).not.toBeNull()
      expect(updatedSnapshot.version).toBe(1)
      const payload = JSON.parse(updatedSnapshot.payload)
      expect(payload.name).toBe('Updated Name')
      expect(payload.description).toBe('Updated Description')
      expect(payload.slug).toBe('original-slug')

      // Verify event was saved
      const events = db.query(`
        SELECT * FROM events
        WHERE aggregateId = ? AND eventType = 'collection.metadata_updated'
      `).all('collection-123') as any[]

      expect(events.length).toBeGreaterThanOrEqual(1)

      // Verify prior and new state
      const eventPayload = JSON.parse(events[0].payload)
      expect(eventPayload.priorState.name).toBe('Original Name')
      expect(eventPayload.priorState.description).toBe('Original Description')
      expect(eventPayload.newState.name).toBe('Updated Name')
      expect(eventPayload.newState.description).toBe('Updated Description')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should update metadata with slug change for draft collection', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionInDatabase(
        unitOfWork,
        'collection-draft',
        'Draft Collection',
        'Draft Description',
        'draft-slug',
        'draft'
      )

      const service = new UpdateCollectionMetadataService(unitOfWork)
      const command: UpdateCollectionMetadataCommand = {
        type: 'updateCollectionMetadata',
        id: 'collection-draft',
        name: 'Updated Draft',
        description: 'Updated Description',
        newSlug: 'new-draft-slug',
        userId: 'user-456',
        expectedVersion: 0,
      }

      // Act
      await service.execute(command)

      // Assert - Collection updated
      const collectionSnapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregateId = ?
        ORDER BY version DESC
        LIMIT 1
      `).get('collection-draft') as any

      const collectionPayload = JSON.parse(collectionSnapshot.payload)
      expect(collectionPayload.slug).toBe('new-draft-slug')

      // Old slug should be released (not reserved)
      const oldSlugSnapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregateId = ?
        ORDER BY version DESC
        LIMIT 1
      `).get('draft-slug') as any

      const oldSlugPayload = JSON.parse(oldSlugSnapshot.payload)
      expect(oldSlugPayload.entityId).toBeNull()
      expect(oldSlugPayload.status).toBe('active')

      // New slug should be reserved
      const newSlugSnapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregateId = ?
        ORDER BY version DESC
        LIMIT 1
      `).get('new-draft-slug') as any

      const newSlugPayload = JSON.parse(newSlugSnapshot.payload)
      expect(newSlugPayload.entityId).toBe('collection-draft')
      expect(newSlugPayload.entityType).toBe('collection')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should update metadata with slug change for active collection (creates redirect)', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionInDatabase(
        unitOfWork,
        'collection-active',
        'Active Collection',
        'Active Description',
        'active-slug',
        'active'
      )

      const service = new UpdateCollectionMetadataService(unitOfWork)
      const command: UpdateCollectionMetadataCommand = {
        type: 'updateCollectionMetadata',
        id: 'collection-active',
        name: 'Updated Active',
        description: 'Updated Description',
        newSlug: 'new-active-slug',
        userId: 'user-456',
        expectedVersion: 1, // Version 1 because publish incremented it
      }

      // Act
      await service.execute(command)

      // Assert - Collection updated
      const collectionSnapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregateId = ?
        ORDER BY version DESC
        LIMIT 1
      `).get('collection-active') as any

      const collectionPayload = JSON.parse(collectionSnapshot.payload)
      expect(collectionPayload.slug).toBe('new-active-slug')

      // Old slug should redirect to new slug
      const oldSlugSnapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregateId = ?
        ORDER BY version DESC
        LIMIT 1
      `).get('active-slug') as any

      const oldSlugPayload = JSON.parse(oldSlugSnapshot.payload)
      expect(oldSlugPayload.status).toBe('redirect')
      expect(oldSlugPayload.entityId).not.toBeNull() // Still has entityId

      // New slug should be reserved
      const newSlugSnapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregateId = ?
        ORDER BY version DESC
        LIMIT 1
      `).get('new-active-slug') as any

      const newSlugPayload = JSON.parse(newSlugSnapshot.payload)
      expect(newSlugPayload.entityId).toBe('collection-active')
      expect(newSlugPayload.entityType).toBe('collection')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when collection not found', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new UpdateCollectionMetadataService(unitOfWork)
      const command: UpdateCollectionMetadataCommand = {
        type: 'updateCollectionMetadata',
        id: 'non-existent-collection',
        name: 'Updated Name',
        description: 'Updated Description',
        newSlug: 'new-slug',
        userId: 'user-456',
        expectedVersion: 0,
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow('Collection with id non-existent-collection not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error on optimistic concurrency conflict', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionInDatabase(
        unitOfWork,
        'collection-123',
        'Original Name',
        'Original Description',
        'original-slug'
      )

      const service = new UpdateCollectionMetadataService(unitOfWork)
      const command: UpdateCollectionMetadataCommand = {
        type: 'updateCollectionMetadata',
        id: 'collection-123',
        name: 'Updated Name',
        description: 'Updated Description',
        newSlug: 'original-slug',
        userId: 'user-456',
        expectedVersion: 5, // Wrong version
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow('Optimistic concurrency conflict: expected version 5 but found version 0')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when new slug is already in use', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      // Create two collections with different slugs
      await createCollectionInDatabase(
        unitOfWork,
        'collection-1',
        'Collection 1',
        'Description 1',
        'slug-1'
      )
      await createCollectionInDatabase(
        unitOfWork,
        'collection-2',
        'Collection 2',
        'Description 2',
        'slug-2'
      )

      const service = new UpdateCollectionMetadataService(unitOfWork)
      const command: UpdateCollectionMetadataCommand = {
        type: 'updateCollectionMetadata',
        id: 'collection-1',
        name: 'Updated Name',
        description: 'Updated Description',
        newSlug: 'slug-2', // Already in use by collection-2
        userId: 'user-456',
        expectedVersion: 0,
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow('Slug "slug-2" is already in use')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should increment version correctly', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionInDatabase(
        unitOfWork,
        'collection-123',
        'Original Name',
        'Original Description',
        'original-slug'
      )

      const service = new UpdateCollectionMetadataService(unitOfWork)
      const command: UpdateCollectionMetadataCommand = {
        type: 'updateCollectionMetadata',
        id: 'collection-123',
        name: 'Updated Name',
        description: 'Updated Description',
        newSlug: 'original-slug',
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
      `).get('collection-123') as any

      expect(updatedSnapshot.version).toBe(1)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should preserve other collection fields when updating metadata', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionInDatabase(
        unitOfWork,
        'collection-123',
        'Original Name',
        'Original Description',
        'original-slug',
        'active'
      )

      const service = new UpdateCollectionMetadataService(unitOfWork)
      const command: UpdateCollectionMetadataCommand = {
        type: 'updateCollectionMetadata',
        id: 'collection-123',
        name: 'Updated Name',
        description: 'Updated Description',
        newSlug: 'original-slug',
        userId: 'user-456',
        expectedVersion: 1, // Version 1 because of publish
      }

      // Act
      await service.execute(command)

      // Assert
      const updatedSnapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregateId = ?
        ORDER BY version DESC
        LIMIT 1
      `).get('collection-123') as any

      const payload = JSON.parse(updatedSnapshot.payload)
      expect(payload.status).toBe('active') // Status should be preserved
      expect(payload.id).toBe('collection-123') // ID should be preserved
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should handle multiple sequential updates', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionInDatabase(
        unitOfWork,
        'collection-123',
        'Original Name',
        'Original Description',
        'original-slug'
      )

      const service = new UpdateCollectionMetadataService(unitOfWork)

      // Act - First update
      await service.execute({
        type: 'updateCollectionMetadata',
        id: 'collection-123',
        name: 'Name V1',
        description: 'Description V1',
        newSlug: 'original-slug',
        userId: 'user-1',
        expectedVersion: 0,
      })

      // Act - Second update
      await service.execute({
        type: 'updateCollectionMetadata',
        id: 'collection-123',
        name: 'Name V2',
        description: 'Description V2',
        newSlug: 'original-slug',
        userId: 'user-2',
        expectedVersion: 1,
      })

      // Assert
      const finalSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregateId = ?
        ORDER BY version DESC
        LIMIT 1
      `).get('collection-123') as any

      expect(finalSnapshot.version).toBe(2)
      const payload = JSON.parse(finalSnapshot.payload)
      expect(payload.name).toBe('Name V2')
      expect(payload.description).toBe('Description V2')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should rollback on error', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionInDatabase(
        unitOfWork,
        'collection-123',
        'Original Name',
        'Original Description',
        'original-slug'
      )

      // Get initial state
      const initialSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregateId = ?
      `).get('collection-123') as any

      const service = new UpdateCollectionMetadataService(unitOfWork)
      const command: UpdateCollectionMetadataCommand = {
        type: 'updateCollectionMetadata',
        id: 'collection-123',
        name: 'Updated Name',
        description: 'Updated Description',
        newSlug: 'original-slug',
        userId: 'user-456',
        expectedVersion: 999, // Wrong version
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow()

      // Verify state unchanged after error
      const finalSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregateId = ?
      `).get('collection-123') as any

      expect(finalSnapshot.version).toBe(initialSnapshot.version)
      const payload = JSON.parse(finalSnapshot.payload)
      expect(payload.name).toBe('Original Name')
      expect(payload.description).toBe('Original Description')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
