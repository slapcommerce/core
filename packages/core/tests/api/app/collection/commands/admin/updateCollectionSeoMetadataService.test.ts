import { describe, test, expect } from 'bun:test'
import { randomUUIDv7 } from 'bun'
import { Database } from 'bun:sqlite'
import { createTestDatabase, closeTestDatabase } from '../../../../../helpers/database'
import { TransactionBatcher } from '../../../../../../src/api/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../../../../src/api/infrastructure/unitOfWork'
import { UpdateCollectionSeoMetadataService } from '../../../../../../src/api/app/collection/commands/admin/updateCollectionSeoMetadataService'
import { CollectionAggregate } from '../../../../../../src/api/domain/collection/aggregate'
import type { UpdateCollectionSeoMetadataCommand } from '../../../../../../src/api/app/collection/commands/admin/commands'

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
  name: string
) {
  await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
    const collection = CollectionAggregate.create({
      id,
      correlationId: 'test-correlation',
      userId: 'test-user',
      name,
      description: 'Test description',
      slug: `${id}-slug`,
      productPositionsAggregateId: randomUUIDv7(),
    })

    snapshotRepository.saveSnapshot({
      aggregateId: collection.id,
      correlationId: 'test-correlation',
      version: collection.version,
      payload: collection.toSnapshot(),
    })

    for (const event of collection.uncommittedEvents) {
      eventRepository.addEvent(event)
      outboxRepository.addOutboxEvent(event, { id: crypto.randomUUID() })
    }
  })
}

describe('UpdateCollectionSeoMetadataService', () => {
  test('should successfully update SEO metadata', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionInDatabase(unitOfWork, 'collection-123', 'Test Collection')

      const service = new UpdateCollectionSeoMetadataService(unitOfWork)
      const command: UpdateCollectionSeoMetadataCommand = {
        type: 'updateCollectionSeoMetadata',
        id: 'collection-123',
        metaTitle: 'New Meta Title',
        metaDescription: 'New Meta Description',
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
      expect(payload.metaTitle).toBe('New Meta Title')
      expect(payload.metaDescription).toBe('New Meta Description')

      // Verify event was saved
      const events = db.query(`
        SELECT * FROM events
        WHERE aggregateId = ? AND eventType = 'collection.seo_metadata_updated'
      `).all('collection-123') as any[]

      expect(events.length).toBeGreaterThanOrEqual(1)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when collection not found', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new UpdateCollectionSeoMetadataService(unitOfWork)
      const command: UpdateCollectionSeoMetadataCommand = {
        type: 'updateCollectionSeoMetadata',
        id: 'non-existent-collection',
        metaTitle: 'New Meta Title',
        metaDescription: 'New Meta Description',
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
      await createCollectionInDatabase(unitOfWork, 'collection-123', 'Test Collection')

      const service = new UpdateCollectionSeoMetadataService(unitOfWork)
      const command: UpdateCollectionSeoMetadataCommand = {
        type: 'updateCollectionSeoMetadata',
        id: 'collection-123',
        metaTitle: 'New Meta Title',
        metaDescription: 'New Meta Description',
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

  test('should increment version correctly', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionInDatabase(unitOfWork, 'collection-123', 'Test Collection')

      const service = new UpdateCollectionSeoMetadataService(unitOfWork)
      const command: UpdateCollectionSeoMetadataCommand = {
        type: 'updateCollectionSeoMetadata',
        id: 'collection-123',
        metaTitle: 'New Meta Title',
        metaDescription: 'New Meta Description',
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

  test('should save event with correct priorState and newState', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionInDatabase(unitOfWork, 'collection-123', 'Test Collection')

      const service = new UpdateCollectionSeoMetadataService(unitOfWork)
      const command: UpdateCollectionSeoMetadataCommand = {
        type: 'updateCollectionSeoMetadata',
        id: 'collection-123',
        metaTitle: 'New Meta Title',
        metaDescription: 'New Meta Description',
        userId: 'user-456',
        expectedVersion: 0,
      }

      // Act
      await service.execute(command)

      // Assert
      const event = db.query(`
        SELECT payload FROM events
        WHERE aggregateId = ? AND eventType = 'collection.seo_metadata_updated'
      `).get('collection-123') as any

      const eventPayload = JSON.parse(event.payload)
      expect(eventPayload.priorState).toBeDefined()
      expect(eventPayload.newState.metaTitle).toBe('New Meta Title')
      expect(eventPayload.newState.metaDescription).toBe('New Meta Description')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should preserve other collection fields when updating SEO metadata', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionInDatabase(unitOfWork, 'collection-123', 'Test Collection')

      const service = new UpdateCollectionSeoMetadataService(unitOfWork)
      const command: UpdateCollectionSeoMetadataCommand = {
        type: 'updateCollectionSeoMetadata',
        id: 'collection-123',
        metaTitle: 'New Meta Title',
        metaDescription: 'New Meta Description',
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
      `).get('collection-123') as any

      const payload = JSON.parse(updatedSnapshot.payload)
      expect(payload.name).toBe('Test Collection')
      expect(payload.description).toBe('Test description')
      expect(payload.slug).toBe('collection-123-slug')
      expect(payload.status).toBe('draft')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should handle multiple sequential updates', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionInDatabase(unitOfWork, 'collection-123', 'Test Collection')

      const service = new UpdateCollectionSeoMetadataService(unitOfWork)

      // Act - First update
      await service.execute({
        type: 'updateCollectionSeoMetadata',
        id: 'collection-123',
        metaTitle: 'Meta Title V1',
        metaDescription: 'Meta Description V1',
        userId: 'user-1',
        expectedVersion: 0,
      })

      // Act - Second update
      await service.execute({
        type: 'updateCollectionSeoMetadata',
        id: 'collection-123',
        metaTitle: 'Meta Title V2',
        metaDescription: 'Meta Description V2',
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
      expect(payload.metaTitle).toBe('Meta Title V2')
      expect(payload.metaDescription).toBe('Meta Description V2')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should rollback on error', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionInDatabase(unitOfWork, 'collection-123', 'Test Collection')

      const initialSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregateId = ?
      `).get('collection-123') as any

      const service = new UpdateCollectionSeoMetadataService(unitOfWork)
      const command: UpdateCollectionSeoMetadataCommand = {
        type: 'updateCollectionSeoMetadata',
        id: 'collection-123',
        metaTitle: 'New Meta Title',
        metaDescription: 'New Meta Description',
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
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
