import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDatabase, closeTestDatabase } from '../../helpers/database'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { ReorderVariantImagesService } from '../../../src/app/variant/reorderVariantImagesService'
import { VariantAggregate } from '../../../src/domain/variant/aggregate'
import type { ReorderVariantImagesCommand } from '../../../src/app/variant/commands'

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

function createValidCommand(): ReorderVariantImagesCommand {
  return {
    type: 'reorderVariantImages',
    id: 'variant-123',
    userId: 'user-123',
    orderedImageIds: ['image-3', 'image-1', 'image-2'],
    expectedVersion: 0,
  }
}

async function createVariantWithImagesInDatabase(
  unitOfWork: UnitOfWork,
  variantId: string
) {
  await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
    const variantAggregate = VariantAggregate.create({
      id: variantId,
      correlationId: 'test-correlation',
      userId: 'user-123',
      productId: 'product-123',
      sku: 'TEST-SKU',
      price: 1999,
      inventory: 50,
      options: { Size: 'M' },
    })

    // Add images to the variant
    const images = variantAggregate.images
      .addImage({
        imageId: 'image-1',
        urls: { thumbnail: { original: 'url1', webp: 'url1', avif: 'url1' }, small: { original: 'url1', webp: 'url1', avif: 'url1' }, medium: { original: 'url1', webp: 'url1', avif: 'url1' }, large: { original: 'url1', webp: 'url1', avif: 'url1' }, original: { original: 'url1', webp: 'url1', avif: 'url1' } },
      }, 'First image')
      .addImage({
        imageId: 'image-2',
        urls: { thumbnail: { original: 'url2', webp: 'url2', avif: 'url2' }, small: { original: 'url2', webp: 'url2', avif: 'url2' }, medium: { original: 'url2', webp: 'url2', avif: 'url2' }, large: { original: 'url2', webp: 'url2', avif: 'url2' }, original: { original: 'url2', webp: 'url2', avif: 'url2' } },
      }, 'Second image')
      .addImage({
        imageId: 'image-3',
        urls: { thumbnail: { original: 'url3', webp: 'url3', avif: 'url3' }, small: { original: 'url3', webp: 'url3', avif: 'url3' }, medium: { original: 'url3', webp: 'url3', avif: 'url3' }, large: { original: 'url3', webp: 'url3', avif: 'url3' }, original: { original: 'url3', webp: 'url3', avif: 'url3' } },
      }, 'Third image')

    variantAggregate.updateImages(images, 'user-123')

    snapshotRepository.saveSnapshot({
      aggregate_id: variantAggregate.id,
      correlation_id: 'test-correlation',
      version: variantAggregate.version,
      payload: variantAggregate.toSnapshot(),
    })

    for (const event of variantAggregate.uncommittedEvents) {
      eventRepository.addEvent(event)
      outboxRepository.addOutboxEvent(event, { id: crypto.randomUUID() })
    }
  })
}

