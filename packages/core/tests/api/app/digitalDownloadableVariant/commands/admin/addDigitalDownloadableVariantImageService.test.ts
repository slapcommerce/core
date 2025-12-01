import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { AddDigitalDownloadableVariantImageService } from '../../../../../../src/api/app/digitalDownloadableVariant/commands/admin/addDigitalDownloadableVariantImageService'
import { setupTestEnvironment, createTestProduct, createTestVariant, MockImageUploadHelper } from './helpers'

describe('AddDigitalDownloadableVariantImageService', () => {
  test('should add image to variant', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const mockImageUploadHelper = new MockImageUploadHelper()
      const service = new AddDigitalDownloadableVariantImageService(unitOfWork, mockImageUploadHelper as any)

      await service.execute({
        type: 'addDigitalDownloadableVariantImage',
        id: variant.id,
        userId: 'user-123',
        imageData: btoa('test-image-data'),
        filename: 'test.jpg',
        contentType: 'image/jpeg',
        altText: 'Test image',
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(variant.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.images.length).toBe(1)
      expect(payload.images[0].imageId).toBe('test-image-id')
      expect(payload.images[0].altText).toBe('Test image')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw on version mismatch', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const mockImageUploadHelper = new MockImageUploadHelper()
      const service = new AddDigitalDownloadableVariantImageService(unitOfWork, mockImageUploadHelper as any)

      await expect(service.execute({
        type: 'addDigitalDownloadableVariantImage',
        id: variant.id,
        userId: 'user-123',
        imageData: btoa('test-image-data'),
        filename: 'test.jpg',
        contentType: 'image/jpeg',
        altText: 'Test image',
        expectedVersion: 99,
      })).rejects.toThrow('Optimistic concurrency conflict')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw if variant not found', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const mockImageUploadHelper = new MockImageUploadHelper()
      const service = new AddDigitalDownloadableVariantImageService(unitOfWork, mockImageUploadHelper as any)

      await expect(service.execute({
        type: 'addDigitalDownloadableVariantImage',
        id: 'non-existent-id',
        userId: 'user-123',
        imageData: btoa('test-image-data'),
        filename: 'test.jpg',
        contentType: 'image/jpeg',
        altText: 'Test image',
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
