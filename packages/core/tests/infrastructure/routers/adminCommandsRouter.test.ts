import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { createAdminCommandsRouter } from '../../../src/infrastructure/routers/adminCommandsRouter'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { createTestDatabase, closeTestDatabase } from '../../helpers/database'
import {
  CreateProductCommand,
  ArchiveProductCommand,
  PublishProductCommand,
  ChangeSlugCommand,
  UpdateProductDetailsCommand,
  UpdateProductMetadataCommand,
  UpdateProductClassificationCommand,
  UpdateProductTagsCommand,
  UpdateProductOptionsCommand,
  UpdateProductTaxDetailsCommand,
} from '../../../src/app/product/commands'
import {
  CreateCollectionCommand,
  ArchiveCollectionCommand,
  PublishCollectionCommand,
  UpdateCollectionMetadataCommand,
  UnpublishCollectionCommand,
  UpdateCollectionSeoMetadataCommand,
} from '../../../src/app/collection/commands'
import {
  CreateVariantCommand,
  ArchiveVariantCommand,
  PublishVariantCommand,
  UpdateVariantDetailsCommand,
  UpdateVariantInventoryCommand,
  UpdateVariantPriceCommand,
  AttachVariantDigitalAssetCommand,
  DetachVariantDigitalAssetCommand,
} from '../../../src/app/variant/commands'

function createValidCreateProductCommand(): CreateProductCommand {
  return {
    id: randomUUIDv7(),
    correlationId: randomUUIDv7(),
    userId: randomUUIDv7(),
    title: 'Test Product',
    shortDescription: 'A test product',
    slug: 'test-product',
    collectionIds: [randomUUIDv7()],
    variantIds: [randomUUIDv7()],
    richDescriptionUrl: 'https://example.com/description',
    productType: 'physical',
    fulfillmentType: 'dropship' as const,
    dropshipSafetyBuffer: 1,
    vendor: 'Test Vendor',
    variantOptions: [{ name: 'Size', values: ['S', 'M', 'L'] }],
    metaTitle: 'Test Product Meta Title',
    metaDescription: 'Test Product Meta Description',
    tags: ['test', 'product'],
    taxable: true,
    taxId: '',
    type: 'createProduct',
  }
}

function createValidCreateCollectionCommand(): CreateCollectionCommand {
  return {
    id: randomUUIDv7(),
    correlationId: randomUUIDv7(),
    userId: randomUUIDv7(),
    name: 'Test Collection',
    description: 'A test collection',
    slug: 'test-collection',
    type: 'createCollection',
  }
}

function createValidCreateVariantCommand(): CreateVariantCommand {
  return {
    id: randomUUIDv7(),
    correlationId: randomUUIDv7(),
    userId: randomUUIDv7(),
    productId: randomUUIDv7(),
    sku: 'TEST-SKU-001',
    price: 29.99,
    inventory: 100,
    options: { Size: 'M' }, // Must match product's variantOptions
    type: 'createVariant',
  }
}

function createTestRouter() {
  const db = createTestDatabase()
  const batcher = new TransactionBatcher(db, {
    flushIntervalMs: 50,
    batchSizeThreshold: 10,
    maxQueueDepth: 100
  })
  batcher.start()

  const unitOfWork = new UnitOfWork(db, batcher)

  // Mock upload helpers
  const mockImageUploadHelper = {
    async uploadImage(buffer: ArrayBuffer, filename: string, contentType: string) {
      return {
        imageId: `images/${filename}`,
        filename: filename,
        sizes: {},
      }
    }
  } as any

  const mockDigitalAssetUploadHelper = {
    async uploadAsset(buffer: ArrayBuffer, filename: string, mimeType: string) {
      return {
        assetId: `assets/${filename}`,
        filename: filename,
        size: buffer.byteLength,
        url: `/storage/digital-assets/assets/${filename}/${filename}`,
      }
    }
  } as any

  const router = createAdminCommandsRouter(
    unitOfWork,
    mockImageUploadHelper,
    mockDigitalAssetUploadHelper
  )

  return { db, batcher, router }
}