describe('ReorderVariantImagesService', () => {
  test('should successfully reorder variant images', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      command.expectedVersion = 1 // After adding images
      await createVariantWithImagesInDatabase(unitOfWork, command.id)

      const service = new ReorderVariantImagesService(unitOfWork)

      // Act
      await service.execute(command)

      // Assert
      const variantSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregate_id = ?
      `).get(command.id) as any

      expect(variantSnapshot).not.toBeNull()
      expect(variantSnapshot.version).toBe(2)

      const variantPayload = JSON.parse(variantSnapshot.payload)
      expect(variantPayload.images).toHaveLength(3)
      expect(variantPayload.images[0].imageId).toBe('image-3')
      expect(variantPayload.images[1].imageId).toBe('image-1')
      expect(variantPayload.images[2].imageId).toBe('image-2')

      // Verify event was saved
      const events = db.query(`
        SELECT * FROM events
        WHERE aggregate_id = ? AND version = 2
      `).all(command.id) as any[]

      expect(events.length).toBeGreaterThan(0)
      expect(events[0].event_type).toBe('variant.images_updated')

      // Verify event added to outbox
      const outboxCount = db.query(`
        SELECT COUNT(*) as count FROM outbox
        WHERE aggregate_id = ?
      `).get(command.id) as any

      expect(outboxCount.count).toBeGreaterThan(0)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when variant does not exist', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      const service = new ReorderVariantImagesService(unitOfWork)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow(`Variant with id ${command.id} not found`)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error on optimistic concurrency conflict', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      command.expectedVersion = 5
      await createVariantWithImagesInDatabase(unitOfWork, command.id)

      const service = new ReorderVariantImagesService(unitOfWork)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow(
        'Optimistic concurrency conflict: expected version 5 but found version 1'
      )
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should increment version after reordering', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      command.expectedVersion = 1
      await createVariantWithImagesInDatabase(unitOfWork, command.id)

      const service = new ReorderVariantImagesService(unitOfWork)

      // Act
      await service.execute(command)

      // Assert
      const snapshot = db.query(`
        SELECT version FROM snapshots
        WHERE aggregate_id = ?
      `).get(command.id) as any

      expect(snapshot.version).toBe(2)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should preserve correlationId from original snapshot', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      command.expectedVersion = 1
      const originalCorrelationId = 'original-correlation-123'

      await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
        const variantAggregate = VariantAggregate.create({
          id: command.id,
          correlationId: originalCorrelationId,
          userId: 'user-123',
          productId: 'product-123',
          sku: 'TEST-SKU',
          price: 1999,
          inventory: 50,
          options: { Size: 'M' },
        })

        const images = variantAggregate.images
          .addImage({
            imageId: 'image-1',
            urls: { thumbnail: { original: 'url1', webp: 'url1', avif: 'url1' }, small: { original: 'url1', webp: 'url1', avif: 'url1' }, medium: { original: 'url1', webp: 'url1', avif: 'url1' }, large: { original: 'url1', webp: 'url1', avif: 'url1' }, original: { original: 'url1', webp: 'url1', avif: 'url1' } },
          }, 'First image')
          .addImage({
            imageId: 'image-2',
            urls: { thumbnail: { original: 'url2', webp: 'url2', avif: 'url2' }, small: { original: 'url2', webp: 'url2', avif: 'url2' }, medium: { original: 'url2', webp: 'url2', avif: 'url2' }, large: { original: 'url2', webp: 'url2', avif: 'url2' }, original: { original: 'url2', webp: 'url2', avif: 'url2' } },
          }, 'Second image')
          .addImage({
            imageId: 'image-3',
            urls: { thumbnail: { original: 'url3', webp: 'url3', avif: 'url3' }, small: { original: 'url3', webp: 'url3', avif: 'url3' }, medium: { original: 'url3', webp: 'url3', avif: 'url3' }, large: { original: 'url3', webp: 'url3', avif: 'url3' }, original: { original: 'url3', webp: 'url3', avif: 'url3' } },
          }, 'Third image')

        variantAggregate.updateImages(images, 'user-123')

        snapshotRepository.saveSnapshot({
          aggregate_id: variantAggregate.id,
          correlation_id: originalCorrelationId,
          version: variantAggregate.version,
          payload: variantAggregate.toSnapshot(),
        })

        for (const event of variantAggregate.uncommittedEvents) {
          eventRepository.addEvent(event)
          outboxRepository.addOutboxEvent(event, { id: crypto.randomUUID() })
        }
      })

      const service = new ReorderVariantImagesService(unitOfWork)

      // Act
      await service.execute(command)

      // Assert
      const snapshot = db.query(`
        SELECT correlation_id FROM snapshots
        WHERE aggregate_id = ? AND version = 2
      `).get(command.id) as any

      expect(snapshot.correlation_id).toBe(originalCorrelationId)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should set correct access level', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new ReorderVariantImagesService(unitOfWork)

      // Assert
      expect(service.accessLevel).toBe('admin')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should rollback on error and not modify data', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      command.expectedVersion = 99
      await createVariantWithImagesInDatabase(unitOfWork, command.id)

      const service = new ReorderVariantImagesService(unitOfWork)

      // Get initial state
      const initialSnapshot = db.query(`
        SELECT payload, version FROM snapshots
        WHERE aggregate_id = ?
      `).get(command.id) as any

      const initialPayload = JSON.parse(initialSnapshot.payload)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow()

      // Verify state wasn't modified
      const finalSnapshot = db.query(`
        SELECT payload, version FROM snapshots
        WHERE aggregate_id = ?
      `).get(command.id) as any

      const finalPayload = JSON.parse(finalSnapshot.payload)

      expect(finalSnapshot.version).toBe(initialSnapshot.version)
      expect(finalPayload.images[0].imageId).toBe(initialPayload.images[0].imageId)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should preserve image properties after reordering', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      command.expectedVersion = 1
      await createVariantWithImagesInDatabase(unitOfWork, command.id)

      const service = new ReorderVariantImagesService(unitOfWork)

      // Act
      await service.execute(command)

      // Assert
      const variantSnapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregate_id = ?
      `).get(command.id) as any

      const variantPayload = JSON.parse(variantSnapshot.payload)

      // Verify all image properties are preserved
      const reorderedImage = variantPayload.images.find((img: any) => img.imageId === 'image-1')
      expect(reorderedImage.urls.original.original).toBe('url1')
      expect(reorderedImage.altText).toBe('First image')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
