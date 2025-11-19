import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { createAdminCommandsRouter } from '../../../src/infrastructure/routers/adminCommandsRouter'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { ProjectionService } from '../../../src/infrastructure/projectionService'
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
  UpdateProductShippingSettingsCommand,
  UpdateProductPageLayoutCommand,
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
    fulfillmentType: 'digital' as const,
    digitalAssetUrl: 'https://example.com/asset',
    vendor: 'Test Vendor',
    variantOptions: [{ name: 'Size', values: ['S', 'M', 'L'] }],
    metaTitle: 'Test Product Meta Title',
    metaDescription: 'Test Product Meta Description',
    tags: ['test', 'product'],
    requiresShipping: true,
    taxable: true,
    pageLayoutId: null,
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
  }
}

function createValidCreateVariantCommand(): CreateVariantCommand {
  return {
    id: randomUUIDv7(),
    correlationId: randomUUIDv7(),
    userId: randomUUIDv7(),
    productId: randomUUIDv7(),
    sku: 'TEST-SKU-001',
    title: 'Test Variant',
    price: 29.99,
    inventory: 100,
    options: { Size: 'M' }, // Must match product's variantOptions
    barcode: '1234567890123',
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
  const projectionService = new ProjectionService()
  const router = createAdminCommandsRouter(unitOfWork, projectionService)

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

  test('should execute updateProductShippingSettings command successfully', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()

    try {
      // First create a product
      const createCommand = createValidCreateProductCommand()
      await router('createProduct', createCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      const updateCommand: UpdateProductShippingSettingsCommand = {
        id: createCommand.id,
        requiresShipping: false,
        taxable: false,
        expectedVersion: 0,
        userId: randomUUIDv7(),
      }

      // Act
      const result = await router('updateProductShippingSettings', updateCommand)

      // Assert
      expect(result.success).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify update event was created
      const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version').all(createCommand.id) as any[]
      expect(events.length).toBeGreaterThan(1)
      expect(events[events.length - 1].event_type).toBe('product.shipping_settings_updated')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should execute updateProductPageLayout command successfully', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()

    try {
      // First create a product
      const createCommand = createValidCreateProductCommand()
      await router('createProduct', createCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      const updateCommand: UpdateProductPageLayoutCommand = {
        id: createCommand.id,
        pageLayoutId: randomUUIDv7(),
        expectedVersion: 0,
        userId: randomUUIDv7(),
      }

      // Act
      const result = await router('updateProductPageLayout', updateCommand)

      // Assert
      expect(result.success).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify update event was created
      const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version').all(createCommand.id) as any[]
      expect(events.length).toBeGreaterThan(1)
      expect(events[events.length - 1].event_type).toBe('product.page_layout_updated')
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
      }
      await router('publishCollection', publishCommand)
      await new Promise(resolve => setTimeout(resolve, 100))

      const unpublishCommand: UnpublishCollectionCommand = {
        id: createCommand.id,
        expectedVersion: 1,
        userId: randomUUIDv7(),
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
        title: 'Updated Variant Title',
        options: { Size: 'L' }, // Must match product's variantOptions
        barcode: '9876543210987',
        expectedVersion: 0,
        userId: randomUUIDv7(),
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
      const result = await router('', payload)

      // Assert
      expect(result.success).toBe(false)
      if (result.success) throw new Error('Expected failure')
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error.message).toBe('Request must include type')
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
      if (result.success) throw new Error('Expected failure')
      expect(result.error).toBeInstanceOf(Error)
      // Zod validation error will be thrown when payload is null
      expect(result.error.message).toBeDefined()
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
      const result = await router(type, payload)

      // Assert
      expect(result.success).toBe(false)
      if (result.success) throw new Error('Expected failure')
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error.message).toBe('Unknown command type: unknownCommand')
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
      if (result.success) throw new Error('Expected failure')
      expect(result.error).toBeInstanceOf(Error)
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
    }

    try {
      // Act
      const result = await router('archiveProduct', archiveCommand)

      // Assert
      expect(result.success).toBe(false)
      if (result.success) throw new Error('Expected failure')
      expect(result.error).toBeInstanceOf(Error)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

})

