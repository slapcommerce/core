import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { AddDropshipVariantImageService } from '../../../../../../src/api/app/dropshipVariant/commands/admin/addDropshipVariantImageService'
import { UpdateDropshipVariantImageAltTextService } from '../../../../../../src/api/app/dropshipVariant/commands/admin/updateDropshipVariantImageAltTextService'
import { setupTestEnvironment, createTestProduct, createTestVariant, MockImageUploadHelper } from './helpers'
import type { ImageUploadHelper } from '../../../../../../src/api/infrastructure/imageUploadHelper'

describe('UpdateDropshipVariantImageAltTextService', () => {
  test('should update image alt text', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const mockImageUploader = new MockImageUploadHelper() as unknown as ImageUploadHelper

      // First add an image
      const addService = new AddDropshipVariantImageService(unitOfWork, mockImageUploader)
      await addService.execute({
        type: 'addDropshipVariantImage',
        id: variant.id,
        userId: 'user-123',
        imageData: 'dGVzdA==',
        filename: 'test.jpg',
        contentType: 'image/jpeg',
        altText: 'Original alt text',
        expectedVersion: 0,
      })

      // Then update alt text
      const service = new UpdateDropshipVariantImageAltTextService(unitOfWork)
      await service.execute({
        type: 'updateDropshipVariantImageAltText',
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
      const service = new UpdateDropshipVariantImageAltTextService(unitOfWork)

      await expect(service.execute({
        type: 'updateDropshipVariantImageAltText',
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
      const service = new UpdateDropshipVariantImageAltTextService(unitOfWork)

      await expect(service.execute({
        type: 'updateDropshipVariantImageAltText',
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
