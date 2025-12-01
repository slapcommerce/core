import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { AddDigitalDownloadableVariantImageService } from '../../../../../../src/api/app/digitalDownloadableVariant/commands/admin/addDigitalDownloadableVariantImageService'
import { RemoveDigitalDownloadableVariantImageService } from '../../../../../../src/api/app/digitalDownloadableVariant/commands/admin/removeDigitalDownloadableVariantImageService'
import { setupTestEnvironment, createTestProduct, createTestVariant, MockImageUploadHelper } from './helpers'

describe('RemoveDigitalDownloadableVariantImageService', () => {
  test('should remove image from variant', async () => {
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
        altText: 'Test image',
        expectedVersion: 0,
      })

      // Now remove it
      const removeService = new RemoveDigitalDownloadableVariantImageService(unitOfWork)
      await removeService.execute({
        type: 'removeDigitalDownloadableVariantImage',
        id: variant.id,
        userId: 'user-123',
        imageId: 'test-image-id',
        expectedVersion: 1,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(variant.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.images.length).toBe(0)
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
      const removeService = new RemoveDigitalDownloadableVariantImageService(unitOfWork)

      await expect(removeService.execute({
        type: 'removeDigitalDownloadableVariantImage',
        id: variant.id,
        userId: 'user-123',
        imageId: 'test-image-id',
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
      const removeService = new RemoveDigitalDownloadableVariantImageService(unitOfWork)

      await expect(removeService.execute({
        type: 'removeDigitalDownloadableVariantImage',
        id: 'non-existent-id',
        userId: 'user-123',
        imageId: 'test-image-id',
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
