import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { CreateCollectionService } from '../../../src/app/collection/createCollectionService'
import { PublishCollectionService } from '../../../src/app/collection/publishCollectionService'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { schemas } from '../../../src/infrastructure/schemas'
import { ProjectionService } from '../../../src/infrastructure/projectionService'
import { collectionsListViewProjection } from '../../../src/views/collection/collectionsListViewProjection'
import type { CreateCollectionCommand } from '../../../src/app/collection/commands'
import type { PublishCollectionCommand } from '../../../src/app/collection/commands'

function createValidCommand(overrides?: Partial<CreateCollectionCommand>): CreateCollectionCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    correlationId: overrides?.correlationId ?? randomUUIDv7(),
    name: overrides?.name ?? 'Test Collection',
    description: overrides?.description ?? null,
    slug: overrides?.slug ?? 'test-collection',
  }
}

function createPublishCommand(overrides?: Partial<PublishCollectionCommand>): PublishCollectionCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    expectedVersion: overrides?.expectedVersion ?? 0,
  }
}

describe('PublishCollectionService', () => {
  test('should successfully publish a draft collection', async () => {
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
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush to ensure snapshot is persisted
    await new Promise(resolve => setTimeout(resolve, 100))

    const publishCommand = createPublishCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })

    // Act
    await publishService.execute(publishCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - Verify published event was saved
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(createCommand.id) as any[]
    expect(events.length).toBe(2)
    expect(events[0]!.event_type).toBe('collection.created')
    expect(events[1]!.event_type).toBe('collection.published')
    expect(events[1]!.version).toBe(1)
    expect(events[1]!.correlation_id).toBe(createCommand.correlationId)

    const publishedEventPayload = JSON.parse(events[1]!.payload)
    expect(publishedEventPayload.priorState.status).toBe('draft')
    expect(publishedEventPayload.newState.status).toBe('active')

    // Assert - Verify snapshot was updated
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(snapshot).toBeDefined()
    expect(snapshot.version).toBe(1)
    
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.status).toBe('active')

    // Assert - Verify outbox event was saved
    const outboxEvents = db.query('SELECT * FROM outbox WHERE aggregate_id = ? ORDER BY event_type').all(createCommand.id) as any[]
    expect(outboxEvents.length).toBeGreaterThanOrEqual(1)
    const publishedOutboxEvent = outboxEvents.find((e: any) => e.event_type === 'collection.published')
    expect(publishedOutboxEvent).toBeDefined()
    expect(publishedOutboxEvent.status).toBe('pending')

    // Assert - Verify collections list view was updated
    const collectionView = db.query('SELECT * FROM collections_list_view WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(collectionView).toBeDefined()
    expect(collectionView.status).toBe('active')

    batcher.stop()
    db.close()
  })

  test('should throw error when trying to publish an archived collection', async () => {
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
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Archive the collection first
    const { ArchiveCollectionService } = await import('../../../src/app/collection/archiveCollectionService')
    const archiveService = new ArchiveCollectionService(unitOfWork, projectionService)
    await archiveService.execute({
      id: createCommand.id,
      expectedVersion: 0,
    })

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const publishCommand = createPublishCommand({
      id: createCommand.id,
      expectedVersion: 1,
    })

    // Act & Assert
    await expect(publishService.execute(publishCommand)).rejects.toThrow('Cannot publish an archived collection')

    batcher.stop()
    db.close()
  })

  test('should throw error when trying to publish an already active collection', async () => {
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
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Publish the collection first
    const firstPublishCommand = createPublishCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })
    await publishService.execute(firstPublishCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Try to publish again
    const secondPublishCommand = createPublishCommand({
      id: createCommand.id,
      expectedVersion: 1,
    })

    // Act & Assert
    await expect(publishService.execute(secondPublishCommand)).rejects.toThrow('Collection is already published')

    batcher.stop()
    db.close()
  })

  test('should throw error when collection not found', async () => {
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
    const publishService = new PublishCollectionService(unitOfWork, projectionService)
    
    const publishCommand = createPublishCommand()

    // Act & Assert
    await expect(publishService.execute(publishCommand)).rejects.toThrow('not found')

    batcher.stop()
    db.close()
  })

  test('should throw error on optimistic concurrency conflict', async () => {
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
    const publishService = new PublishCollectionService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const publishCommand = createPublishCommand({
      id: createCommand.id,
      expectedVersion: 999, // Wrong version
    })

    // Act & Assert
    await expect(publishService.execute(publishCommand)).rejects.toThrow('Optimistic concurrency conflict')

    batcher.stop()
    db.close()
  })
})

