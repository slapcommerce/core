import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { AddDigitalDownloadableVariantImageService } from '../../../../../../src/api/app/digitalDownloadableVariant/commands/admin/addDigitalDownloadableVariantImageService'
import { UpdateDigitalDownloadableVariantImageAltTextService } from '../../../../../../src/api/app/digitalDownloadableVariant/commands/admin/updateDigitalDownloadableVariantImageAltTextService'
import { setupTestEnvironment, createTestProduct, createTestVariant, MockImageUploadHelper } from './helpers'

describe('UpdateDigitalDownloadableVariantImageAltTextService', () => {
  test('should update image alt text', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const mockImageUploadHelper = new MockImageUploadHelper()

      // First add an image
      const addService = new AddDigitalDownloadableVariantImageService(unitOfWork, mockImageUploadHelper as any)
      await addService.execute({
        type: 'addDigitalDownloadableVariantImage',
        id: variant.id,
        userId: 'user-123',
        imageData: btoa('test-image-data'),
        filename: 'test.jpg',
        contentType: 'image/jpeg',
        altText: 'Original alt text',
        expectedVersion: 0,
      })

      // Update alt text
      const updateService = new UpdateDigitalDownloadableVariantImageAltTextService(unitOfWork)
      await updateService.execute({
        type: 'updateDigitalDownloadableVariantImageAltText',
        id: variant.id,
        userId: 'user-123',
        imageId: 'test-image-id',
        altText: 'Updated alt text',
        expectedVersion: 1,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(variant.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.images[0].altText).toBe('Updated alt text')
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
      const updateService = new UpdateDigitalDownloadableVariantImageAltTextService(unitOfWork)

      await expect(updateService.execute({
        type: 'updateDigitalDownloadableVariantImageAltText',
        id: variant.id,
        userId: 'user-123',
        imageId: 'test-image-id',
        altText: 'Updated alt text',
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
      const updateService = new UpdateDigitalDownloadableVariantImageAltTextService(unitOfWork)

      await expect(updateService.execute({
        type: 'updateDigitalDownloadableVariantImageAltText',
        id: 'non-existent-id',
        userId: 'user-123',
        imageId: 'test-image-id',
        altText: 'Updated alt text',
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
