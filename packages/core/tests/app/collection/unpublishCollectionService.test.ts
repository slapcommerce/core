import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDatabase, closeTestDatabase } from '../../helpers/database'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { UnpublishCollectionService } from '../../../src/app/collection/unpublishCollectionService'
import { CollectionAggregate } from '../../../src/domain/collection/aggregate'
import type { UnpublishCollectionCommand } from '../../../src/app/collection/commands'

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
  status: 'draft' | 'active' | 'archived' = 'draft'
) {
  await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
    const collection = CollectionAggregate.create({
      id,
      correlationId: 'test-correlation',
      userId: 'test-user',
      name,
      description: 'Test description',
      slug: `${id}-slug`,
    })

    if (status === 'active') {
      collection.publish('test-user')
    } else if (status === 'archived') {
      collection.archive('test-user')
    }

    snapshotRepository.saveSnapshot({
      aggregate_id: collection.id,
      correlation_id: 'test-correlation',
      version: collection.version,
      payload: collection.toSnapshot(),
    })

    for (const event of collection.uncommittedEvents) {
      eventRepository.addEvent(event)
      outboxRepository.addOutboxEvent(event, { id: crypto.randomUUID() })
    }
  })
}

describe('UnpublishCollectionService', () => {
  test('should successfully unpublish active collection', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionInDatabase(unitOfWork, 'collection-123', 'Test Collection', 'active')

      const service = new UnpublishCollectionService(unitOfWork)
      const command: UnpublishCollectionCommand = {
        type: 'unpublishCollection',
        id: 'collection-123',
        userId: 'user-456',
        expectedVersion: 1, // Version 1 after publish
      }

      // Act
      await service.execute(command)

      // Assert - Verify snapshot was updated
      const updatedSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregate_id = ?
        ORDER BY version DESC
        LIMIT 1
      `).get('collection-123') as any

      expect(updatedSnapshot).not.toBeNull()
      expect(updatedSnapshot.version).toBe(2)
      const payload = JSON.parse(updatedSnapshot.payload)
      expect(payload.status).toBe('draft')
      expect(payload.publishedAt).toBeNull()

      // Verify event was saved
      const events = db.query(`
        SELECT * FROM events
        WHERE aggregate_id = ? AND event_type = 'collection.unpublished'
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
      const service = new UnpublishCollectionService(unitOfWork)
      const command: UnpublishCollectionCommand = {
        type: 'unpublishCollection',
        id: 'non-existent-collection',
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
      await createCollectionInDatabase(unitOfWork, 'collection-123', 'Test Collection', 'active')

      const service = new UnpublishCollectionService(unitOfWork)
      const command: UnpublishCollectionCommand = {
        type: 'unpublishCollection',
        id: 'collection-123',
        userId: 'user-456',
        expectedVersion: 5, // Wrong version
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow('Optimistic concurrency conflict: expected version 5 but found version 1')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when collection is already draft', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionInDatabase(unitOfWork, 'collection-123', 'Test Collection', 'draft')

      const service = new UnpublishCollectionService(unitOfWork)
      const command: UnpublishCollectionCommand = {
        type: 'unpublishCollection',
        id: 'collection-123',
        userId: 'user-456',
        expectedVersion: 0,
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow()
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when collection is archived', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionInDatabase(unitOfWork, 'collection-123', 'Test Collection', 'archived')

      const service = new UnpublishCollectionService(unitOfWork)
      const command: UnpublishCollectionCommand = {
        type: 'unpublishCollection',
        id: 'collection-123',
        userId: 'user-456',
        expectedVersion: 1,
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow()
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should increment version correctly', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionInDatabase(unitOfWork, 'collection-123', 'Test Collection', 'active')

      const service = new UnpublishCollectionService(unitOfWork)
      const command: UnpublishCollectionCommand = {
        type: 'unpublishCollection',
        id: 'collection-123',
        userId: 'user-456',
        expectedVersion: 1,
      }

      // Act
      await service.execute(command)

      // Assert
      const updatedSnapshot = db.query(`
        SELECT version FROM snapshots
        WHERE aggregate_id = ?
        ORDER BY version DESC
        LIMIT 1
      `).get('collection-123') as any

      expect(updatedSnapshot.version).toBe(2)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should preserve other collection fields when unpublishing', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionInDatabase(unitOfWork, 'collection-123', 'Test Collection', 'active')

      const service = new UnpublishCollectionService(unitOfWork)
      const command: UnpublishCollectionCommand = {
        type: 'unpublishCollection',
        id: 'collection-123',
        userId: 'user-456',
        expectedVersion: 1,
      }

      // Act
      await service.execute(command)

      // Assert
      const updatedSnapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregate_id = ?
        ORDER BY version DESC
        LIMIT 1
      `).get('collection-123') as any

      const payload = JSON.parse(updatedSnapshot.payload)
      expect(payload.name).toBe('Test Collection')
      expect(payload.description).toBe('Test description')
      expect(payload.slug).toBe('collection-123-slug')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should rollback on error', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionInDatabase(unitOfWork, 'collection-123', 'Test Collection', 'active')

      const initialSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregate_id = ?
      `).get('collection-123') as any

      const service = new UnpublishCollectionService(unitOfWork)
      const command: UnpublishCollectionCommand = {
        type: 'unpublishCollection',
        id: 'collection-123',
        userId: 'user-456',
        expectedVersion: 999, // Wrong version
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow()

      // Verify state unchanged after error
      const finalSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregate_id = ?
      `).get('collection-123') as any

      expect(finalSnapshot.version).toBe(initialSnapshot.version)
      const payload = JSON.parse(finalSnapshot.payload)
      expect(payload.status).toBe('active')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should set correct access level', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new UnpublishCollectionService(unitOfWork)

      // Assert
      expect(service.accessLevel).toBe('admin')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should add outbox event when unpublishing', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionInDatabase(unitOfWork, 'collection-123', 'Test Collection', 'active')

      const service = new UnpublishCollectionService(unitOfWork)
      const command: UnpublishCollectionCommand = {
        type: 'unpublishCollection',
        id: 'collection-123',
        userId: 'user-456',
        expectedVersion: 1,
      }

      // Act
      await service.execute(command)

      // Assert
      const outboxEvents = db.query(`
        SELECT * FROM outbox
        WHERE aggregate_id = ? AND event_type = 'collection.unpublished'
      `).all('collection-123') as any[]

      expect(outboxEvents.length).toBeGreaterThanOrEqual(1)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
