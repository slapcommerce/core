import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { CreateCollectionService } from '../../../src/app/collection/createCollectionService'
import { AddCollectionImageService } from '../../../src/app/collection/addCollectionImageService'
import { UpdateCollectionImageService } from '../../../src/app/collection/updateCollectionImageService'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { schemas } from '../../../src/infrastructure/schemas'
import { ProjectionService } from '../../../src/infrastructure/projectionService'
import type { CreateCollectionCommand, AddCollectionImageCommand, UpdateCollectionImageCommand } from '../../../src/app/collection/commands'
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

function createUpdateImageCommand(overrides?: Partial<UpdateCollectionImageCommand>): UpdateCollectionImageCommand {
  const testImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

  return {
    id: overrides?.id ?? randomUUIDv7(),
    userId: overrides?.userId ?? randomUUIDv7(),
    imageId: overrides?.imageId ?? randomUUIDv7(),
    imageData: overrides?.imageData ?? testImageData,
    filename: overrides?.filename ?? 'updated-image.png',
    contentType: overrides?.contentType ?? 'image/png',
    altText: overrides?.altText ?? 'Updated image',
    expectedVersion: overrides?.expectedVersion ?? 0,
  }
}

function createMockImageUploadHelper(): ImageUploadHelper {
  let imageCounter = 0

  return {
    uploadImage: async (buffer: ArrayBuffer, filename: string, contentType: string): Promise<ImageUploadResult> => {
      imageCounter++
      return {
        imageId: randomUUIDv7(), // Always generate new ID for cache invalidation
        urls: {
          original: `https://example.com/images/${filename}?v=${imageCounter}`,
          large: `https://example.com/images/large/${filename}?v=${imageCounter}`,
          medium: `https://example.com/images/medium/${filename}?v=${imageCounter}`,
          small: `https://example.com/images/small/${filename}?v=${imageCounter}`,
          thumbnail: `https://example.com/images/thumbnail/${filename}?v=${imageCounter}`,
        },
        uploadedAt: new Date(),
      }
    },
    deleteImage: async (imageId: string): Promise<void> => {
      // Mock deletion
    },
  } as ImageUploadHelper
}

