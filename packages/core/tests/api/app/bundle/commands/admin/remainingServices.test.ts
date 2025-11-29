import { describe, test, expect } from 'bun:test'
import { createTestDatabase, closeTestDatabase } from '../../../../../helpers/database'
import { TransactionBatcher } from '../../../../../../src/api/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../../../../src/api/infrastructure/unitOfWork'
import { CreateBundleService } from '../../../../../../src/api/app/bundle/commands/admin/createBundleService'
import { UpdateBundleCollectionsService } from '../../../../../../src/api/app/bundle/commands/admin/updateBundleCollectionsService'
import { AddBundleImageService } from '../../../../../../src/api/app/bundle/commands/admin/addBundleImageService'
import { RemoveBundleImageService } from '../../../../../../src/api/app/bundle/commands/admin/removeBundleImageService'
import { ReorderBundleImagesService } from '../../../../../../src/api/app/bundle/commands/admin/reorderBundleImagesService'
import { UpdateBundleImageAltTextService } from '../../../../../../src/api/app/bundle/commands/admin/updateBundleImageAltTextService'
import type { CreateBundleCommand } from '../../../../../../src/api/app/bundle/commands/admin/commands'
import type { ImageUploadResult } from '../../../../../../src/api/infrastructure/adapters/imageStorageAdapter'
import type { ImageUploadHelper } from '../../../../../../src/api/infrastructure/imageUploadHelper'

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

function createValidBundleCommand(): CreateBundleCommand {
  return {
    type: 'createBundle',
    id: '01930000-0000-7000-8000-000000000001',
    correlationId: '01930000-0000-7000-8000-000000000002',
    userId: 'user-123',
    name: 'Test Bundle',
    description: 'A test bundle',
    slug: 'test-bundle',
    items: [{ variantId: '01930000-0000-7000-8000-000000000003', quantity: 2 }],
    price: 99.99,
    compareAtPrice: 129.99,
    metaTitle: 'Test Bundle Meta',
    metaDescription: 'Test bundle description',
    richDescriptionUrl: 'https://example.com/description',
    tags: ['tag1', 'tag2'],
    collections: [],
    taxable: true,
    taxId: 'TAX123',
  }
}

async function createBundleInDatabase(unitOfWork: UnitOfWork, command: CreateBundleCommand) {
  const createService = new CreateBundleService(unitOfWork)
  await createService.execute(command)
}

