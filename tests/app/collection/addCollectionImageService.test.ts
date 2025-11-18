import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { CreateCollectionService } from '../../../src/app/collection/createCollectionService'
import { AddCollectionImageService } from '../../../src/app/collection/addCollectionImageService'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { schemas } from '../../../src/infrastructure/schemas'
import { ProjectionService } from '../../../src/infrastructure/projectionService'
import type { CreateCollectionCommand } from '../../../src/app/collection/commands'
import type { AddCollectionImageCommand } from '../../../src/app/collection/commands'
import type { ImageUploadHelper } from '../../../src/infrastructure/imageUploadHelper'
import type { ImageUploadResult } from '../../../src/infrastructure/adapters/imageStorageAdapter'

function createValidCreateCommand(overrides?: Partial<CreateCollectionCommand>): CreateCollectionCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    correlationId: overrides?.correlationId ?? randomUUIDv7(),
    userId: overrides?.userId ?? randomUUIDv7(),
    name: overrides?.name ?? 'Test Collection',
    description: overrides?.description ?? null,
    slug: overrides?.slug ?? `test-collection-${randomUUIDv7()}`,
  }
}

function createAddImageCommand(overrides?: Partial<AddCollectionImageCommand>): AddCollectionImageCommand {
  // Create a small base64 encoded test image (1x1 transparent PNG)
  const testImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

  return {
    id: overrides?.id ?? randomUUIDv7(),
    userId: overrides?.userId ?? randomUUIDv7(),
    imageData: overrides?.imageData ?? testImageData,
    filename: overrides?.filename ?? 'test-image.png',
    contentType: overrides?.contentType ?? 'image/png',
    altText: overrides?.altText ?? 'Test image',
    expectedVersion: overrides?.expectedVersion ?? 0,
  }
}

function createMockImageUploadHelper(): ImageUploadHelper {
  return {
    uploadImage: async (buffer: ArrayBuffer, filename: string, contentType: string): Promise<ImageUploadResult> => {
      return {
        imageId: randomUUIDv7(),
        urls: {
          original: `https://example.com/images/${filename}`,
          large: `https://example.com/images/large/${filename}`,
          medium: `https://example.com/images/medium/${filename}`,
          small: `https://example.com/images/small/${filename}`,
          thumbnail: `https://example.com/images/thumbnail/${filename}`,
        },
        uploadedAt: new Date(),
      }
    },
    deleteImage: async (imageId: string): Promise<void> => {
      // Mock deletion
    },
  } as ImageUploadHelper
}