describe('UpdateCollectionImageService', () => {
  test('should successfully update image with new ID for cache invalidation', async () => {
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
    const updateImageService = new UpdateCollectionImageService(unitOfWork, projectionService, imageUploadHelper)

    const createCommand = createValidCreateCommand()
    await createService.execute(createCommand)

    await new Promise(resolve => setTimeout(resolve, 100))

    const addImageCommand = createAddImageCommand({
      id: createCommand.id,
      expectedVersion: 0,
      altText: 'Original image',
    })
    await addImageService.execute(addImageCommand)

    await new Promise(resolve => setTimeout(resolve, 100))

    // Get original image ID
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    const originalImageId = snapshotPayload.images[0].imageId

    const updateImageCommand = createUpdateImageCommand({
      id: createCommand.id,
      imageId: originalImageId,
      altText: 'Replaced image',
      expectedVersion: 1,
    })

    // Act
    await updateImageService.execute(updateImageCommand)

    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - Verify image has new ID (for cache invalidation)
    const updatedSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const updatedPayload = JSON.parse(updatedSnapshot.payload)
    expect(updatedPayload.images.length).toBe(1)
    expect(updatedPayload.images[0].imageId).not.toBe(originalImageId) // New ID!
    expect(updatedPayload.images[0].altText).toBe('Replaced image')
    expect(updatedSnapshot.version).toBe(2)

    // Assert - Verify images_updated event was saved
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(createCommand.id) as any[]
    expect(events.length).toBe(3) // created + images_updated (add) + images_updated (update)
    expect(events[2]!.event_type).toBe('collection.images_updated')

    batcher.stop()
    db.close()
  })

  test('should maintain position when updating image in the middle', async () => {
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
    const updateImageService = new UpdateCollectionImageService(unitOfWork, projectionService, imageUploadHelper)

    const createCommand = createValidCreateCommand()
    await createService.execute(createCommand)

    await new Promise(resolve => setTimeout(resolve, 100))

    // Add three images
    await addImageService.execute(createAddImageCommand({
      id: createCommand.id,
      expectedVersion: 0,
      altText: 'First image',
    }))

    await new Promise(resolve => setTimeout(resolve, 100))

    await addImageService.execute(createAddImageCommand({
      id: createCommand.id,
      expectedVersion: 1,
      altText: 'Second image',
    }))

    await new Promise(resolve => setTimeout(resolve, 100))

    await addImageService.execute(createAddImageCommand({
      id: createCommand.id,
      expectedVersion: 2,
      altText: 'Third image',
    }))

    await new Promise(resolve => setTimeout(resolve, 100))

    // Get middle image ID
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    const middleImageId = snapshotPayload.images[1].imageId

    // Update middle image
    const updateImageCommand = createUpdateImageCommand({
      id: createCommand.id,
      imageId: middleImageId,
      altText: 'Replaced second image',
      expectedVersion: 3,
    })

    await updateImageService.execute(updateImageCommand)

    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - Middle image was replaced, position maintained
    const updatedSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const updatedPayload = JSON.parse(updatedSnapshot.payload)
    expect(updatedPayload.images.length).toBe(3)
    expect(updatedPayload.images[0].altText).toBe('First image')
    expect(updatedPayload.images[1].altText).toBe('Replaced second image')
    expect(updatedPayload.images[1].imageId).not.toBe(middleImageId) // New ID
    expect(updatedPayload.images[2].altText).toBe('Third image')

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
    const updateImageService = new UpdateCollectionImageService(unitOfWork, projectionService, imageUploadHelper)
    const updateImageCommand = createUpdateImageCommand()

    // Act & Assert
    await expect(updateImageService.execute(updateImageCommand)).rejects.toThrow('Collection with id')

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
    const updateImageService = new UpdateCollectionImageService(unitOfWork, projectionService, imageUploadHelper)

    const createCommand = createValidCreateCommand()
    await createService.execute(createCommand)

    await new Promise(resolve => setTimeout(resolve, 100))

    await addImageService.execute(createAddImageCommand({
      id: createCommand.id,
      expectedVersion: 0,
    }))

    await new Promise(resolve => setTimeout(resolve, 100))

    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    const imageId = snapshotPayload.images[0].imageId

    const updateImageCommand = createUpdateImageCommand({
      id: createCommand.id,
      imageId,
      expectedVersion: 5, // Wrong version
    })

    // Act & Assert
    await expect(updateImageService.execute(updateImageCommand)).rejects.toThrow('Optimistic concurrency conflict')

    batcher.stop()
    db.close()
  })

  test('should throw error when image does not exist', async () => {
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
    const updateImageService = new UpdateCollectionImageService(unitOfWork, projectionService, imageUploadHelper)

    const createCommand = createValidCreateCommand()
    await createService.execute(createCommand)

    await new Promise(resolve => setTimeout(resolve, 100))

    const nonExistentImageId = randomUUIDv7()
    const updateImageCommand = createUpdateImageCommand({
      id: createCommand.id,
      imageId: nonExistentImageId,
      expectedVersion: 0,
    })

    // Act & Assert
    await expect(updateImageService.execute(updateImageCommand)).rejects.toThrow(`Image with id ${nonExistentImageId} not found`)

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
    const updateImageService = new UpdateCollectionImageService(unitOfWork, projectionService, imageUploadHelper)
    const updateImageCommand = createUpdateImageCommand()

    // Act & Assert
    await expect(updateImageService.execute(updateImageCommand)).rejects.toThrow()

    // Assert - Verify nothing was persisted
    const eventCount = db.query('SELECT COUNT(*) as count FROM events').get() as { count: number }
    expect(eventCount.count).toBe(0)

    batcher.stop()
    db.close()
  })
})