function createMockImageUploadHelper(): ImageUploadHelper {
  let imageCounter = 0
  const createUrlSet = (imageId: string, size: string) => ({
    original: `https://example.com/images/${imageId}-${size}.jpg`,
    webp: `https://example.com/images/${imageId}-${size}.webp`,
    avif: `https://example.com/images/${imageId}-${size}.avif`,
  })
  return {
    uploadImage: async (buffer: ArrayBuffer, filename: string, contentType: string): Promise<ImageUploadResult> => {
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
  } as ImageUploadHelper
}

describe('UpdateBundleCollectionsService', () => {
  test('should successfully update bundle collections', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      const service = new UpdateBundleCollectionsService(unitOfWork)
      const newCollections = ['01930000-0000-7000-8000-000000000010', '01930000-0000-7000-8000-000000000011']

      await service.execute({
        type: 'updateBundleCollections',
        id: createCommand.id,
        userId: 'user-123',
        collections: newCollections,
        expectedVersion: 0,
      })

      const snapshot = db.query(`
        SELECT payload, version FROM snapshots WHERE aggregateId = ?
      `).get(createCommand.id) as any

      expect(snapshot.version).toBe(1)
      const payload = JSON.parse(snapshot.payload)
      expect(payload.collections).toEqual(newCollections)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should allow empty collections array', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      const service = new UpdateBundleCollectionsService(unitOfWork)
      await service.execute({
        type: 'updateBundleCollections',
        id: createCommand.id,
        userId: 'user-123',
        collections: [],
        expectedVersion: 0,
      })

      const snapshot = db.query(`
        SELECT payload FROM snapshots WHERE aggregateId = ?
      `).get(createCommand.id) as any

      const payload = JSON.parse(snapshot.payload)
      expect(payload.collections).toEqual([])
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when bundle not found', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const service = new UpdateBundleCollectionsService(unitOfWork)

      await expect(service.execute({
        type: 'updateBundleCollections',
        id: '01930000-0000-7000-8000-000000000099',
        userId: 'user-123',
        collections: [],
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error on version mismatch', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      const service = new UpdateBundleCollectionsService(unitOfWork)

      await expect(service.execute({
        type: 'updateBundleCollections',
        id: createCommand.id,
        userId: 'user-123',
        collections: [],
        expectedVersion: 10,
      })).rejects.toThrow('concurrency')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})

describe('AddBundleImageService', () => {
  test('should successfully add image to bundle', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      const imageHelper = createMockImageUploadHelper()
      const service = new AddBundleImageService(unitOfWork, imageHelper)

      await service.execute({
        type: 'addBundleImage',
        id: createCommand.id,
        userId: 'user-123',
        imageData: 'base64imagedata',
        filename: 'test.jpg',
        contentType: 'image/jpeg',
        altText: 'Test image alt text',
        expectedVersion: 0,
      })

      const snapshot = db.query(`
        SELECT payload, version FROM snapshots WHERE aggregateId = ?
      `).get(createCommand.id) as any

      expect(snapshot.version).toBe(1)
      const payload = JSON.parse(snapshot.payload)
      expect(payload.images).toHaveLength(1)
      expect(payload.images[0].altText).toBe('Test image alt text')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when bundle not found', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const imageHelper = createMockImageUploadHelper()
      const service = new AddBundleImageService(unitOfWork, imageHelper)

      await expect(service.execute({
        type: 'addBundleImage',
        id: '01930000-0000-7000-8000-000000000099',
        userId: 'user-123',
        imageData: 'base64imagedata',
        filename: 'test.jpg',
        contentType: 'image/jpeg',
        altText: 'Alt',
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should add multiple images', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      const imageHelper = createMockImageUploadHelper()
      const service = new AddBundleImageService(unitOfWork, imageHelper)

      await service.execute({
        type: 'addBundleImage',
        id: createCommand.id,
        userId: 'user-123',
        imageData: 'image1data',
        filename: 'test1.jpg',
        contentType: 'image/jpeg',
        altText: 'Image 1',
        expectedVersion: 0,
      })

      await service.execute({
        type: 'addBundleImage',
        id: createCommand.id,
        userId: 'user-123',
        imageData: 'image2data',
        filename: 'test2.jpg',
        contentType: 'image/jpeg',
        altText: 'Image 2',
        expectedVersion: 1,
      })

      const snapshot = db.query(`
        SELECT payload FROM snapshots WHERE aggregateId = ?
      `).get(createCommand.id) as any

      const payload = JSON.parse(snapshot.payload)
      expect(payload.images).toHaveLength(2)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})

describe('RemoveBundleImageService', () => {
  test('should successfully remove image from bundle', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      // First add an image (use valid base64)
      const imageHelper = createMockImageUploadHelper()
      const addService = new AddBundleImageService(unitOfWork, imageHelper)
      await addService.execute({
        type: 'addBundleImage',
        id: createCommand.id,
        userId: 'user-123',
        imageData: 'aGVsbG8gd29ybGQ=', // "hello world" in base64
        filename: 'test.jpg',
        contentType: 'image/jpeg',
        altText: 'Test',
        expectedVersion: 0,
      })

      // Get the image ID
      let snapshot = db.query(`
        SELECT payload FROM snapshots WHERE aggregateId = ?
      `).get(createCommand.id) as any
      let payload = JSON.parse(snapshot.payload)
      const imageId = payload.images[0].imageId

      // Now remove it
      const removeService = new RemoveBundleImageService(unitOfWork)
      await removeService.execute({
        type: 'removeBundleImage',
        id: createCommand.id,
        userId: 'user-123',
        imageId,
        expectedVersion: 1,
      })

      snapshot = db.query(`
        SELECT payload, version FROM snapshots WHERE aggregateId = ?
      `).get(createCommand.id) as any

      expect(snapshot.version).toBe(2)
      payload = JSON.parse(snapshot.payload)
      expect(payload.images).toHaveLength(0)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when bundle not found', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const service = new RemoveBundleImageService(unitOfWork)

      await expect(service.execute({
        type: 'removeBundleImage',
        id: '01930000-0000-7000-8000-000000000099',
        userId: 'user-123',
        imageId: 'img-1',
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})

describe('ReorderBundleImagesService', () => {
  test('should successfully reorder images', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      // Add two images
      const imageHelper = createMockImageUploadHelper()
      const addService = new AddBundleImageService(unitOfWork, imageHelper)

      await addService.execute({
        type: 'addBundleImage',
        id: createCommand.id,
        userId: 'user-123',
        imageData: 'image1',
        filename: 'test1.jpg',
        contentType: 'image/jpeg',
        altText: 'Image 1',
        expectedVersion: 0,
      })

      await addService.execute({
        type: 'addBundleImage',
        id: createCommand.id,
        userId: 'user-123',
        imageData: 'image2',
        filename: 'test2.jpg',
        contentType: 'image/jpeg',
        altText: 'Image 2',
        expectedVersion: 1,
      })

      // Get image IDs
      let snapshot = db.query(`
        SELECT payload FROM snapshots WHERE aggregateId = ?
      `).get(createCommand.id) as any
      let payload = JSON.parse(snapshot.payload)
      const [img1, img2] = [payload.images[0].imageId, payload.images[1].imageId]

      // Reorder: swap order
      const reorderService = new ReorderBundleImagesService(unitOfWork)
      await reorderService.execute({
        type: 'reorderBundleImages',
        id: createCommand.id,
        userId: 'user-123',
        orderedImageIds: [img2, img1], // Reversed
        expectedVersion: 2,
      })

      snapshot = db.query(`
        SELECT payload, version FROM snapshots WHERE aggregateId = ?
      `).get(createCommand.id) as any

      expect(snapshot.version).toBe(3)
      payload = JSON.parse(snapshot.payload)
      expect(payload.images[0].imageId).toBe(img2)
      expect(payload.images[1].imageId).toBe(img1)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when bundle not found', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const service = new ReorderBundleImagesService(unitOfWork)

      await expect(service.execute({
        type: 'reorderBundleImages',
        id: '01930000-0000-7000-8000-000000000099',
        userId: 'user-123',
        orderedImageIds: [],
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})

describe('UpdateBundleImageAltTextService', () => {
  test('should successfully update image alt text', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      // Add an image (use valid base64)
      const imageHelper = createMockImageUploadHelper()
      const addService = new AddBundleImageService(unitOfWork, imageHelper)
      await addService.execute({
        type: 'addBundleImage',
        id: createCommand.id,
        userId: 'user-123',
        imageData: 'aGVsbG8gd29ybGQ=', // "hello world" in base64
        filename: 'test.jpg',
        contentType: 'image/jpeg',
        altText: 'Original alt text',
        expectedVersion: 0,
      })

      // Get image ID
      let snapshot = db.query(`
        SELECT payload FROM snapshots WHERE aggregateId = ?
      `).get(createCommand.id) as any
      let payload = JSON.parse(snapshot.payload)
      const imageId = payload.images[0].imageId

      // Update alt text
      const updateService = new UpdateBundleImageAltTextService(unitOfWork)
      await updateService.execute({
        type: 'updateBundleImageAltText',
        id: createCommand.id,
        userId: 'user-123',
        imageId,
        altText: 'Updated alt text',
        expectedVersion: 1,
      })

      snapshot = db.query(`
        SELECT payload, version FROM snapshots WHERE aggregateId = ?
      `).get(createCommand.id) as any

      expect(snapshot.version).toBe(2)
      payload = JSON.parse(snapshot.payload)
      expect(payload.images[0].altText).toBe('Updated alt text')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when bundle not found', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const service = new UpdateBundleImageAltTextService(unitOfWork)

      await expect(service.execute({
        type: 'updateBundleImageAltText',
        id: '01930000-0000-7000-8000-000000000099',
        userId: 'user-123',
        imageId: 'img-1',
        altText: 'New alt',
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
