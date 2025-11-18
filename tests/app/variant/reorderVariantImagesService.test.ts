import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { CreateProductService } from '../../../src/app/product/createProductService'
import { CreateVariantService } from '../../../src/app/variant/createVariantService'
import { AddVariantImageService } from '../../../src/app/variant/addVariantImageService'
import { ReorderVariantImagesService } from '../../../src/app/variant/reorderVariantImagesService'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { schemas } from '../../../src/infrastructure/schemas'
import { ProjectionService } from '../../../src/infrastructure/projectionService'
import type { CreateProductCommand } from '../../../src/app/product/commands'
import type { CreateVariantCommand, AddVariantImageCommand, ReorderVariantImagesCommand } from '../../../src/app/variant/commands'
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
    weight: overrides?.weight ?? 1.5,
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

function createReorderCommand(overrides?: Partial<ReorderVariantImagesCommand>): ReorderVariantImagesCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    userId: overrides?.userId ?? randomUUIDv7(),
    orderedImageIds: overrides?.orderedImageIds ?? [],
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

describe('ReorderVariantImagesService', () => {
  test('should successfully reorder images in variant', async () => {
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
    const reorderService = new ReorderVariantImagesService(unitOfWork, projectionService)

    const productCommand = createValidProductCommand()
    await productService.execute(productCommand)

    const variantCommand = createValidVariantCommand(productCommand.id)
    await variantService.execute(variantCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Add three images
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

    const addImageCommand3 = createAddImageCommand({
      id: variantCommand.id,
      expectedVersion: 2,
      altText: 'Third image',
    })
    await addImageService.execute(addImageCommand3)

    await new Promise(resolve => setTimeout(resolve, 100))

    // Get image IDs in current order
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(variantCommand.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    const imageIds = snapshotPayload.images.map((img: any) => img.imageId)

    // Reverse the order
    const newOrder = [imageIds[2], imageIds[1], imageIds[0]]

    const reorderCommand = createReorderCommand({
      id: variantCommand.id,
      orderedImageIds: newOrder,
      expectedVersion: 3,
    })

    // Act
    await reorderService.execute(reorderCommand)

    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - Verify images are in new order
    const updatedSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(variantCommand.id) as any
    const updatedPayload = JSON.parse(updatedSnapshot.payload)
    expect(updatedPayload.images[0].altText).toBe('Third image')
    expect(updatedPayload.images[1].altText).toBe('Second image')
    expect(updatedPayload.images[2].altText).toBe('First image')

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
    const reorderService = new ReorderVariantImagesService(unitOfWork, projectionService)
    const reorderCommand = createReorderCommand()

    // Act & Assert
    await expect(reorderService.execute(reorderCommand)).rejects.toThrow('Variant with id')

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
    const reorderService = new ReorderVariantImagesService(unitOfWork, projectionService)

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
    const imageIds = snapshotPayload.images.map((img: any) => img.imageId)

    const reorderCommand = createReorderCommand({
      id: variantCommand.id,
      orderedImageIds: imageIds,
      expectedVersion: 5, // Wrong version
    })

    // Act & Assert
    await expect(reorderService.execute(reorderCommand)).rejects.toThrow('Optimistic concurrency conflict')

    batcher.stop()
    db.close()
  })

  test('should throw error when ordered image IDs do not match variant images', async () => {
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
    const reorderService = new ReorderVariantImagesService(unitOfWork, projectionService)

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

    // Use a different image ID
    const reorderCommand = createReorderCommand({
      id: variantCommand.id,
      orderedImageIds: [randomUUIDv7()],
      expectedVersion: 1,
    })

    // Act & Assert
    await expect(reorderService.execute(reorderCommand)).rejects.toThrow()

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
    const reorderService = new ReorderVariantImagesService(unitOfWork, projectionService)
    const reorderCommand = createReorderCommand()

    // Act & Assert
    await expect(reorderService.execute(reorderCommand)).rejects.toThrow()

    // Assert - Verify nothing was persisted
    const eventCount = db.query('SELECT COUNT(*) as count FROM events').get() as { count: number }
    expect(eventCount.count).toBe(0)

    batcher.stop()
    db.close()
  })
})
