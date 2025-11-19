import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { CreateProductService } from '../../../src/app/product/createProductService'
import { CreateVariantService } from '../../../src/app/variant/createVariantService'
import { AddVariantImageService } from '../../../src/app/variant/addVariantImageService'
import { UpdateVariantImageAltTextService } from '../../../src/app/variant/updateVariantImageAltTextService'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { schemas } from '../../../src/infrastructure/schemas'
import { ProjectionService } from '../../../src/infrastructure/projectionService'
import type { CreateProductCommand } from '../../../src/app/product/commands'
import type { CreateVariantCommand, AddVariantImageCommand, UpdateVariantImageAltTextCommand } from '../../../src/app/variant/commands'
import type { ImageUploadHelper } from '../../../src/infrastructure/imageUploadHelper'
import type { ImageUploadResult } from '../../../src/infrastructure/adapters/imageStorageAdapter'

function createValidProductCommand(overrides?: Partial<CreateProductCommand>): CreateProductCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    correlationId: overrides?.correlationId ?? randomUUIDv7(),
    userId: overrides?.userId ?? randomUUIDv7(),
    title: 'Test Product',
    shortDescription: 'A test product',
    slug: `test-product-${randomUUIDv7()}`,
    collectionIds: [randomUUIDv7()],
    variantIds: overrides?.variantIds ?? [randomUUIDv7()],
    richDescriptionUrl: 'https://example.com/description',
    productType: 'physical',
    fulfillmentType: 'digital' as const,
    vendor: 'Test Vendor',
    variantOptions: [
      { name: 'Size', values: ['S', 'M', 'L', 'XL'] },
      { name: 'Color', values: ['Red', 'Blue', 'Green'] }
    ],
    metaTitle: 'Test Product Meta Title',
    metaDescription: 'Test Product Meta Description',
    tags: ['test', 'product'],
    requiresShipping: true,
    taxable: true,
    pageLayoutId: null,
  }
}

function createValidVariantCommand(productId: string, overrides?: Partial<CreateVariantCommand>): CreateVariantCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    correlationId: overrides?.correlationId ?? randomUUIDv7(),
    userId: overrides?.userId ?? randomUUIDv7(),
    productId,
    sku: overrides?.sku ?? `SKU-${randomUUIDv7()}`,
    title: 'Test Variant',
    price: 29.99,
    inventory: 100,
    options: overrides?.options ?? { Size: 'L', Color: 'Red' },
    barcode: overrides?.barcode ?? '123456789',
  }
}

