import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { CreateCollectionService } from '../../../src/app/collection/createCollectionService'
import { UpdateCollectionImageService } from '../../../src/app/collection/updateCollectionImageService'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { schemas } from '../../../src/infrastructure/schemas'
import { ProjectionService } from '../../../src/infrastructure/projectionService'
import { collectionsListViewProjection } from '../../../src/views/collection/collectionsListViewProjection'
import type { CreateCollectionCommand } from '../../../src/app/collection/commands'
import type { UpdateCollectionImageCommand } from '../../../src/app/collection/commands'

function createValidCommand(overrides?: Partial<CreateCollectionCommand>): CreateCollectionCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    correlationId: overrides?.correlationId ?? randomUUIDv7(),
    name: overrides?.name ?? 'Test Collection',
    description: overrides?.description ?? null,
    slug: overrides?.slug ?? 'test-collection',
  }
}

function createUpdateImageCommand(overrides?: Partial<UpdateCollectionImageCommand>): UpdateCollectionImageCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    imageData: overrides?.imageData !== undefined ? overrides.imageData : null,
    filename: overrides?.filename ?? null,
    contentType: overrides?.contentType ?? null,
    expectedVersion: overrides?.expectedVersion ?? 0,
  }
}

describe('UpdateCollectionImageService', () => {
  test('should successfully update collection image URL', async () => {
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
    projectionService.registerHandler('collection.image_updated', collectionsListViewProjection)
    const createService = new CreateCollectionService(unitOfWork, projectionService)
    const updateService = new UpdateCollectionImageService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const updateCommand = createUpdateImageCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })

    // Act
    await updateService.execute(updateCommand)

    // Assert - Verify image updated event was saved
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(createCommand.id) as any[]
    expect(events.length).toBe(2)
    expect(events[0]!.event_type).toBe('collection.created')
    expect(events[1]!.event_type).toBe('collection.image_updated')
    expect(events[1]!.version).toBe(1)

    // Assert - Verify snapshot was updated (imageData is null, so imageUrls should be null)
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.imageUrls).toBeNull()

    // Assert - Verify outbox event was saved
    const outboxEvents = db.query('SELECT * FROM outbox WHERE aggregate_id = ? ORDER BY event_type').all(createCommand.id) as any[]
    expect(outboxEvents.length).toBe(2)
    const imageUpdatedOutboxEvent = outboxEvents.find(e => e.event_type === 'collection.image_updated')
    expect(imageUpdatedOutboxEvent).toBeDefined()
    expect(imageUpdatedOutboxEvent!.status).toBe('pending')

    batcher.stop()
    db.close()
  })

  test('should successfully set image URL to null', async () => {
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
    projectionService.registerHandler('collection.image_updated', collectionsListViewProjection)
    const createService = new CreateCollectionService(unitOfWork, projectionService)
    const updateService = new UpdateCollectionImageService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // First set an image URL (using null imageData since we don't have imageUploadHelper in this test)
    // This test is primarily testing the null case, so we'll skip the upload test here
    const setImageCommand = createUpdateImageCommand({
      id: createCommand.id,
      imageData: null,
      filename: null,
      contentType: null,
      expectedVersion: 0,
    })
    await updateService.execute(setImageCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify the snapshot was updated (imageData is null, so imageUrls should be null)
    const snapshotAfterSet = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const snapshotPayloadAfterSet = JSON.parse(snapshotAfterSet.payload)
    expect(snapshotPayloadAfterSet.imageUrls).toBeNull()
    expect(snapshotAfterSet.version).toBe(1)

    // Reload the snapshot to ensure we have the latest version
    const reloadedSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(reloadedSnapshot.version).toBe(1)
    const reloadedPayload = JSON.parse(reloadedSnapshot.payload)
    expect(reloadedPayload.imageUrls).toBeNull()

    // Then set it to null (it's already null, but this tests the flow)
    const removeImageCommand = createUpdateImageCommand({
      id: createCommand.id,
      imageData: null,
      filename: null,
      contentType: null,
      expectedVersion: 1,
    })

    // Act
    await updateService.execute(removeImageCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 150))

    // Assert - Verify image updated event was saved with null
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(createCommand.id) as any[]
    expect(events.length).toBe(3)
    expect(events[0]!.event_type).toBe('collection.created')
    expect(events[1]!.event_type).toBe('collection.image_updated')
    expect(events[2]!.event_type).toBe('collection.image_updated')
    expect(events[1]!.version).toBe(1)
    expect(events[2]!.version).toBe(2)
    const firstImageUpdatedPayload = JSON.parse(events[1]!.payload)
    expect(firstImageUpdatedPayload.newState.imageUrls).toBeNull()
    const secondImageUpdatedPayload = JSON.parse(events[2]!.payload)
    expect(secondImageUpdatedPayload.newState.imageUrls).toBeNull()
    expect(secondImageUpdatedPayload.priorState.imageUrls).toBeNull()

    // Assert - Verify snapshot was updated to null
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(snapshot).toBeDefined()
    expect(snapshot.version).toBe(2)
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.imageUrls).toBeNull()

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
    const updateService = new UpdateCollectionImageService(unitOfWork, projectionService)
    const updateCommand = createUpdateImageCommand()

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
    const updateService = new UpdateCollectionImageService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const updateCommand = createUpdateImageCommand({
      id: createCommand.id,
      expectedVersion: 5, // Wrong version
    })

    // Act & Assert
    await expect(updateService.execute(updateCommand)).rejects.toThrow('Optimistic concurrency conflict')

    batcher.stop()
    db.close()
  })
})

