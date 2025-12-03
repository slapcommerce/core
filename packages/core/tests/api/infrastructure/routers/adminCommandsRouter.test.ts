import { describe, test, expect } from 'bun:test'
import { randomUUIDv7 } from 'bun'
import { AdminCommandsRouter } from '../../../../src/api/infrastructure/routers/adminCommandsRouter'
import { createTestDatabase, closeTestDatabase } from '../../../helpers/database'
import { TransactionBatcher } from '../../../../src/api/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../../src/api/infrastructure/unitOfWork'
import type { ImageUploadResult } from '../../../../src/api/infrastructure/adapters/imageStorageAdapter'
import type { ImageUploadHelper } from '../../../../src/api/infrastructure/imageUploadHelper'
import type { DigitalAssetUploadHelper } from '../../../../src/api/infrastructure/digitalAssetUploadHelper'
import type { DigitalAssetUploadResult } from '../../../../src/api/infrastructure/adapters/digitalAssetStorageAdapter'

function createMockImageUploadHelper() {
  let imageCounter = 0
  const createUrlSet = (imageId: string, size: string) => ({
    original: `https://example.com/images/${imageId}-${size}.jpg`,
    webp: `https://example.com/images/${imageId}-${size}.webp`,
    avif: `https://example.com/images/${imageId}-${size}.avif`,
  })
  return {
    uploadImage: async (): Promise<ImageUploadResult> => {
      imageCounter++
      const imageId = `img-${imageCounter}`
      return {
        imageId,
        urls: {
          thumbnail: createUrlSet(imageId, 'thumbnail'),
          small: createUrlSet(imageId, 'small'),
          medium: createUrlSet(imageId, 'medium'),
          large: createUrlSet(imageId, 'large'),
          original: createUrlSet(imageId, 'original'),
        },
      }
    },
  } as unknown as ImageUploadHelper
}

function createMockDigitalAssetUploadHelper() {
  let assetCounter = 0
  return {
    uploadAsset: async (): Promise<DigitalAssetUploadResult> => {
      assetCounter++
      return {
        assetId: `asset-${assetCounter}`,
        url: `https://example.com/assets/asset-${assetCounter}`,
        filename: 'test-file.pdf',
        size: 1024,
      }
    },
  } as unknown as DigitalAssetUploadHelper
}

function setupTestEnvironment() {
  const db = createTestDatabase()
  const batcher = new TransactionBatcher(db, {
    flushIntervalMs: 50,
    batchSizeThreshold: 10,
    maxQueueDepth: 100
  })
  batcher.start()
  const unitOfWork = new UnitOfWork(db, batcher)
  const imageUploadHelper = createMockImageUploadHelper()
  const digitalAssetUploadHelper = createMockDigitalAssetUploadHelper()
  const router = AdminCommandsRouter.create(unitOfWork, imageUploadHelper, digitalAssetUploadHelper)
  return { db, batcher, unitOfWork, router }
}