function createAddImageCommand(overrides?: Partial<AddVariantImageCommand>): AddVariantImageCommand {
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

function createUpdateAltTextCommand(overrides?: Partial<UpdateVariantImageAltTextCommand>): UpdateVariantImageAltTextCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    userId: overrides?.userId ?? randomUUIDv7(),
    imageId: overrides?.imageId ?? randomUUIDv7(),
    altText: overrides?.altText ?? 'Updated alt text',
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

describe('UpdateVariantImageAltTextService', () => {
  test('should successfully update image alt text', async () => {
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
    const productService = new CreateProductService(unitOfWork, projectionService)
    const variantService = new CreateVariantService(unitOfWork, projectionService)
    const addImageService = new AddVariantImageService(unitOfWork, projectionService, imageUploadHelper)
    const updateAltTextService = new UpdateVariantImageAltTextService(unitOfWork, projectionService)

    const productCommand = createValidProductCommand()
    await productService.execute(productCommand)

    const variantCommand = createValidVariantCommand(productCommand.id)
    await variantService.execute(variantCommand)

    await new Promise(resolve => setTimeout(resolve, 100))

    const addImageCommand = createAddImageCommand({
      id: variantCommand.id,
      expectedVersion: 0,
      altText: 'Original alt text',
    })
    await addImageService.execute(addImageCommand)

    await new Promise(resolve => setTimeout(resolve, 100))

    // Get image ID
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(variantCommand.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    const imageId = snapshotPayload.images[0].imageId

    const updateAltTextCommand = createUpdateAltTextCommand({
      id: variantCommand.id,
      imageId,
      altText: 'New alt text for accessibility',
      expectedVersion: 1,
    })

    // Act
    await updateAltTextService.execute(updateAltTextCommand)

    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - Verify alt text was updated
    const updatedSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(variantCommand.id) as any
    const updatedPayload = JSON.parse(updatedSnapshot.payload)
    expect(updatedPayload.images[0].altText).toBe('New alt text for accessibility')
    expect(updatedSnapshot.version).toBe(2)

    // Assert - Verify images_updated event was saved
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(variantCommand.id) as any[]
    expect(events.length).toBe(3) // created + images_updated (add) + images_updated (update alt text)
    expect(events[2]!.event_type).toBe('variant.images_updated')

    batcher.stop()
    db.close()
  })

  test('should throw error when variant does not exist', async () => {
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
    const updateAltTextService = new UpdateVariantImageAltTextService(unitOfWork, projectionService)
    const updateAltTextCommand = createUpdateAltTextCommand()

    // Act & Assert
    await expect(updateAltTextService.execute(updateAltTextCommand)).rejects.toThrow('Variant with id')

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
    const productService = new CreateProductService(unitOfWork, projectionService)
    const variantService = new CreateVariantService(unitOfWork, projectionService)
    const addImageService = new AddVariantImageService(unitOfWork, projectionService, imageUploadHelper)
    const updateAltTextService = new UpdateVariantImageAltTextService(unitOfWork, projectionService)

    const productCommand = createValidProductCommand()
    await productService.execute(productCommand)

    const variantCommand = createValidVariantCommand(productCommand.id)
    await variantService.execute(variantCommand)

    await new Promise(resolve => setTimeout(resolve, 100))

    const addImageCommand = createAddImageCommand({
      id: variantCommand.id,
      expectedVersion: 0,
    })
    await addImageService.execute(addImageCommand)

    await new Promise(resolve => setTimeout(resolve, 100))

    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(variantCommand.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    const imageId = snapshotPayload.images[0].imageId

    const updateAltTextCommand = createUpdateAltTextCommand({
      id: variantCommand.id,
      imageId,
      expectedVersion: 5, // Wrong version
    })

    // Act & Assert
    await expect(updateAltTextService.execute(updateAltTextCommand)).rejects.toThrow('Optimistic concurrency conflict')

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
    const productService = new CreateProductService(unitOfWork, projectionService)
    const variantService = new CreateVariantService(unitOfWork, projectionService)
    const updateAltTextService = new UpdateVariantImageAltTextService(unitOfWork, projectionService)

    const productCommand = createValidProductCommand()
    await productService.execute(productCommand)

    const variantCommand = createValidVariantCommand(productCommand.id)
    await variantService.execute(variantCommand)

    await new Promise(resolve => setTimeout(resolve, 100))

    const nonExistentImageId = randomUUIDv7()
    const updateAltTextCommand = createUpdateAltTextCommand({
      id: variantCommand.id,
      imageId: nonExistentImageId,
      expectedVersion: 0,
    })

    // Act & Assert
    await expect(updateAltTextService.execute(updateAltTextCommand)).rejects.toThrow(`Image with id ${nonExistentImageId} not found`)

    batcher.stop()
    db.close()
  })

  test('should update alt text for one image without affecting others', async () => {
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
    const productService = new CreateProductService(unitOfWork, projectionService)
    const variantService = new CreateVariantService(unitOfWork, projectionService)
    const addImageService = new AddVariantImageService(unitOfWork, projectionService, imageUploadHelper)
    const updateAltTextService = new UpdateVariantImageAltTextService(unitOfWork, projectionService)

    const productCommand = createValidProductCommand()
    await productService.execute(productCommand)

    const variantCommand = createValidVariantCommand(productCommand.id)
    await variantService.execute(variantCommand)

    await new Promise(resolve => setTimeout(resolve, 100))

    // Add two images
    const addImageCommand1 = createAddImageCommand({
      id: variantCommand.id,
      expectedVersion: 0,
      altText: 'First image',
    })
    await addImageService.execute(addImageCommand1)

    await new Promise(resolve => setTimeout(resolve, 100))

    const addImageCommand2 = createAddImageCommand({
      id: variantCommand.id,
      expectedVersion: 1,
      altText: 'Second image',
    })
    await addImageService.execute(addImageCommand2)

    await new Promise(resolve => setTimeout(resolve, 100))

    // Get first image ID
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(variantCommand.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    const firstImageId = snapshotPayload.images[0].imageId

    const updateAltTextCommand = createUpdateAltTextCommand({
      id: variantCommand.id,
      imageId: firstImageId,
      altText: 'Updated first image',
      expectedVersion: 2,
    })

    // Act
    await updateAltTextService.execute(updateAltTextCommand)

    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - Only first image alt text was updated
    const updatedSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(variantCommand.id) as any
    const updatedPayload = JSON.parse(updatedSnapshot.payload)
    expect(updatedPayload.images[0].altText).toBe('Updated first image')
    expect(updatedPayload.images[1].altText).toBe('Second image') // Unchanged

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
    const updateAltTextService = new UpdateVariantImageAltTextService(unitOfWork, projectionService)
    const updateAltTextCommand = createUpdateAltTextCommand()

    // Act & Assert
    await expect(updateAltTextService.execute(updateAltTextCommand)).rejects.toThrow()

    // Assert - Verify nothing was persisted
    const eventCount = db.query('SELECT COUNT(*) as count FROM events').get() as { count: number }
    expect(eventCount.count).toBe(0)

    batcher.stop()
    db.close()
  })
})