describe('AddCollectionImageService', () => {
  test('should successfully add image to collection', async () => {
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
    const imageUploadHelper = createMockImageUploadHelper()
    const createService = new CreateCollectionService(unitOfWork, projectionService)
    const addImageService = new AddCollectionImageService(unitOfWork, projectionService, imageUploadHelper)

    const createCommand = createValidCreateCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const addImageCommand = createAddImageCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })

    // Act
    await addImageService.execute(addImageCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - Verify images_updated event was saved
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(createCommand.id) as any[]
    expect(events.length).toBe(2)
    expect(events[0]!.event_type).toBe('collection.created')
    expect(events[1]!.event_type).toBe('collection.images_updated')
    expect(events[1]!.version).toBe(1)

    // Assert - Verify snapshot was updated with image
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(snapshot).toBeDefined()
    expect(snapshot.version).toBe(1)

    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.images).toBeDefined()
    expect(snapshotPayload.images.length).toBe(1)
    expect(snapshotPayload.images[0].altText).toBe('Test image')

    // Assert - Verify outbox event was saved
    const outboxEvents = db.query('SELECT * FROM outbox WHERE aggregate_id = ? ORDER BY event_type').all(createCommand.id) as any[]
    expect(outboxEvents.length).toBe(2)
    const imagesUpdatedOutboxEvent = outboxEvents.find(e => e.event_type === 'collection.images_updated')
    expect(imagesUpdatedOutboxEvent).toBeDefined()
    expect(imagesUpdatedOutboxEvent!.status).toBe('pending')

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
    const imageUploadHelper = createMockImageUploadHelper()
    const addImageService = new AddCollectionImageService(unitOfWork, projectionService, imageUploadHelper)
    const addImageCommand = createAddImageCommand()

    // Act & Assert
    await expect(addImageService.execute(addImageCommand)).rejects.toThrow('Collection with id')

    // Assert - Verify nothing was saved
    const eventCount = db.query('SELECT COUNT(*) as count FROM events').get() as { count: number }
    expect(eventCount.count).toBe(0)

    batcher.stop()
    db.close()
  })

  test('should throw error when expected version does not match', async () => {
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
    const imageUploadHelper = createMockImageUploadHelper()
    const createService = new CreateCollectionService(unitOfWork, projectionService)
    const addImageService = new AddCollectionImageService(unitOfWork, projectionService, imageUploadHelper)

    const createCommand = createValidCreateCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const addImageCommand = createAddImageCommand({
      id: createCommand.id,
      expectedVersion: 5, // Wrong version - should be 0
    })

    // Act & Assert
    await expect(addImageService.execute(addImageCommand)).rejects.toThrow('Optimistic concurrency conflict: expected version 5 but found version 0')

    // Assert - Verify no images_updated event was created
    const imagesUpdatedEvents = db.query("SELECT * FROM events WHERE aggregate_id = ? AND event_type = 'collection.images_updated'").all(createCommand.id) as any[]
    expect(imagesUpdatedEvents.length).toBe(0)

    batcher.stop()
    db.close()
  })

  test('should successfully add multiple images sequentially', async () => {
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
    const imageUploadHelper = createMockImageUploadHelper()
    const createService = new CreateCollectionService(unitOfWork, projectionService)
    const addImageService = new AddCollectionImageService(unitOfWork, projectionService, imageUploadHelper)

    const createCommand = createValidCreateCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Add first image
    const addImageCommand1 = createAddImageCommand({
      id: createCommand.id,
      expectedVersion: 0,
      altText: 'First image',
    })
    await addImageService.execute(addImageCommand1)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Add second image
    const addImageCommand2 = createAddImageCommand({
      id: createCommand.id,
      expectedVersion: 1,
      altText: 'Second image',
    })
    await addImageService.execute(addImageCommand2)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - Verify both images_updated events were saved
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(createCommand.id) as any[]
    expect(events.length).toBe(3) // created + 2x images_updated
    expect(events[0]!.event_type).toBe('collection.created')
    expect(events[1]!.event_type).toBe('collection.images_updated')
    expect(events[2]!.event_type).toBe('collection.images_updated')

    // Assert - Verify snapshot has both images
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.images.length).toBe(2)
    expect(snapshotPayload.images[0].altText).toBe('First image')
    expect(snapshotPayload.images[1].altText).toBe('Second image')
    expect(snapshot.version).toBe(2)

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
    const imageUploadHelper = createMockImageUploadHelper()
    const addImageService = new AddCollectionImageService(unitOfWork, projectionService, imageUploadHelper)
    const addImageCommand = createAddImageCommand()

    // Act & Assert - This should fail because collection doesn't exist
    await expect(addImageService.execute(addImageCommand)).rejects.toThrow()

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

  test('should increment version after adding image', async () => {
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
    const imageUploadHelper = createMockImageUploadHelper()
    const createService = new CreateCollectionService(unitOfWork, projectionService)
    const addImageService = new AddCollectionImageService(unitOfWork, projectionService, imageUploadHelper)

    const createCommand = createValidCreateCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify initial snapshot version
    const initialSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(initialSnapshot.version).toBe(0)

    const addImageCommand = createAddImageCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })

    // Act
    await addImageService.execute(addImageCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - Verify snapshot version was incremented
    const updatedSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(updatedSnapshot.version).toBe(1)

    batcher.stop()
    db.close()
  })
})
