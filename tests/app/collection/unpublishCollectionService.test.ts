import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { CreateCollectionService } from '../../../src/app/collection/createCollectionService'
import { PublishCollectionService } from '../../../src/app/collection/publishCollectionService'
import { UnpublishCollectionService } from '../../../src/app/collection/unpublishCollectionService'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { schemas } from '../../../src/infrastructure/schemas'
import { ProjectionService } from '../../../src/infrastructure/projectionService'
import { collectionsListViewProjection } from '../../../src/views/collection/collectionsListViewProjection'
import type { CreateCollectionCommand } from '../../../src/app/collection/commands'
import type { PublishCollectionCommand } from '../../../src/app/collection/commands'
import type { UnpublishCollectionCommand } from '../../../src/app/collection/commands'

function createValidCommand(overrides?: Partial<CreateCollectionCommand>): CreateCollectionCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    correlationId: overrides?.correlationId ?? randomUUIDv7(),
    userId: overrides?.userId ?? randomUUIDv7(),
    name: overrides?.name ?? 'Test Collection',
    description: overrides?.description ?? null,
    slug: overrides?.slug ?? 'test-collection',
  }
}

function createPublishCommand(overrides?: Partial<PublishCollectionCommand>): PublishCollectionCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    userId: overrides?.userId ?? randomUUIDv7(),
    expectedVersion: overrides?.expectedVersion ?? 0,
  }
}

function createUnpublishCommand(overrides?: Partial<UnpublishCollectionCommand>): UnpublishCollectionCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    userId: overrides?.userId ?? randomUUIDv7(),
    expectedVersion: overrides?.expectedVersion ?? 1,
  }
}

describe('UnpublishCollectionService', () => {
  test('should successfully unpublish collection (active → draft)', async () => {
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
    projectionService.registerHandler('collection.created', collectionsListViewProjection)
    projectionService.registerHandler('collection.published', collectionsListViewProjection)
    projectionService.registerHandler('collection.unpublished', collectionsListViewProjection)
    const createService = new CreateCollectionService(unitOfWork, projectionService)
    const publishService = new PublishCollectionService(unitOfWork, projectionService)
    const unpublishService = new UnpublishCollectionService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const publishCommand = createPublishCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })
    await publishService.execute(publishCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const unpublishCommand = createUnpublishCommand({
      id: createCommand.id,
      expectedVersion: 1,
    })

    // Act
    await unpublishService.execute(unpublishCommand)

    // Assert - Verify unpublished event was saved
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(createCommand.id) as any[]
    expect(events.length).toBe(3)
    expect(events[0]!.event_type).toBe('collection.created')
    expect(events[1]!.event_type).toBe('collection.published')
    expect(events[2]!.event_type).toBe('collection.unpublished')
    expect(events[2]!.version).toBe(2)

    // Assert - Verify snapshot was updated
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.status).toBe('draft')
    expect(snapshotPayload.publishedAt).toBeNull()

    // Assert - Verify outbox event was saved
    const outboxEvents = db.query('SELECT * FROM outbox WHERE aggregate_id = ? ORDER BY event_type').all(createCommand.id) as any[]
    expect(outboxEvents.length).toBe(3)
    const unpublishedOutboxEvent = outboxEvents.find(e => e.event_type === 'collection.unpublished')
    expect(unpublishedOutboxEvent).toBeDefined()
    expect(unpublishedOutboxEvent!.status).toBe('pending')

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
    const unpublishService = new UnpublishCollectionService(unitOfWork, projectionService)
    const unpublishCommand = createUnpublishCommand()

    // Act & Assert
    await expect(unpublishService.execute(unpublishCommand)).rejects.toThrow('not found')

    batcher.stop()
    db.close()
  })

  test('should throw error when trying to unpublish draft collection', async () => {
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
    projectionService.registerHandler('collection.created', collectionsListViewProjection)
    const createService = new CreateCollectionService(unitOfWork, projectionService)
    const unpublishService = new UnpublishCollectionService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const unpublishCommand = createUnpublishCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })

    // Act & Assert
    await expect(unpublishService.execute(unpublishCommand)).rejects.toThrow('already unpublished')

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
    projectionService.registerHandler('collection.created', collectionsListViewProjection)
    projectionService.registerHandler('collection.published', collectionsListViewProjection)
    const createService = new CreateCollectionService(unitOfWork, projectionService)
    const publishService = new PublishCollectionService(unitOfWork, projectionService)
    const unpublishService = new UnpublishCollectionService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const publishCommand = createPublishCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })
    await publishService.execute(publishCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const unpublishCommand = createUnpublishCommand({
      id: createCommand.id,
      expectedVersion: 5, // Wrong version
    })

    // Act & Assert
    await expect(unpublishService.execute(unpublishCommand)).rejects.toThrow('Optimistic concurrency conflict')

    batcher.stop()
    db.close()
  })
})

