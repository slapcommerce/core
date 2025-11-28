import { describe, test, expect } from 'bun:test'
import { randomUUIDv7 } from 'bun'
import { Database } from 'bun:sqlite'
import { createTestDatabase, closeTestDatabase } from '../../../../../helpers/database'
import { TransactionBatcher } from '../../../../../../src/api/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../../../../src/api/infrastructure/unitOfWork'
import { ReorderCollectionImagesService } from '../../../../../../src/api/app/collection/commands/admin/reorderCollectionImagesService'
import { CollectionAggregate } from '../../../../../../src/api/domain/collection/aggregate'
import { ImageCollection } from '../../../../../../src/api/domain/_base/imageCollection'
import type { ReorderCollectionImagesCommand } from '../../../../../../src/api/app/collection/commands/admin/commands'

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
      productPositionsAggregateId: randomUUIDv7(),
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

describe('ReorderCollectionImagesService', () => {
  test('should successfully reorder images', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionWithMultipleImagesInDatabase(unitOfWork, 'collection-123', 'Test Collection')

      const service = new ReorderCollectionImagesService(unitOfWork)
      const command: ReorderCollectionImagesCommand = {
        type: 'reorderCollectionImages',
        id: 'collection-123',
        orderedImageIds: ['image-3', 'image-1', 'image-2'], // Reverse order
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
      expect(payload.images[0].imageId).toBe('image-3')
      expect(payload.images[1].imageId).toBe('image-1')
      expect(payload.images[2].imageId).toBe('image-2')

      // Verify event was saved
      const events = db.query(`
        SELECT * FROM events
        WHERE aggregateId = ? AND version = 2 AND eventType = 'collection.images_updated'
      `).all('collection-123') as any[]

      expect(events.length).toBeGreaterThanOrEqual(1)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when collection not found', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new ReorderCollectionImagesService(unitOfWork)
      const command: ReorderCollectionImagesCommand = {
        type: 'reorderCollectionImages',
        id: 'non-existent-collection',
        orderedImageIds: ['image-1', 'image-2'],
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

      const service = new ReorderCollectionImagesService(unitOfWork)
      const command: ReorderCollectionImagesCommand = {
        type: 'reorderCollectionImages',
        id: 'collection-123',
        orderedImageIds: ['image-3', 'image-1', 'image-2'],
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

  test('should throw error when invalid image ID in order array', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionWithMultipleImagesInDatabase(unitOfWork, 'collection-123', 'Test Collection')

      const service = new ReorderCollectionImagesService(unitOfWork)
      const command: ReorderCollectionImagesCommand = {
        type: 'reorderCollectionImages',
        id: 'collection-123',
        orderedImageIds: ['image-1', 'invalid-image', 'image-2'],
        userId: 'user-456',
        expectedVersion: 1,
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow()
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

      const service = new ReorderCollectionImagesService(unitOfWork)
      const command: ReorderCollectionImagesCommand = {
        type: 'reorderCollectionImages',
        id: 'collection-123',
        orderedImageIds: ['image-3', 'image-1', 'image-2'],
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

  test('should preserve other collection fields when reordering', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createCollectionWithMultipleImagesInDatabase(unitOfWork, 'collection-123', 'Test Collection')

      const service = new ReorderCollectionImagesService(unitOfWork)
      const command: ReorderCollectionImagesCommand = {
        type: 'reorderCollectionImages',
        id: 'collection-123',
        orderedImageIds: ['image-3', 'image-1', 'image-2'],
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
      expect(payload.name).toBe('Test Collection')
      expect(payload.description).toBe('Test description')
      expect(payload.slug).toBe('collection-123-slug')
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

      const service = new ReorderCollectionImagesService(unitOfWork)
      const command: ReorderCollectionImagesCommand = {
        type: 'reorderCollectionImages',
        id: 'collection-123',
        orderedImageIds: ['image-3', 'image-1', 'image-2'],
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
      expect(payload.images[0].imageId).toBe('image-1') // Original order preserved
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