describe('createAdminCommandsRouter', () => {
  test('should execute createProduct command successfully', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()

    try {
      const command = createValidCreateProductCommand()
      const payload = command

      // Act
      const result = await router('createProduct', payload)

      // Assert
      expect(result.success).toBe(true)

      // Wait for batch to flush
      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify event was created
      const event = db.query('SELECT * FROM events WHERE aggregate_id = ?').get(command.id) as any
      expect(event).toBeDefined()
      expect(event.event_type).toBe('product.created')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should execute archiveProduct command successfully', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()

    try {
      // First create a product
      const createCommand = createValidCreateProductCommand()
      await router('createProduct', createCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      const archiveCommand: ArchiveProductCommand = {
        id: createCommand.id,
        expectedVersion: 0,
        userId: randomUUIDv7(),
        type: 'archiveProduct',
      }

      // Act
      const result = await router('archiveProduct', archiveCommand)

      // Assert
      expect(result.success).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify archive event was created
      const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version').all(createCommand.id) as any[]
      expect(events.length).toBeGreaterThan(1)
      expect(events[events.length - 1].event_type).toBe('product.archived')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should execute publishProduct command successfully', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()

    try {
      // First create a product
      const createCommand = createValidCreateProductCommand()
      await router('createProduct', createCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      const publishCommand: PublishProductCommand = {
        id: createCommand.id,
        expectedVersion: 0,
        userId: randomUUIDv7(),
        type: 'publishProduct',
      }

      // Act
      const result = await router('publishProduct', publishCommand)

      // Assert
      expect(result.success).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify publish event was created
      const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version').all(createCommand.id) as any[]
      expect(events.length).toBeGreaterThan(1)
      expect(events[events.length - 1].event_type).toBe('product.published')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should execute changeSlug command successfully', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()

    try {
      // First create a product
      const createCommand = createValidCreateProductCommand()
      await router('createProduct', createCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      const changeSlugCommand: ChangeSlugCommand = {
        id: createCommand.id,
        newSlug: 'new-test-product',
        expectedVersion: 0,
        userId: randomUUIDv7(),
        type: 'changeSlug',
      }

      // Act
      const result = await router('changeSlug', changeSlugCommand)

      // Assert
      expect(result.success).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify slug change event was created
      const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version').all(createCommand.id) as any[]
      expect(events.length).toBeGreaterThan(1)
      expect(events[events.length - 1].event_type).toBe('product.slug_changed')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should execute updateProductDetails command successfully', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()

    try {
      // First create a product
      const createCommand = createValidCreateProductCommand()
      await router('createProduct', createCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      const updateCommand: UpdateProductDetailsCommand = {
        id: createCommand.id,
        title: 'Updated Title',
        shortDescription: 'Updated description',
        richDescriptionUrl: 'https://example.com/updated',
        expectedVersion: 0,
        userId: randomUUIDv7(),
        type: 'updateProductDetails',
      }

      // Act
      const result = await router('updateProductDetails', updateCommand)

      // Assert
      expect(result.success).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify update event was created
      const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version').all(createCommand.id) as any[]
      expect(events.length).toBeGreaterThan(1)
      expect(events[events.length - 1].event_type).toBe('product.details_updated')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should execute updateProductMetadata command successfully', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()

    try {
      // First create a product
      const createCommand = createValidCreateProductCommand()
      await router('createProduct', createCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      const updateCommand: UpdateProductMetadataCommand = {
        id: createCommand.id,
        metaTitle: 'Updated Meta Title',
        metaDescription: 'Updated Meta Description',
        expectedVersion: 0,
        userId: randomUUIDv7(),
        type: 'updateProductMetadata',
      }

      // Act
      const result = await router('updateProductMetadata', updateCommand)

      // Assert
      expect(result.success).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify update event was created
      const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version').all(createCommand.id) as any[]
      expect(events.length).toBeGreaterThan(1)
      expect(events[events.length - 1].event_type).toBe('product.metadata_updated')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should execute updateProductClassification command successfully', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()

    try {
      // First create a product
      const createCommand = createValidCreateProductCommand()
      await router('createProduct', createCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      const updateCommand: UpdateProductClassificationCommand = {
        id: createCommand.id,
        productType: 'digital',
        vendor: 'New Vendor',
        expectedVersion: 0,
        userId: randomUUIDv7(),
        type: 'updateProductClassification',
      }

      // Act
      const result = await router('updateProductClassification', updateCommand)

      // Assert
      expect(result.success).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify update event was created
      const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version').all(createCommand.id) as any[]
      expect(events.length).toBeGreaterThan(1)
      expect(events[events.length - 1].event_type).toBe('product.classification_updated')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should execute updateProductTags command successfully', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()

    try {
      // First create a product
      const createCommand = createValidCreateProductCommand()
      await router('createProduct', createCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      const updateCommand: UpdateProductTagsCommand = {
        id: createCommand.id,
        tags: ['new', 'tags'],
        expectedVersion: 0,
        userId: randomUUIDv7(),
        type: 'updateProductTags',
      }

      // Act
      const result = await router('updateProductTags', updateCommand)

      // Assert
      expect(result.success).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify update event was created
      const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version').all(createCommand.id) as any[]
      expect(events.length).toBeGreaterThan(1)
      expect(events[events.length - 1].event_type).toBe('product.tags_updated')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should execute createCollection command successfully', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()

    try {
      const command = createValidCreateCollectionCommand()

      // Act
      const result = await router('createCollection', command)

      // Assert
      expect(result.success).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify event was created
      const event = db.query('SELECT * FROM events WHERE aggregate_id = ?').get(command.id) as any
      expect(event).toBeDefined()
      expect(event.event_type).toBe('collection.created')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should execute publishCollection command successfully', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()

    try {
      // First create a collection
      const createCommand = createValidCreateCollectionCommand()
      await router('createCollection', createCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      const publishCommand: PublishCollectionCommand = {
        id: createCommand.id,
        expectedVersion: 0,
        userId: randomUUIDv7(),
        type: 'publishCollection',
      }

      // Act
      const result = await router('publishCollection', publishCommand)

      // Assert
      expect(result.success).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify publish event was created
      const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version').all(createCommand.id) as any[]
      expect(events.length).toBeGreaterThan(1)
      expect(events[events.length - 1].event_type).toBe('collection.published')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should execute archiveCollection command successfully', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()

    try {
      // First create a collection
      const createCommand = createValidCreateCollectionCommand()
      await router('createCollection', createCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      const archiveCommand: ArchiveCollectionCommand = {
        id: createCommand.id,
        expectedVersion: 0,
        userId: randomUUIDv7(),
        type: 'archiveCollection',
      }

      // Act
      const result = await router('archiveCollection', archiveCommand)

      // Assert
      expect(result.success).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify archive event was created
      const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version').all(createCommand.id) as any[]
      expect(events.length).toBeGreaterThan(1)
      expect(events[events.length - 1].event_type).toBe('collection.archived')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should execute updateCollectionMetadata command successfully', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()

    try {
      // First create a collection
      const createCommand = createValidCreateCollectionCommand()
      await router('createCollection', createCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      const updateCommand: UpdateCollectionMetadataCommand = {
        id: createCommand.id,
        name: 'Updated Collection Name',
        description: 'Updated description',
        newSlug: 'updated-collection',
        expectedVersion: 0,
        userId: randomUUIDv7(),
        type: 'updateCollectionMetadata',
      }

      // Act
      const result = await router('updateCollectionMetadata', updateCommand)

      // Assert
      expect(result.success).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify update event was created
      const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version').all(createCommand.id) as any[]
      expect(events.length).toBeGreaterThan(1)
      expect(events[events.length - 1].event_type).toBe('collection.metadata_updated')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should execute unpublishCollection command successfully', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()

    try {
      // First create and publish a collection
      const createCommand = createValidCreateCollectionCommand()
      await router('createCollection', createCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      const publishCommand: PublishCollectionCommand = {
        id: createCommand.id,
        expectedVersion: 0,
        userId: randomUUIDv7(),
        type: 'publishCollection',
      }
      await router('publishCollection', publishCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      const unpublishCommand: UnpublishCollectionCommand = {
        id: createCommand.id,
        expectedVersion: 1,
        userId: randomUUIDv7(),
        type: 'unpublishCollection',
      }

      // Act
      const result = await router('unpublishCollection', unpublishCommand)

      // Assert
      expect(result.success).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify unpublish event was created
      const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version').all(createCommand.id) as any[]
      expect(events.length).toBeGreaterThan(2)
      expect(events[events.length - 1].event_type).toBe('collection.unpublished')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should execute updateCollectionSeoMetadata command successfully', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()

    try {
      // First create a collection
      const createCommand = createValidCreateCollectionCommand()
      await router('createCollection', createCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      const updateCommand: UpdateCollectionSeoMetadataCommand = {
        id: createCommand.id,
        metaTitle: 'Updated SEO Title',
        metaDescription: 'Updated SEO Description',
        expectedVersion: 0,
        userId: randomUUIDv7(),
        type: 'updateCollectionSeoMetadata',
      }

      // Act
      const result = await router('updateCollectionSeoMetadata', updateCommand)

      // Assert
      expect(result.success).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify update event was created
      const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version').all(createCommand.id) as any[]
      expect(events.length).toBeGreaterThan(1)
      expect(events[events.length - 1].event_type).toBe('collection.seo_metadata_updated')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should execute createVariant command successfully', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()

    try {
      // First create a product
      const productCommand = createValidCreateProductCommand()
      await router('createProduct', productCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      const command = createValidCreateVariantCommand()
      command.productId = productCommand.id

      // Act
      const result = await router('createVariant', command)

      // Assert
      expect(result.success).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify event was created
      const event = db.query('SELECT * FROM events WHERE aggregate_id = ?').get(command.id) as any
      expect(event).toBeDefined()
      expect(event.event_type).toBe('variant.created')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should execute archiveVariant command successfully', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()

    try {
      // First create a product, then a variant
      const productCommand = createValidCreateProductCommand()
      await router('createProduct', productCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      const createCommand = createValidCreateVariantCommand()
      createCommand.productId = productCommand.id
      await router('createVariant', createCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      const archiveCommand: ArchiveVariantCommand = {
        id: createCommand.id,
        expectedVersion: 0,
        userId: randomUUIDv7(),
        type: 'archiveVariant',
      }

      // Act
      const result = await router('archiveVariant', archiveCommand)

      // Assert
      expect(result.success).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify archive event was created
      const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version').all(createCommand.id) as any[]
      expect(events.length).toBeGreaterThan(1)
      expect(events[events.length - 1].event_type).toBe('variant.archived')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should execute publishVariant command successfully', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()

    try {
      // First create a product, then a variant
      const productCommand = createValidCreateProductCommand()
      await router('createProduct', productCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      const createCommand = createValidCreateVariantCommand()
      createCommand.productId = productCommand.id
      await router('createVariant', createCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      const publishCommand: PublishVariantCommand = {
        id: createCommand.id,
        expectedVersion: 0,
        userId: randomUUIDv7(),
        type: 'publishVariant',
      }

      // Act
      const result = await router('publishVariant', publishCommand)

      // Assert
      expect(result.success).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify publish event was created
      const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version').all(createCommand.id) as any[]
      expect(events.length).toBeGreaterThan(1)
      expect(events[events.length - 1].event_type).toBe('variant.published')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should execute updateVariantDetails command successfully', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()

    try {
      // First create a product, then a variant
      const productCommand = createValidCreateProductCommand()
      await router('createProduct', productCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      const createCommand = createValidCreateVariantCommand()
      createCommand.productId = productCommand.id
      await router('createVariant', createCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      const updateCommand: UpdateVariantDetailsCommand = {
        id: createCommand.id,
        options: { Size: 'L' }, // Must match product's variantOptions
        expectedVersion: 0,
        userId: randomUUIDv7(),
        type: 'updateVariantDetails',
      }

      // Act
      const result = await router('updateVariantDetails', updateCommand)

      // Assert
      expect(result.success).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify update event was created
      const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version').all(createCommand.id) as any[]
      expect(events.length).toBeGreaterThan(1)
      expect(events[events.length - 1].event_type).toBe('variant.details_updated')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should execute updateVariantInventory command successfully', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()

    try {
      // First create a product, then a variant
      const productCommand = createValidCreateProductCommand()
      await router('createProduct', productCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      const createCommand = createValidCreateVariantCommand()
      createCommand.productId = productCommand.id
      await router('createVariant', createCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      const updateCommand: UpdateVariantInventoryCommand = {
        id: createCommand.id,
        inventory: 200,
        expectedVersion: 0,
        userId: randomUUIDv7(),
        type: 'updateVariantInventory',
      }

      // Act
      const result = await router('updateVariantInventory', updateCommand)

      // Assert
      expect(result.success).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify update event was created
      const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version').all(createCommand.id) as any[]
      expect(events.length).toBeGreaterThan(1)
      expect(events[events.length - 1].event_type).toBe('variant.inventory_updated')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should execute updateVariantPrice command successfully', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()

    try {
      // First create a product, then a variant
      const productCommand = createValidCreateProductCommand()
      await router('createProduct', productCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      const createCommand = createValidCreateVariantCommand()
      createCommand.productId = productCommand.id
      await router('createVariant', createCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      const updateCommand: UpdateVariantPriceCommand = {
        id: createCommand.id,
        price: 39.99,
        expectedVersion: 0,
        userId: randomUUIDv7(),
        type: 'updateVariantPrice',
      }

      // Act
      const result = await router('updateVariantPrice', updateCommand)

      // Assert
      expect(result.success).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify update event was created
      const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version').all(createCommand.id) as any[]
      expect(events.length).toBeGreaterThan(1)
      expect(events[events.length - 1].event_type).toBe('variant.price_updated')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should return error when type is missing', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()
    const payload = createValidCreateProductCommand()

    try {
      // Act - empty string is falsy, so !type check will catch it
      const result = await router('' as any, payload)

      // Assert
      expect(result.success).toBe(false)
      if (!result.success) {
        const error = (result as { success: false; error: Error }).error
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toBe('Request must include type')
      }
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should return error when payload is missing', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()
    const type = 'createProduct'

    try {
      // Act
      const result = await router(type, null)

      // Assert
      expect(result.success).toBe(false)
      if (!result.success) {
        const error = (result as { success: false; error: Error }).error
        expect(error).toBeInstanceOf(Error)
        // Zod validation error will be thrown when payload is null
        expect(error.message).toBeDefined()
      }
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should return error when command type is unknown', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()
    const type = 'unknownCommand'
    const payload = { id: randomUUIDv7() }

    try {
      // Act
      const result = await router(type as any, payload)

      // Assert
      expect(result.success).toBe(false)
      if (!result.success) {
        const error = (result as { success: false; error: Error }).error
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toBe('Unknown command type: unknownCommand')
      }
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should return error when command payload is invalid', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()
    const type = 'createProduct'
    const payload = { invalid: 'data' }

    try {
      // Act
      const result = await router(type, payload)

      // Assert
      expect(result.success).toBe(false)
      if (!result.success) {
        const error = (result as { success: false; error: Error }).error
        expect(error).toBeInstanceOf(Error)
      }
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should execute updateProductOptions command successfully', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()

    try {
      // First create a product
      const createCommand = createValidCreateProductCommand()
      await router('createProduct', createCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      const updateCommand: UpdateProductOptionsCommand = {
        id: createCommand.id,
        variantOptions: [
          { name: 'Size', values: ['S', 'M', 'L', 'XL'] },
          { name: 'Color', values: ['Red', 'Blue', 'Green'] },
        ],
        expectedVersion: 0,
        userId: randomUUIDv7(),
        type: 'updateProductOptions',
      }

      // Act
      const result = await router('updateProductOptions', updateCommand)

      // Assert
      expect(result.success).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify update event was created
      const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version').all(createCommand.id) as any[]
      expect(events.length).toBeGreaterThan(1)
      expect(events[events.length - 1].event_type).toBe('product.variant_options_updated')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should catch and return service execution errors', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()
    // Try to archive a product that doesn't exist
    const archiveCommand: ArchiveProductCommand = {
      id: randomUUIDv7(),
      expectedVersion: 0,
      userId: randomUUIDv7(),
      type: 'archiveProduct',
    }

    try {
      // Act
      const result = await router('archiveProduct', archiveCommand)

      // Assert
      expect(result.success).toBe(false)
      if (!result.success) {
        const error = (result as { success: false; error: Error }).error
        expect(error).toBeInstanceOf(Error)
      }
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should execute attachVariantDigitalAsset command successfully', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()

    try {
      // Create product with digital fulfillmentType
      const variantId = randomUUIDv7()
      const createProductCommand = createValidCreateProductCommand()
      createProductCommand.variantIds = [variantId]
      createProductCommand.fulfillmentType = 'digital'
      await router('createProduct', createProductCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      // Create variant
      const createVariantCommand = createValidCreateVariantCommand()
      createVariantCommand.id = variantId
      createVariantCommand.productId = createProductCommand.id
      await router('createVariant', createVariantCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      const attachCommand: AttachVariantDigitalAssetCommand = {
        id: createVariantCommand.id,
        userId: randomUUIDv7(),
        assetData: 'data:application/pdf;base64,VGVzdCBmaWxlIGNvbnRlbnQ=',
        filename: 'ebook.pdf',
        mimeType: 'application/pdf',
        expectedVersion: 0,
        type: 'attachVariantDigitalAsset',
      }

      // Act
      const result = await router('attachVariantDigitalAsset', attachCommand)

      // Assert
      expect(result.success).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify attach event was created
      const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version').all(createVariantCommand.id) as any[]
      expect(events.length).toBeGreaterThan(1)
      expect(events[events.length - 1].event_type).toBe('variant.digital_asset_attached')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should execute detachVariantDigitalAsset command successfully', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()

    try {
      // Create product with digital fulfillmentType
      const variantId = randomUUIDv7()
      const createProductCommand = createValidCreateProductCommand()
      createProductCommand.variantIds = [variantId]
      createProductCommand.fulfillmentType = 'digital'
      await router('createProduct', createProductCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      // Create variant
      const createVariantCommand = createValidCreateVariantCommand()
      createVariantCommand.id = variantId
      createVariantCommand.productId = createProductCommand.id
      await router('createVariant', createVariantCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      // Attach digital asset first
      const attachCommand: AttachVariantDigitalAssetCommand = {
        id: createVariantCommand.id,
        userId: randomUUIDv7(),
        assetData: 'data:application/pdf;base64,VGVzdCBmaWxlIGNvbnRlbnQ=',
        filename: 'ebook.pdf',
        mimeType: 'application/pdf',
        expectedVersion: 0,
        type: 'attachVariantDigitalAsset',
      }
      await router('attachVariantDigitalAsset', attachCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      const detachCommand: DetachVariantDigitalAssetCommand = {
        id: createVariantCommand.id,
        userId: randomUUIDv7(),
        expectedVersion: 1,
        type: 'detachVariantDigitalAsset',
      }

      // Act
      const result = await router('detachVariantDigitalAsset', detachCommand)

      // Assert
      expect(result.success).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify detach event was created
      const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version').all(createVariantCommand.id) as any[]
      expect(events.length).toBeGreaterThan(2)
      expect(events[events.length - 1].event_type).toBe('variant.digital_asset_detached')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should fail to attach digital asset when product fulfillmentType is not digital', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()

    try {
      // Create product with dropship fulfillmentType
      const variantId = randomUUIDv7()
      const createProductCommand = createValidCreateProductCommand()
      createProductCommand.variantIds = [variantId]
      createProductCommand.fulfillmentType = 'dropship'
      await router('createProduct', createProductCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      // Create variant
      const createVariantCommand = createValidCreateVariantCommand()
      createVariantCommand.id = variantId
      createVariantCommand.productId = createProductCommand.id
      await router('createVariant', createVariantCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      const attachCommand: AttachVariantDigitalAssetCommand = {
        id: createVariantCommand.id,
        userId: randomUUIDv7(),
        assetData: 'data:application/pdf;base64,VGVzdCBmaWxlIGNvbnRlbnQ=',
        filename: 'ebook.pdf',
        mimeType: 'application/pdf',
        expectedVersion: 0,
        type: 'attachVariantDigitalAsset',
      }

      // Act
      const result = await router('attachVariantDigitalAsset', attachCommand)

      // Assert
      expect(result.success).toBe(false)
      if (!result.success) {
        const error = (result as { success: false; error: Error }).error
        expect(error.message).toContain('product fulfillmentType must be "digital"')
      }
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should successfully execute updateProductTaxDetails command', async () => {
    // Arrange
    const { db, batcher, unitOfWork, router } = createTestRouter()

    try {
      // Create product first
      const createCommand = createValidCreateProductCommand()
      createCommand.taxable = true
      createCommand.taxId = 'OLD-TAX-ID'
      await router('createProduct', createCommand)

      const updateCommand: UpdateProductTaxDetailsCommand = {
        id: createCommand.id,
        type: 'updateProductTaxDetails',
        userId: randomUUIDv7(),
        taxable: false,
        taxId: 'NEW-TAX-ID',
        expectedVersion: 0,
      }

      // Act
      const result = await router('updateProductTaxDetails', updateCommand)

      // Assert
      expect(result.success).toBe(true)

      // Verify the change was persisted
      const snapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregate_id = ?
        ORDER BY version DESC
        LIMIT 1
      `).get(createCommand.id) as any

      expect(snapshot).not.toBeNull()
      expect(snapshot.version).toBe(1)
      const payload = JSON.parse(snapshot.payload)
      expect(payload.taxable).toBe(false)
      expect(payload.taxId).toBe('NEW-TAX-ID')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should return error when updateProductTaxDetails with non-existent product', async () => {
    // Arrange
    const { db, batcher, unitOfWork, router } = createTestRouter()

    try {
      const updateCommand: UpdateProductTaxDetailsCommand = {
        id: randomUUIDv7(),
        type: 'updateProductTaxDetails',
        userId: randomUUIDv7(),
        taxable: false,
        taxId: 'NEW-TAX-ID',
        expectedVersion: 0,
      }

      // Act
      const result = await router('updateProductTaxDetails', updateCommand)

      // Assert
      expect(result.success).toBe(false)
      if (!result.success) {
        const error = (result as { success: false; error: Error }).error
        expect(error.message).toContain('not found')
      }
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should return error when updateProductTaxDetails with wrong version', async () => {
    // Arrange
    const { db, batcher, unitOfWork, router } = createTestRouter()

    try {
      // Create product first
      const createCommand = createValidCreateProductCommand()
      await router('createProduct', createCommand)

      const updateCommand: UpdateProductTaxDetailsCommand = {
        id: createCommand.id,
        type: 'updateProductTaxDetails',
        userId: randomUUIDv7(),
        taxable: false,
        taxId: 'NEW-TAX-ID',
        expectedVersion: 999, // Wrong version
      }

      // Act
      const result = await router('updateProductTaxDetails', updateCommand)

      // Assert
      expect(result.success).toBe(false)
      if (!result.success) {
        const error = (result as { success: false; error: Error }).error
        expect(error.message).toContain('Optimistic concurrency conflict')
      }
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should update taxable from true to false', async () => {
    // Arrange
    const { db, batcher, unitOfWork, router } = createTestRouter()

    try {
      const createCommand = createValidCreateProductCommand()
      createCommand.taxable = true
      await router('createProduct', createCommand)

      const updateCommand: UpdateProductTaxDetailsCommand = {
        id: createCommand.id,
        type: 'updateProductTaxDetails',
        userId: randomUUIDv7(),
        taxable: false,
        taxId: 'TAX-ID',
        expectedVersion: 0,
      }

      // Act
      const result = await router('updateProductTaxDetails', updateCommand)

      // Assert
      expect(result.success).toBe(true)
      const snapshot = db.query(`SELECT * FROM snapshots WHERE aggregate_id = ? ORDER BY version DESC LIMIT 1`).get(createCommand.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.taxable).toBe(false)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should update taxable from false to true', async () => {
    // Arrange
    const { db, batcher, unitOfWork, router } = createTestRouter()

    try {
      const createCommand = createValidCreateProductCommand()
      createCommand.taxable = false
      await router('createProduct', createCommand)

      const updateCommand: UpdateProductTaxDetailsCommand = {
        id: createCommand.id,
        type: 'updateProductTaxDetails',
        userId: randomUUIDv7(),
        taxable: true,
        taxId: 'TAX-ID',
        expectedVersion: 0,
      }

      // Act
      const result = await router('updateProductTaxDetails', updateCommand)

      // Assert
      expect(result.success).toBe(true)
      const snapshot = db.query(`SELECT * FROM snapshots WHERE aggregate_id = ? ORDER BY version DESC LIMIT 1`).get(createCommand.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.taxable).toBe(true)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should update taxId', async () => {
    // Arrange
    const { db, batcher, unitOfWork, router } = createTestRouter()

    try {
      const createCommand = createValidCreateProductCommand()
      createCommand.taxId = 'OLD-TAX'
      await router('createProduct', createCommand)

      const updateCommand: UpdateProductTaxDetailsCommand = {
        id: createCommand.id,
        type: 'updateProductTaxDetails',
        userId: randomUUIDv7(),
        taxable: true,
        taxId: 'NEW-TAX',
        expectedVersion: 0,
      }

      // Act
      const result = await router('updateProductTaxDetails', updateCommand)

      // Assert
      expect(result.success).toBe(true)
      const snapshot = db.query(`SELECT * FROM snapshots WHERE aggregate_id = ? ORDER BY version DESC LIMIT 1`).get(createCommand.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.taxId).toBe('NEW-TAX')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should handle multiple sequential updateProductTaxDetails commands', async () => {
    // Arrange
    const { db, batcher, unitOfWork, router } = createTestRouter()

    try {
      const createCommand = createValidCreateProductCommand()
      await router('createProduct', createCommand)

      // Act - First update
      await router('updateProductTaxDetails', {
        id: createCommand.id,
        type: 'updateProductTaxDetails',
        userId: randomUUIDv7(),
        taxable: false,
        taxId: 'TAX-V1',
        expectedVersion: 0,
      })

      // Act - Second update
      const result = await router('updateProductTaxDetails', {
        id: createCommand.id,
        type: 'updateProductTaxDetails',
        userId: randomUUIDv7(),
        taxable: true,
        taxId: 'TAX-V2',
        expectedVersion: 1,
      })

      // Assert
      expect(result.success).toBe(true)
      const snapshot = db.query(`SELECT * FROM snapshots WHERE aggregate_id = ? ORDER BY version DESC LIMIT 1`).get(createCommand.id) as any
      expect(snapshot.version).toBe(2)
      const payload = JSON.parse(snapshot.payload)
      expect(payload.taxable).toBe(true)
      expect(payload.taxId).toBe('TAX-V2')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

})

