import { describe, test, expect, mock } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDatabase, closeTestDatabase } from '../../../../../helpers/database'
import { TransactionBatcher } from '../../../../../../src/api/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../../../../src/api/infrastructure/unitOfWork'
import { UpdateCollectionImageService } from '../../../../../../src/api/app/collection/commands/admin/updateCollectionImageService'
import { CollectionAggregate } from '../../../../../../src/api/domain/collection/aggregate'
import { ImageCollection } from '../../../../../../src/api/domain/_base/imageCollection'
import type { UpdateCollectionImageCommand } from '../../../../../../src/api/app/collection/commands/admin/commands'
import type { ImageUploadHelper } from '../../../../../../src/api/infrastructure/imageUploadHelper'
import type { ImageUploadResult } from '../../../../../../src/api/infrastructure/adapters/imageStorageAdapter'

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

async function createCollectionWithMultipleImagesInDatabase(
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
    })

    // Add multiple images
    let imageCollection = ImageCollection.empty()

    imageCollection = imageCollection.addImage({
      imageId: 'image-1',
      urls: {
        thumbnail: { original: 'test1.jpg', webp: 'test1.webp', avif: 'test1.avif' },
        small: { original: 'test1.jpg', webp: 'test1.webp', avif: 'test1.avif' },
        medium: { original: 'test1.jpg', webp: 'test1.webp', avif: 'test1.avif' },
        large: { original: 'test1.jpg', webp: 'test1.webp', avif: 'test1.avif' },
        original: { original: 'test1.jpg', webp: 'test1.webp', avif: 'test1.avif' },
      },
    }, 'Image 1')

    imageCollection = imageCollection.addImage({
      imageId: 'image-2',
      urls: {
        thumbnail: { original: 'test2.jpg', webp: 'test2.webp', avif: 'test2.avif' },
        small: { original: 'test2.jpg', webp: 'test2.webp', avif: 'test2.avif' },
        medium: { original: 'test2.jpg', webp: 'test2.webp', avif: 'test2.avif' },
        large: { original: 'test2.jpg', webp: 'test2.webp', avif: 'test2.avif' },
        original: { original: 'test2.jpg', webp: 'test2.webp', avif: 'test2.avif' },
      },
    }, 'Image 2')

    imageCollection = imageCollection.addImage({
      imageId: 'image-3',
      urls: {
        thumbnail: { original: 'test3.jpg', webp: 'test3.webp', avif: 'test3.avif' },
        small: { original: 'test3.jpg', webp: 'test3.webp', avif: 'test3.avif' },
        medium: { original: 'test3.jpg', webp: 'test3.webp', avif: 'test3.avif' },
        large: { original: 'test3.jpg', webp: 'test3.webp', avif: 'test3.avif' },
        original: { original: 'test3.jpg', webp: 'test3.webp', avif: 'test3.avif' },
      },
    }, 'Image 3')

    collection.updateImages(imageCollection, 'test-user')

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

function createMockImageUploadHelper(newImageId: string = 'new-image-id'): ImageUploadHelper {
  const mockUploadResult: ImageUploadResult = {
    imageId: newImageId,
    urls: {
      thumbnail: {
        original: 'https://example.com/new-thumbnail.jpg',
        webp: 'https://example.com/new-thumbnail.webp',
        avif: 'https://example.com/new-thumbnail.avif',
      },
      small: {
        original: 'https://example.com/new-small.jpg',
        webp: 'https://example.com/new-small.webp',
        avif: 'https://example.com/new-small.avif',
      },
      medium: {
        original: 'https://example.com/new-medium.jpg',
        webp: 'https://example.com/new-medium.webp',
        avif: 'https://example.com/new-medium.avif',
      },
      large: {
        original: 'https://example.com/new-large.jpg',
        webp: 'https://example.com/new-large.webp',
        avif: 'https://example.com/new-large.avif',
      },
      original: {
        original: 'https://example.com/new-original.jpg',
        webp: 'https://example.com/new-original.webp',
        avif: 'https://example.com/new-original.avif',
      },
    },
  }

  return {
    uploadImage: mock(() => Promise.resolve(mockUploadResult)),
  } as any
}

