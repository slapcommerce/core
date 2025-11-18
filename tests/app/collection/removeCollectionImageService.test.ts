import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { CreateCollectionService } from '../../../src/app/collection/createCollectionService'
import { AddCollectionImageService } from '../../../src/app/collection/addCollectionImageService'
import { RemoveCollectionImageService } from '../../../src/app/collection/removeCollectionImageService'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { schemas } from '../../../src/infrastructure/schemas'
import { ProjectionService } from '../../../src/infrastructure/projectionService'
import type { CreateCollectionCommand, AddCollectionImageCommand, RemoveCollectionImageCommand } from '../../../src/app/collection/commands'
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

function createRemoveImageCommand(overrides?: Partial<RemoveCollectionImageCommand>): RemoveCollectionImageCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    userId: overrides?.userId ?? randomUUIDv7(),
    imageId: overrides?.imageId ?? randomUUIDv7(),
    expectedVersion: overrides?.expectedVersion ?? 0,
  }
}

function createMockImageUploadHelper(): ImageUploadHelper {
  const uploadedImages = new Map<string, ImageUploadResult>()

  return {
    uploadImage: async (buffer: ArrayBuffer, filename: string, contentType: string): Promise<ImageUploadResult> => {
      const result = {
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
      uploadedImages.set(result.imageId, result)
      return result
    },
    deleteImage: async (imageId: string): Promise<void> => {
      uploadedImages.delete(imageId)
    },
  } as ImageUploadHelper
}

describe('RemoveCollectionImageService', () => {
  test('should successfully remove image from collection', async () => {
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
    const removeImageService = new RemoveCollectionImageService(unitOfWork, projectionService)

    const createCommand = createValidCreateCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Add an image first
    const addImageCommand = createAddImageCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })
    await addImageService.execute(addImageCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Get the image ID from the snapshot
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    const imageId = snapshotPayload.images[0].imageId

    const removeImageCommand = createRemoveImageCommand({
      id: createCommand.id,
      imageId,
      expectedVersion: 1,
    })

    // Act
    await removeImageService.execute(removeImageCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - Verify images_updated event was saved
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(createCommand.id) as any[]
    expect(events.length).toBe(3) // created + images_updated (add) + images_updated (remove)
    expect(events[2]!.event_type).toBe('collection.images_updated')
    expect(events[2]!.version).toBe(2)

    // Assert - Verify snapshot has no images
    const updatedSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const updatedPayload = JSON.parse(updatedSnapshot.payload)
    expect(updatedPayload.images.length).toBe(0)
    expect(updatedSnapshot.version).toBe(2)

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
    const removeImageService = new RemoveCollectionImageService(unitOfWork, projectionService)
    const removeImageCommand = createRemoveImageCommand()

    // Act & Assert
    await expect(removeImageService.execute(removeImageCommand)).rejects.toThrow('Collection with id')

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
    const removeImageService = new RemoveCollectionImageService(unitOfWork, projectionService)

    const createCommand = createValidCreateCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Add an image
    const addImageCommand = createAddImageCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })
    await addImageService.execute(addImageCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    const imageId = snapshotPayload.images[0].imageId

    const removeImageCommand = createRemoveImageCommand({
      id: createCommand.id,
      imageId,
      expectedVersion: 5, // Wrong version - should be 1
    })

    // Act & Assert
    await expect(removeImageService.execute(removeImageCommand)).rejects.toThrow('Optimistic concurrency conflict: expected version 5 but found version 1')

    batcher.stop()
    db.close()
  })

  test('should throw error when image does not exist in collection', async () => {
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
    const removeImageService = new RemoveCollectionImageService(unitOfWork, projectionService)

    const createCommand = createValidCreateCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const nonExistentImageId = randomUUIDv7()
    const removeImageCommand = createRemoveImageCommand({
      id: createCommand.id,
      imageId: nonExistentImageId,
      expectedVersion: 0,
    })

    // Act & Assert
    await expect(removeImageService.execute(removeImageCommand)).rejects.toThrow(`Image with id ${nonExistentImageId} not found`)

    batcher.stop()
    db.close()
  })

  test('should remove one image while keeping others', async () => {
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
    const removeImageService = new RemoveCollectionImageService(unitOfWork, projectionService)

    const createCommand = createValidCreateCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Add two images
    const addImageCommand1 = createAddImageCommand({
      id: createCommand.id,
      expectedVersion: 0,
      altText: 'First image',
    })
    await addImageService.execute(addImageCommand1)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const addImageCommand2 = createAddImageCommand({
      id: createCommand.id,
      expectedVersion: 1,
      altText: 'Second image',
    })
    await addImageService.execute(addImageCommand2)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Get the first image ID
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    const firstImageId = snapshotPayload.images[0].imageId

    const removeImageCommand = createRemoveImageCommand({
      id: createCommand.id,
      imageId: firstImageId,
      expectedVersion: 2,
    })

    // Act
    await removeImageService.execute(removeImageCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - Verify one image remains
    const updatedSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const updatedPayload = JSON.parse(updatedSnapshot.payload)
    expect(updatedPayload.images.length).toBe(1)
    expect(updatedPayload.images[0].altText).toBe('Second image')

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
    const removeImageService = new RemoveCollectionImageService(unitOfWork, projectionService)
    const removeImageCommand = createRemoveImageCommand()

    // Act & Assert - This should fail because collection doesn't exist
    await expect(removeImageService.execute(removeImageCommand)).rejects.toThrow()

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
})
