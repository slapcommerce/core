import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDatabase, closeTestDatabase } from '../../helpers/database'
import { TransactionBatcher } from '../../../../src/api/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../../src/api/infrastructure/unitOfWork'
import { AddVariantImageService } from '../../../../src/api/app/variant/addVariantImageService'
import { VariantAggregate } from '../../../../src/api/domain/variant/aggregate'
import type { AddVariantImageCommand } from '../../../../src/api/app/variant/commands'
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

function createValidCommand(): AddVariantImageCommand {
  // Create a simple base64 encoded image
  const base64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

  return {
    type: 'addVariantImage',
    id: 'variant-123',
    userId: 'user-123',
    imageData: base64Image,
    filename: 'test-image.png',
    contentType: 'image/png',
    altText: 'Test image',
    expectedVersion: 0,
  }
}

async function createVariantInDatabase(
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

class MockImageUploadHelper {
  imageStorageAdapter = null as any;
  imageOptimizer = null as any;
  getExtensionFromContentType = (contentType: string) => 'jpg';

  async uploadImage(
    buffer: ArrayBuffer,
    filename: string,
    contentType: string
  ): Promise<ImageUploadResult> {
    return {
      imageId: 'test-image-id',
      urls: {
        thumbnail: {
          original: 'https://example.com/images/test-image-id-thumb.png',
          webp: 'https://example.com/images/test-image-id-thumb.webp',
          avif: 'https://example.com/images/test-image-id-thumb.avif',
        },
        small: {
          original: 'https://example.com/images/test-image-id-small.png',
          webp: 'https://example.com/images/test-image-id-small.webp',
          avif: 'https://example.com/images/test-image-id-small.avif',
        },
        medium: {
          original: 'https://example.com/images/test-image-id-medium.png',
          webp: 'https://example.com/images/test-image-id-medium.webp',
          avif: 'https://example.com/images/test-image-id-medium.avif',
        },
        large: {
          original: 'https://example.com/images/test-image-id-large.png',
          webp: 'https://example.com/images/test-image-id-large.webp',
          avif: 'https://example.com/images/test-image-id-large.avif',
        },
        original: {
          original: 'https://example.com/images/test-image-id.png',
          webp: 'https://example.com/images/test-image-id.webp',
          avif: 'https://example.com/images/test-image-id.avif',
        },
      },
    }
  }
}

describe('AddVariantImageService', () => {
  test('should successfully add image to variant', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      await createVariantInDatabase(unitOfWork, command.id)

      const mockImageUploadHelper = new MockImageUploadHelper()
      const service = new AddVariantImageService(unitOfWork, mockImageUploadHelper as any)

      // Act
      await service.execute(command)

      // Assert
      const variantSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregate_id = ?
      `).get(command.id) as any

      expect(variantSnapshot).not.toBeNull()
      expect(variantSnapshot.version).toBe(1)

      const variantPayload = JSON.parse(variantSnapshot.payload)
      expect(variantPayload.images).toHaveLength(1)
      expect(variantPayload.images[0].urls.original.original).toBe('https://example.com/images/test-image-id.png')
      expect(variantPayload.images[0].altText).toBe(command.altText)

      // Verify event was saved
      const events = db.query(`
        SELECT * FROM events
        WHERE aggregate_id = ? AND version = 1
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

  test('should add image with empty alt text when not provided', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      command.altText = ''
      await createVariantInDatabase(unitOfWork, command.id)

      const mockImageUploadHelper = new MockImageUploadHelper()
      const service = new AddVariantImageService(unitOfWork, mockImageUploadHelper as any)

      // Act
      await service.execute(command)

      // Assert
      const variantSnapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregate_id = ?
      `).get(command.id) as any

      const variantPayload = JSON.parse(variantSnapshot.payload)
      expect(variantPayload.images[0].altText).toBe('')
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
      const mockImageUploadHelper = new MockImageUploadHelper()
      const service = new AddVariantImageService(unitOfWork, mockImageUploadHelper as any)

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
      await createVariantInDatabase(unitOfWork, command.id)

      const mockImageUploadHelper = new MockImageUploadHelper()
      const service = new AddVariantImageService(unitOfWork, mockImageUploadHelper as any)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow(
        'Optimistic concurrency conflict: expected version 5 but found version 0'
      )
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should increment version after adding image', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      await createVariantInDatabase(unitOfWork, command.id)

      const mockImageUploadHelper = new MockImageUploadHelper()
      const service = new AddVariantImageService(unitOfWork, mockImageUploadHelper as any)

      // Act
      await service.execute(command)

      // Assert
      const snapshot = db.query(`
        SELECT version FROM snapshots
        WHERE aggregate_id = ?
      `).get(command.id) as any

      expect(snapshot.version).toBe(1)
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

      const mockImageUploadHelper = new MockImageUploadHelper()
      const service = new AddVariantImageService(unitOfWork, mockImageUploadHelper as any)

      // Act
      await service.execute(command)

      // Assert
      const snapshot = db.query(`
        SELECT correlation_id FROM snapshots
        WHERE aggregate_id = ? AND version = 1
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
      const mockImageUploadHelper = new MockImageUploadHelper()
      const service = new AddVariantImageService(unitOfWork, mockImageUploadHelper as any)

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
      await createVariantInDatabase(unitOfWork, command.id)

      const mockImageUploadHelper = new MockImageUploadHelper()
      const service = new AddVariantImageService(unitOfWork, mockImageUploadHelper as any)

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
      expect(finalPayload.images.length).toBe(initialPayload.images.length)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should add multiple images to variant', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      await createVariantInDatabase(unitOfWork, command.id)

      const mockImageUploadHelper = new MockImageUploadHelper()
      const service = new AddVariantImageService(unitOfWork, mockImageUploadHelper as any)

      // Act - Add first image
      await service.execute(command)

      // Add second image
      const command2 = createValidCommand()
      command2.expectedVersion = 1
      command2.altText = 'Second image'
      await service.execute(command2)

      // Assert
      const variantSnapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregate_id = ?
      `).get(command.id) as any

      const variantPayload = JSON.parse(variantSnapshot.payload)
      expect(variantPayload.images).toHaveLength(2)
      expect(variantPayload.images[0].altText).toBe('Test image')
      expect(variantPayload.images[1].altText).toBe('Second image')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