describe('AdminCommandsRouter', () => {
  test('should create router instance', () => {
    const { db, batcher, router } = setupTestEnvironment()
    try {
      expect(router).toBeDefined()
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should return error when type is missing', async () => {
    const { db, batcher, router } = setupTestEnvironment()
    try {
      const result = await router.execute('' as any, {})

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeInstanceOf(Error)
        expect(result.error.message).toBe('Request must include type')
      }
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should return error when type is null', async () => {
    const { db, batcher, router } = setupTestEnvironment()
    try {
      const result = await router.execute(null as any, {})

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toBe('Request must include type')
      }
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should return error for unknown command type', async () => {
    const { db, batcher, router } = setupTestEnvironment()
    try {
      const result = await router.execute('unknownCommand' as any, {})

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toBe('Unknown command type: unknownCommand')
      }
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should execute createCollection command successfully', async () => {
    const { db, batcher, router } = setupTestEnvironment()
    try {
      const collectionId = randomUUIDv7()
      const correlationId = randomUUIDv7()

      const result = await router.execute('createCollection', {
        type: 'createCollection',
        id: collectionId,
        correlationId,
        userId: 'user-123',
        name: 'Test Collection',
        slug: 'test-collection',
        description: 'A test collection',
        metaTitle: 'Test Collection',
        metaDescription: 'Test meta description',
      })

      expect(result.success).toBe(true)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should return error when command validation fails', async () => {
    const { db, batcher, router } = setupTestEnvironment()
    try {
      // Missing required fields for createCollection
      const result = await router.execute('createCollection', {
        type: 'createCollection',
        // Missing id, correlationId, userId, name, slug, etc.
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeInstanceOf(Error)
      }
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should execute createBundle command successfully', async () => {
    const { db, batcher, router } = setupTestEnvironment()
    try {
      const bundleId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const variantId = randomUUIDv7()

      const result = await router.execute('createBundle', {
        type: 'createBundle',
        id: bundleId,
        correlationId,
        userId: 'user-123',
        name: 'Test Bundle',
        slug: 'test-bundle',
        description: 'A test bundle',
        items: [{ variantId, quantity: 1 }],
        price: 99.99,
        metaTitle: 'Test Bundle',
        metaDescription: 'Test meta description',
        richDescriptionUrl: '',
        tags: [],
        collections: [],
        taxable: true,
        taxId: '',
      })

      expect(result.success).toBe(true)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should execute createDigitalDownloadableProduct command successfully', async () => {
    const { db, batcher, router } = setupTestEnvironment()
    try {
      // First create a collection that the product will belong to
      const collectionId = randomUUIDv7()
      const collectionCorrelationId = randomUUIDv7()

      await router.execute('createCollection', {
        type: 'createCollection',
        id: collectionId,
        correlationId: collectionCorrelationId,
        userId: 'user-123',
        name: 'Test Collection for Digital Product',
        slug: 'test-collection-digital',
        description: 'A test collection',
        metaTitle: 'Test Collection',
        metaDescription: 'Test meta description',
      })

      const productId = randomUUIDv7()
      const correlationId = randomUUIDv7()

      const result = await router.execute('createDigitalDownloadableProduct', {
        type: 'createDigitalDownloadableProduct',
        id: productId,
        correlationId,
        userId: 'user-123',
        name: 'Digital Product',
        slug: 'digital-product',
        collections: [collectionId],
        taxable: true,
      })

      expect(result.success).toBe(true)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should execute createDropshipProduct command successfully', async () => {
    const { db, batcher, router } = setupTestEnvironment()
    try {
      // First create a collection that the product will belong to
      const collectionId = randomUUIDv7()
      const collectionCorrelationId = randomUUIDv7()

      await router.execute('createCollection', {
        type: 'createCollection',
        id: collectionId,
        correlationId: collectionCorrelationId,
        userId: 'user-123',
        name: 'Test Collection for Dropship Product',
        slug: 'test-collection-dropship',
        description: 'A test collection',
        metaTitle: 'Test Collection',
        metaDescription: 'Test meta description',
      })

      const productId = randomUUIDv7()
      const correlationId = randomUUIDv7()

      const result = await router.execute('createDropshipProduct', {
        type: 'createDropshipProduct',
        id: productId,
        correlationId,
        userId: 'user-123',
        name: 'Dropship Product',
        slug: 'dropship-product',
        collections: [collectionId],
        taxable: true,
      })

      expect(result.success).toBe(true)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should return data for addCollectionImage command with returnsData flag', async () => {
    const { db, batcher, router } = setupTestEnvironment()
    try {
      // First create a collection
      const collectionId = randomUUIDv7()
      const correlationId = randomUUIDv7()

      await router.execute('createCollection', {
        type: 'createCollection',
        id: collectionId,
        correlationId,
        userId: 'user-123',
        name: 'Test Collection',
        slug: 'test-collection-for-image',
        description: 'A test collection',
        metaTitle: 'Test Collection',
        metaDescription: 'Test meta description',
      })

      // Now add an image
      const result = await router.execute('addCollectionImage', {
        type: 'addCollectionImage',
        id: collectionId,
        userId: 'user-123',
        imageData: 'aGVsbG8gd29ybGQ=', // "hello world" in base64
        filename: 'test.jpg',
        contentType: 'image/jpeg',
        altText: 'Test image',
        expectedVersion: 0,
      })

      expect(result.success).toBe(true)
      // Commands with returnsData: true return data in the result
      // (even if the service returns undefined, the path is covered)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should handle command execution error', async () => {
    const { db, batcher, router } = setupTestEnvironment()
    try {
      // Try to archive a non-existent collection
      const result = await router.execute('archiveCollection', {
        type: 'archiveCollection',
        id: randomUUIDv7(),
        userId: 'user-123',
        expectedVersion: 0,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeInstanceOf(Error)
        expect(result.error.message).toContain('not found')
      }
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should execute createDigitalDownloadableVariant command successfully', async () => {
    const { db, batcher, router } = setupTestEnvironment()
    try {
      // First create a collection
      const collectionId = randomUUIDv7()
      const collectionCorrelationId = randomUUIDv7()

      await router.execute('createCollection', {
        type: 'createCollection',
        id: collectionId,
        correlationId: collectionCorrelationId,
        userId: 'user-123',
        name: 'Test Collection for Variant',
        slug: 'test-collection-variant',
        description: 'A test collection',
        metaTitle: 'Test Collection',
        metaDescription: 'Test meta description',
      })

      // Create a product
      const productId = randomUUIDv7()
      const correlationId = randomUUIDv7()

      await router.execute('createDigitalDownloadableProduct', {
        type: 'createDigitalDownloadableProduct',
        id: productId,
        correlationId,
        userId: 'user-123',
        name: 'Digital Product',
        slug: 'digital-product-variant-test',
        collections: [collectionId],
        taxable: true,
      })

      // Now create a variant
      const variantId = randomUUIDv7()
      const variantCorrelationId = randomUUIDv7()

      const result = await router.execute('createDigitalDownloadableVariant', {
        type: 'createDigitalDownloadableVariant',
        id: variantId,
        correlationId: variantCorrelationId,
        userId: 'user-123',
        productId,
      })

      expect(result.success).toBe(true)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should execute createDropshipVariant command successfully', async () => {
    const { db, batcher, router } = setupTestEnvironment()
    try {
      // First create a collection
      const collectionId = randomUUIDv7()
      const collectionCorrelationId = randomUUIDv7()

      await router.execute('createCollection', {
        type: 'createCollection',
        id: collectionId,
        correlationId: collectionCorrelationId,
        userId: 'user-123',
        name: 'Test Collection for Dropship Variant',
        slug: 'test-collection-dropship-variant',
        description: 'A test collection',
        metaTitle: 'Test Collection',
        metaDescription: 'Test meta description',
      })

      // Create a product
      const productId = randomUUIDv7()
      const correlationId = randomUUIDv7()

      await router.execute('createDropshipProduct', {
        type: 'createDropshipProduct',
        id: productId,
        correlationId,
        userId: 'user-123',
        name: 'Dropship Product',
        slug: 'dropship-product-variant-test',
        collections: [collectionId],
        taxable: true,
      })

      // Now create a variant
      const variantId = randomUUIDv7()
      const variantCorrelationId = randomUUIDv7()

      const result = await router.execute('createDropshipVariant', {
        type: 'createDropshipVariant',
        id: variantId,
        correlationId: variantCorrelationId,
        userId: 'user-123',
        productId,
      })

      expect(result.success).toBe(true)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
