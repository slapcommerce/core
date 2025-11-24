import { describe, test, expect, mock } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDatabase, closeTestDatabase } from '../../helpers/database'
import { TransactionBatcher } from '../../../../src/api/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../../src/api/infrastructure/unitOfWork'
import { AddCollectionImageService } from '../../../../src/api/app/collection/addCollectionImageService'
import { CollectionAggregate } from '../../../../src/api/domain/collection/aggregate'
import type { AddCollectionImageCommand } from '../../../../src/api/app/collection/commands'
import type { ImageUploadHelper } from '../../../../src/api/infrastructure/imageUploadHelper'
import type { ImageUploadResult } from '../../../../src/api/infrastructure/adapters/imageStorageAdapter'

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

function createMockImageUploadHelper(): ImageUploadHelper {
  const mockUploadResult: ImageUploadResult = {
    imageId: 'test-image-id',
    urls: {
      thumbnail: {
        original: 'https://example.com/thumbnail.jpg',
        webp: 'https://example.com/thumbnail.webp',
        avif: 'https://example.com/thumbnail.avif',
      },
      small: {
        original: 'https://example.com/small.jpg',
        webp: 'https://example.com/small.webp',
        avif: 'https://example.com/small.avif',
      },
      medium: {
        original: 'https://example.com/medium.jpg',
        webp: 'https://example.com/medium.webp',
        avif: 'https://example.com/medium.avif',
      },
      large: {
        original: 'https://example.com/large.jpg',
        webp: 'https://example.com/large.webp',
        avif: 'https://example.com/large.avif',
      },
      original: {
        original: 'https://example.com/original.jpg',
        webp: 'https://example.com/original.webp',
        avif: 'https://example.com/original.avif',
      },
    },
  }

  return {
    uploadImage: mock(() => Promise.resolve(mockUploadResult)),
  } as any
}

describe('AddCollectionImageService', () => {
  test('should successfully add image to collection', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionInDatabase(unitOfWork, 'collection-123', 'Test Collection')

      const mockImageUploadHelper = createMockImageUploadHelper()
      const service = new AddCollectionImageService(unitOfWork, mockImageUploadHelper)
      const command: AddCollectionImageCommand = {
        type: 'addCollectionImage',
        id: 'collection-123',
        imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        filename: 'test.jpg',
        contentType: 'image/jpeg',
        altText: 'Test image',
        userId: 'user-456',
        expectedVersion: 0,
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
      expect(updatedSnapshot.version).toBe(1)
      const payload = JSON.parse(updatedSnapshot.payload)
      expect(payload.images).toBeDefined()
      expect(payload.images.length).toBe(1)
      expect(payload.images[0].imageId).toBe('test-image-id')
      expect(payload.images[0].altText).toBe('Test image')

      // Verify event was saved
      const events = db.query(`
        SELECT * FROM events
        WHERE aggregate_id = ? AND event_type = 'collection.images_updated'
      `).all('collection-123') as any[]

      expect(events.length).toBeGreaterThanOrEqual(1)

      // Verify uploadImage was called
      expect(mockImageUploadHelper.uploadImage).toHaveBeenCalledTimes(1)
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
      const service = new AddCollectionImageService(unitOfWork, mockImageUploadHelper)
      const command: AddCollectionImageCommand = {
        type: 'addCollectionImage',
        id: 'non-existent-collection',
        imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        filename: 'test.jpg',
        contentType: 'image/jpeg',
        altText: 'Test image',
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
      await createCollectionInDatabase(unitOfWork, 'collection-123', 'Test Collection')

      const mockImageUploadHelper = createMockImageUploadHelper()
      const service = new AddCollectionImageService(unitOfWork, mockImageUploadHelper)
      const command: AddCollectionImageCommand = {
        type: 'addCollectionImage',
        id: 'collection-123',
        imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        filename: 'test.jpg',
        contentType: 'image/jpeg',
        altText: 'Test image',
        userId: 'user-456',
        expectedVersion: 5, // Wrong version
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow('Optimistic concurrency conflict: expected version 5 but found version 0')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should handle image upload failure', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionInDatabase(unitOfWork, 'collection-123', 'Test Collection')

      const mockImageUploadHelper = {
        uploadImage: mock(() => Promise.reject(new Error('Upload failed'))),
      } as any

      const service = new AddCollectionImageService(unitOfWork, mockImageUploadHelper)
      const command: AddCollectionImageCommand = {
        type: 'addCollectionImage',
        id: 'collection-123',
        imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        filename: 'test.jpg',
        contentType: 'image/jpeg',
        altText: 'Test image',
        userId: 'user-456',
        expectedVersion: 0,
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow('Upload failed')

      // Verify state unchanged after error
      const snapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregate_id = ?
      `).get('collection-123') as any

      expect(snapshot.version).toBe(0)
      const payload = JSON.parse(snapshot.payload)
      expect(payload.images.length).toBe(0)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should increment version correctly', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionInDatabase(unitOfWork, 'collection-123', 'Test Collection')

      const mockImageUploadHelper = createMockImageUploadHelper()
      const service = new AddCollectionImageService(unitOfWork, mockImageUploadHelper)
      const command: AddCollectionImageCommand = {
        type: 'addCollectionImage',
        id: 'collection-123',
        imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        filename: 'test.jpg',
        contentType: 'image/jpeg',
        altText: 'Test image',
        userId: 'user-456',
        expectedVersion: 0,
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

      expect(updatedSnapshot.version).toBe(1)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should add multiple images sequentially', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionInDatabase(unitOfWork, 'collection-123', 'Test Collection')

      const mockImageUploadHelper1 = {
        uploadImage: mock(() => Promise.resolve({
          imageId: 'image-1',
          urls: {} as any,
        })),
      } as any

      const mockImageUploadHelper2 = {
        uploadImage: mock(() => Promise.resolve({
          imageId: 'image-2',
          urls: {} as any,
        })),
      } as any

      const service1 = new AddCollectionImageService(unitOfWork, mockImageUploadHelper1)
      const service2 = new AddCollectionImageService(unitOfWork, mockImageUploadHelper2)

      // Act - Add first image
      await service1.execute({
        type: 'addCollectionImage',
        id: 'collection-123',
        imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        filename: 'test1.jpg',
        contentType: 'image/jpeg',
        altText: 'Image 1',
        userId: 'user-456',
        expectedVersion: 0,
      })

      // Act - Add second image
      await service2.execute({
        type: 'addCollectionImage',
        id: 'collection-123',
        imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        filename: 'test2.jpg',
        contentType: 'image/jpeg',
        altText: 'Image 2',
        userId: 'user-456',
        expectedVersion: 1,
      })

      // Assert
      const finalSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregate_id = ?
        ORDER BY version DESC
        LIMIT 1
      `).get('collection-123') as any

      expect(finalSnapshot.version).toBe(2)
      const payload = JSON.parse(finalSnapshot.payload)
      expect(payload.images.length).toBe(2)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should set correct access level', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const mockImageUploadHelper = createMockImageUploadHelper()
      const service = new AddCollectionImageService(unitOfWork, mockImageUploadHelper)

      // Assert
      expect(service.accessLevel).toBe('admin')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
