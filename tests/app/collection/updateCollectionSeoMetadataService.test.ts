import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { CreateCollectionService } from '../../../src/app/collection/createCollectionService'
import { UpdateCollectionSeoMetadataService } from '../../../src/app/collection/updateCollectionSeoMetadataService'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { schemas } from '../../../src/infrastructure/schemas'
import { ProjectionService } from '../../../src/infrastructure/projectionService'
import { collectionsListViewProjection } from '../../../src/views/collection/collectionsListViewProjection'
import type { CreateCollectionCommand } from '../../../src/app/collection/commands'
import type { UpdateCollectionSeoMetadataCommand } from '../../../src/app/collection/commands'

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

function createUpdateSeoMetadataCommand(overrides?: Partial<UpdateCollectionSeoMetadataCommand>): UpdateCollectionSeoMetadataCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    userId: overrides?.userId ?? randomUUIDv7(),
    metaTitle: overrides?.metaTitle ?? 'Updated Meta Title',
    metaDescription: overrides?.metaDescription ?? 'Updated Meta Description',
    expectedVersion: overrides?.expectedVersion ?? 0,
  }
}

describe('UpdateCollectionSeoMetadataService', () => {
  test('should successfully update collection SEO metadata', async () => {
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
    projectionService.registerHandler('collection.seo_metadata_updated', collectionsListViewProjection)
    const createService = new CreateCollectionService(unitOfWork, projectionService)
    const updateService = new UpdateCollectionSeoMetadataService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const updateCommand = createUpdateSeoMetadataCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })

    // Act
    await updateService.execute(updateCommand)

    // Assert - Verify SEO metadata updated event was saved
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(createCommand.id) as any[]
    expect(events.length).toBe(2)
    expect(events[0]!.event_type).toBe('collection.created')
    expect(events[1]!.event_type).toBe('collection.seo_metadata_updated')
    expect(events[1]!.version).toBe(1)

    // Assert - Verify snapshot was updated
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.metaTitle).toBe('Updated Meta Title')
    expect(snapshotPayload.metaDescription).toBe('Updated Meta Description')

    // Assert - Verify outbox event was saved
    const outboxEvents = db.query('SELECT * FROM outbox WHERE aggregate_id = ? ORDER BY event_type').all(createCommand.id) as any[]
    expect(outboxEvents.length).toBe(2)
    const seoMetadataUpdatedOutboxEvent = outboxEvents.find(e => e.event_type === 'collection.seo_metadata_updated')
    expect(seoMetadataUpdatedOutboxEvent).toBeDefined()
    expect(seoMetadataUpdatedOutboxEvent!.status).toBe('pending')

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
    const updateService = new UpdateCollectionSeoMetadataService(unitOfWork, projectionService)
    const updateCommand = createUpdateSeoMetadataCommand()

    // Act & Assert
    await expect(updateService.execute(updateCommand)).rejects.toThrow('not found')

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
    const createService = new CreateCollectionService(unitOfWork, projectionService)
    const updateService = new UpdateCollectionSeoMetadataService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const updateCommand = createUpdateSeoMetadataCommand({
      id: createCommand.id,
      expectedVersion: 5, // Wrong version
    })

    // Act & Assert
    await expect(updateService.execute(updateCommand)).rejects.toThrow('Optimistic concurrency conflict')

    batcher.stop()
    db.close()
  })
})

