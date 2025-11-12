import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { CreateCollectionService } from '../../../src/app/collection/createCollectionService'
import { ArchiveCollectionService } from '../../../src/app/collection/archiveCollectionService'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { schemas } from '../../../src/infrastructure/schemas'
import { ProjectionService } from '../../../src/infrastructure/projectionService'
import type { CreateCollectionCommand } from '../../../src/app/collection/commands'
import type { ArchiveCollectionCommand } from '../../../src/app/collection/commands'

function createValidCreateCommand(overrides?: Partial<CreateCollectionCommand>): CreateCollectionCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    correlationId: overrides?.correlationId ?? randomUUIDv7(),
    name: overrides?.name ?? 'Test Collection',
    description: overrides?.description ?? null,
    slug: overrides?.slug ?? 'test-collection',
  }
}

function createArchiveCommand(overrides?: Partial<ArchiveCollectionCommand>): ArchiveCollectionCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    expectedVersion: overrides?.expectedVersion ?? 0,
  }
}

describe('ArchiveCollectionService', () => {
  test('should successfully archive an active collection', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    const unitOfWork = new UnitOfWork(db, batcher)
    const projectionService = new ProjectionService()
    const createService = new CreateCollectionService(unitOfWork, projectionService)
    const archiveService = new ArchiveCollectionService(unitOfWork, projectionService)
    
    const createCommand = createValidCreateCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush to ensure snapshot is persisted
    await new Promise(resolve => setTimeout(resolve, 100))

    const archiveCommand = createArchiveCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })

    // Act
    await archiveService.execute(archiveCommand)

    // Assert - Verify archived event was saved
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(createCommand.id) as any[]
    expect(events.length).toBe(2)
    expect(events[0]!.event_type).toBe('collection.created')
    expect(events[1]!.event_type).toBe('collection.archived')
    expect(events[1]!.version).toBe(1)
    expect(events[1]!.correlation_id).toBe(createCommand.correlationId)

    // Assert - Verify snapshot was updated
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(snapshot).toBeDefined()
    expect(snapshot.version).toBe(1)
    
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.status).toBe('archived')

    // Assert - Verify outbox event was saved
    const outboxEvents = db.query('SELECT * FROM outbox WHERE aggregate_id = ? ORDER BY event_type').all(createCommand.id) as any[]
    expect(outboxEvents.length).toBe(2)
    const archivedOutboxEvent = outboxEvents.find(e => e.event_type === 'collection.archived')
    expect(archivedOutboxEvent).toBeDefined()
    expect(archivedOutboxEvent!.status).toBe('pending')

    batcher.stop()
    db.close()
  })

  test('should throw error when collection does not exist', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    const unitOfWork = new UnitOfWork(db, batcher)
    const projectionService = new ProjectionService()
    const archiveService = new ArchiveCollectionService(unitOfWork, projectionService)
    const archiveCommand = createArchiveCommand()

    // Act & Assert
    await expect(archiveService.execute(archiveCommand)).rejects.toThrow('Collection with id')

    // Assert - Verify nothing was saved
    const eventCount = db.query('SELECT COUNT(*) as count FROM events').get() as { count: number }
    expect(eventCount.count).toBe(0)

    batcher.stop()
    db.close()
  })

  test('should throw error when collection is already archived', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    const unitOfWork = new UnitOfWork(db, batcher)
    const projectionService = new ProjectionService()
    const createService = new CreateCollectionService(unitOfWork, projectionService)
    const archiveService = new ArchiveCollectionService(unitOfWork, projectionService)
    
    const createCommand = createValidCreateCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const archiveCommand1 = createArchiveCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })
    await archiveService.execute(archiveCommand1)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const archiveCommand2 = createArchiveCommand({
      id: createCommand.id,
      expectedVersion: 1,
    })

    // Act & Assert
    await expect(archiveService.execute(archiveCommand2)).rejects.toThrow('already archived')

    // Assert - Verify only one archived event exists
    const archivedEvents = db.query("SELECT * FROM events WHERE aggregate_id = ? AND event_type = 'collection.archived'").all(createCommand.id) as any[]
    expect(archivedEvents.length).toBe(1)

    batcher.stop()
    db.close()
  })

  test('should load collection from snapshot and apply archive', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    const unitOfWork = new UnitOfWork(db, batcher)
    const projectionService = new ProjectionService()
    const createService = new CreateCollectionService(unitOfWork, projectionService)
    const archiveService = new ArchiveCollectionService(unitOfWork, projectionService)
    
    const createCommand = createValidCreateCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const archiveCommand = createArchiveCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })

    // Act
    await archiveService.execute(archiveCommand)

    // Assert - Verify archived event was saved
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(createCommand.id) as any[]
    expect(events.length).toBe(2)
    expect(events[1]!.event_type).toBe('collection.archived')

    // Assert - Verify snapshot was updated
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.status).toBe('archived')
    expect(snapshot.version).toBe(1)

    batcher.stop()
    db.close()
  })

  test('should update snapshot version after archiving', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    const unitOfWork = new UnitOfWork(db, batcher)
    const projectionService = new ProjectionService()
    const createService = new CreateCollectionService(unitOfWork, projectionService)
    const archiveService = new ArchiveCollectionService(unitOfWork, projectionService)
    
    const createCommand = createValidCreateCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify initial snapshot version
    const initialSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(initialSnapshot.version).toBe(0)

    const archiveCommand = createArchiveCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })

    // Act
    await archiveService.execute(archiveCommand)

    // Assert - Verify snapshot version was incremented
    const updatedSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(updatedSnapshot.version).toBe(1)

    batcher.stop()
    db.close()
  })

  test('should verify updatedAt timestamp updated', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    const unitOfWork = new UnitOfWork(db, batcher)
    const projectionService = new ProjectionService()
    const createService = new CreateCollectionService(unitOfWork, projectionService)
    const archiveService = new ArchiveCollectionService(unitOfWork, projectionService)
    
    const createCommand = createValidCreateCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Get initial updatedAt
    const initialSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const initialPayload = JSON.parse(initialSnapshot.payload)
    const initialUpdatedAt = new Date(initialPayload.updatedAt)

    // Wait a bit to ensure time difference
    await new Promise(resolve => setTimeout(resolve, 10))

    const archiveCommand = createArchiveCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })

    // Act
    await archiveService.execute(archiveCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - Verify updatedAt was updated
    const updatedSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const updatedPayload = JSON.parse(updatedSnapshot.payload)
    const updatedUpdatedAt = new Date(updatedPayload.updatedAt)
    expect(updatedUpdatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime())

    batcher.stop()
    db.close()
  })

  test('should handle transaction rollback on error', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    const unitOfWork = new UnitOfWork(db, batcher)
    const projectionService = new ProjectionService()
    const archiveService = new ArchiveCollectionService(unitOfWork, projectionService)
    const archiveCommand = createArchiveCommand()

    // Act & Assert - This should fail because collection doesn't exist
    await expect(archiveService.execute(archiveCommand)).rejects.toThrow()

    // Assert - Verify nothing was persisted
    const eventCount = db.query('SELECT COUNT(*) as count FROM events').get() as { count: number }
    expect(eventCount.count).toBe(0)

    const snapshotCount = db.query('SELECT COUNT(*) as count FROM snapshots').get() as { count: number }
    expect(snapshotCount.count).toBe(0)

    const outboxCount = db.query('SELECT COUNT(*) as count FROM outbox').get() as { count: number }
    expect(outboxCount.count).toBe(0)

    batcher.stop()
    db.close()
  })

  test('should throw error when expected version does not match snapshot version', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    const unitOfWork = new UnitOfWork(db, batcher)
    const projectionService = new ProjectionService()
    const createService = new CreateCollectionService(unitOfWork, projectionService)
    const archiveService = new ArchiveCollectionService(unitOfWork, projectionService)
    
    const createCommand = createValidCreateCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify snapshot version is 0
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(snapshot.version).toBe(0)

    const archiveCommand = createArchiveCommand({
      id: createCommand.id,
      expectedVersion: 5, // Wrong version - should be 0
    })

    // Act & Assert
    await expect(archiveService.execute(archiveCommand)).rejects.toThrow('Optimistic concurrency conflict: expected version 5 but found version 0')

    // Assert - Verify nothing was persisted (no archived event)
    const archivedEvents = db.query("SELECT * FROM events WHERE aggregate_id = ? AND event_type = 'collection.archived'").all(createCommand.id) as any[]
    expect(archivedEvents.length).toBe(0)

    // Assert - Verify snapshot version was not changed
    const updatedSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(updatedSnapshot.version).toBe(0)

    batcher.stop()
    db.close()
  })

  test('should succeed when expected version matches snapshot version', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    const unitOfWork = new UnitOfWork(db, batcher)
    const projectionService = new ProjectionService()
    const createService = new CreateCollectionService(unitOfWork, projectionService)
    const archiveService = new ArchiveCollectionService(unitOfWork, projectionService)
    
    const createCommand = createValidCreateCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Get the current snapshot version
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(snapshot.version).toBe(0)

    const archiveCommand = createArchiveCommand({
      id: createCommand.id,
      expectedVersion: 0, // Correct version
    })

    // Act
    await archiveService.execute(archiveCommand)

    // Assert - Verify archived event was saved
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(createCommand.id) as any[]
    expect(events.length).toBe(2)
    expect(events[1]!.event_type).toBe('collection.archived')
    expect(events[1]!.version).toBe(1)

    // Assert - Verify snapshot version was incremented
    const updatedSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(updatedSnapshot.version).toBe(1)

    batcher.stop()
    db.close()
  })
})