describe('UpdateCollectionImageService', () => {
  test('should successfully replace image maintaining position', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionWithMultipleImagesInDatabase(unitOfWork, 'collection-123', 'Test Collection')

      const mockImageUploadHelper = createMockImageUploadHelper('new-image-id')
      const service = new UpdateCollectionImageService(unitOfWork, mockImageUploadHelper)
      const command: UpdateCollectionImageCommand = {
        type: 'updateCollectionImage',
        id: 'collection-123',
        imageId: 'image-2', // Replace middle image
        imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        filename: 'new-image.jpg',
        contentType: 'image/jpeg',
        altText: 'New image',
        userId: 'user-456',
        expectedVersion: 1, // Version 1 after adding images
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
      expect(updatedSnapshot.version).toBe(2)
      const payload = JSON.parse(updatedSnapshot.payload)
      expect(payload.images).toBeDefined()
      expect(payload.images.length).toBe(3)

      // Verify new image is at the same position (index 1)
      expect(payload.images[0].imageId).toBe('image-1')
      expect(payload.images[1].imageId).toBe('new-image-id')
      expect(payload.images[1].altText).toBe('New image')
      expect(payload.images[2].imageId).toBe('image-3')

      // Verify uploadImage was called
      expect(mockImageUploadHelper.uploadImage).toHaveBeenCalledTimes(1)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should replace first image maintaining position', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionWithMultipleImagesInDatabase(unitOfWork, 'collection-123', 'Test Collection')

      const mockImageUploadHelper = createMockImageUploadHelper('new-image-id')
      const service = new UpdateCollectionImageService(unitOfWork, mockImageUploadHelper)
      const command: UpdateCollectionImageCommand = {
        type: 'updateCollectionImage',
        id: 'collection-123',
        imageId: 'image-1', // Replace first image
        imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        filename: 'new-image.jpg',
        contentType: 'image/jpeg',
        altText: 'New image',
        userId: 'user-456',
        expectedVersion: 1,
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
      expect(payload.images[0].imageId).toBe('new-image-id')
      expect(payload.images[1].imageId).toBe('image-2')
      expect(payload.images[2].imageId).toBe('image-3')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should replace last image maintaining position', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionWithMultipleImagesInDatabase(unitOfWork, 'collection-123', 'Test Collection')

      const mockImageUploadHelper = createMockImageUploadHelper('new-image-id')
      const service = new UpdateCollectionImageService(unitOfWork, mockImageUploadHelper)
      const command: UpdateCollectionImageCommand = {
        type: 'updateCollectionImage',
        id: 'collection-123',
        imageId: 'image-3', // Replace last image
        imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        filename: 'new-image.jpg',
        contentType: 'image/jpeg',
        altText: 'New image',
        userId: 'user-456',
        expectedVersion: 1,
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
      expect(payload.images[0].imageId).toBe('image-1')
      expect(payload.images[1].imageId).toBe('image-2')
      expect(payload.images[2].imageId).toBe('new-image-id')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when collection not found', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const mockImageUploadHelper = createMockImageUploadHelper()
      const service = new UpdateCollectionImageService(unitOfWork, mockImageUploadHelper)
      const command: UpdateCollectionImageCommand = {
        type: 'updateCollectionImage',
        id: 'non-existent-collection',
        imageId: 'image-1',
        imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        filename: 'new-image.jpg',
        contentType: 'image/jpeg',
        altText: 'New image',
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
      await createCollectionWithMultipleImagesInDatabase(unitOfWork, 'collection-123', 'Test Collection')

      const mockImageUploadHelper = createMockImageUploadHelper()
      const service = new UpdateCollectionImageService(unitOfWork, mockImageUploadHelper)
      const command: UpdateCollectionImageCommand = {
        type: 'updateCollectionImage',
        id: 'collection-123',
        imageId: 'image-1',
        imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        filename: 'new-image.jpg',
        contentType: 'image/jpeg',
        altText: 'New image',
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

  test('should throw error when image not found in collection', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionWithMultipleImagesInDatabase(unitOfWork, 'collection-123', 'Test Collection')

      const mockImageUploadHelper = createMockImageUploadHelper()
      const service = new UpdateCollectionImageService(unitOfWork, mockImageUploadHelper)
      const command: UpdateCollectionImageCommand = {
        type: 'updateCollectionImage',
        id: 'collection-123',
        imageId: 'non-existent-image',
        imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        filename: 'new-image.jpg',
        contentType: 'image/jpeg',
        altText: 'New image',
        userId: 'user-456',
        expectedVersion: 1,
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow('Image with id non-existent-image not found in collection')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should handle image upload failure', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionWithMultipleImagesInDatabase(unitOfWork, 'collection-123', 'Test Collection')

      const mockImageUploadHelper = {
        uploadImage: mock(() => Promise.reject(new Error('Upload failed'))),
      } as any

      const service = new UpdateCollectionImageService(unitOfWork, mockImageUploadHelper)
      const command: UpdateCollectionImageCommand = {
        type: 'updateCollectionImage',
        id: 'collection-123',
        imageId: 'image-1',
        imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        filename: 'new-image.jpg',
        contentType: 'image/jpeg',
        altText: 'New image',
        userId: 'user-456',
        expectedVersion: 1,
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow('Upload failed')

      // Verify state unchanged after error
      const snapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregateId = ?
      `).get('collection-123') as any

      expect(snapshot.version).toBe(1)
      const payload = JSON.parse(snapshot.payload)
      expect(payload.images[0].imageId).toBe('image-1') // Original image still there
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should increment version correctly', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionWithMultipleImagesInDatabase(unitOfWork, 'collection-123', 'Test Collection')

      const mockImageUploadHelper = createMockImageUploadHelper()
      const service = new UpdateCollectionImageService(unitOfWork, mockImageUploadHelper)
      const command: UpdateCollectionImageCommand = {
        type: 'updateCollectionImage',
        id: 'collection-123',
        imageId: 'image-1',
        imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        filename: 'new-image.jpg',
        contentType: 'image/jpeg',
        altText: 'New image',
        userId: 'user-456',
        expectedVersion: 1,
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

      expect(updatedSnapshot.version).toBe(2)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should rollback on error', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionWithMultipleImagesInDatabase(unitOfWork, 'collection-123', 'Test Collection')

      const initialSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregateId = ?
      `).get('collection-123') as any

      const mockImageUploadHelper = createMockImageUploadHelper()
      const service = new UpdateCollectionImageService(unitOfWork, mockImageUploadHelper)
      const command: UpdateCollectionImageCommand = {
        type: 'updateCollectionImage',
        id: 'collection-123',
        imageId: 'image-1',
        imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        filename: 'new-image.jpg',
        contentType: 'image/jpeg',
        altText: 'New image',
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
      const payload = JSON.parse(finalSnapshot.payload)
      expect(payload.images[0].imageId).toBe('image-1')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
