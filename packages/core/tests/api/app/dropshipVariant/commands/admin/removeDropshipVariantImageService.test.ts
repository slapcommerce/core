import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { AddDropshipVariantImageService } from '../../../../../../src/api/app/dropshipVariant/commands/admin/addDropshipVariantImageService'
import { RemoveDropshipVariantImageService } from '../../../../../../src/api/app/dropshipVariant/commands/admin/removeDropshipVariantImageService'
import { setupTestEnvironment, createTestProduct, createTestVariant, MockImageUploadHelper } from './helpers'
import type { ImageUploadHelper } from '../../../../../../src/api/infrastructure/imageUploadHelper'

describe('RemoveDropshipVariantImageService', () => {
  test('should remove an image from variant', async () => {
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
        altText: 'Test image',
        expectedVersion: 0,
      })

      // Then remove it
      const removeService = new RemoveDropshipVariantImageService(unitOfWork)
      await removeService.execute({
        type: 'removeDropshipVariantImage',
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
      const service = new RemoveDropshipVariantImageService(unitOfWork)

      await expect(service.execute({
        type: 'removeDropshipVariantImage',
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
      const service = new RemoveDropshipVariantImageService(unitOfWork)

      await expect(service.execute({
        type: 'removeDropshipVariantImage',
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
