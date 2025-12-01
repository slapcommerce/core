import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { AddDropshipVariantImageService } from '../../../../../../src/api/app/dropshipVariant/commands/admin/addDropshipVariantImageService'
import { setupTestEnvironment, createTestProduct, createTestVariant, MockImageUploadHelper } from './helpers'
import type { ImageUploadHelper } from '../../../../../../src/api/infrastructure/imageUploadHelper'

describe('AddDropshipVariantImageService', () => {
  test('should add an image to variant', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const mockImageUploader = new MockImageUploadHelper() as unknown as ImageUploadHelper
      const service = new AddDropshipVariantImageService(unitOfWork, mockImageUploader)

      await service.execute({
        type: 'addDropshipVariantImage',
        id: variant.id,
        userId: 'user-123',
        imageData: 'dGVzdA==', // base64 for "test"
        filename: 'test.jpg',
        contentType: 'image/jpeg',
        altText: 'Test image',
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(variant.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.images.length).toBe(1)
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
      const mockImageUploader = new MockImageUploadHelper() as unknown as ImageUploadHelper
      const service = new AddDropshipVariantImageService(unitOfWork, mockImageUploader)

      await expect(service.execute({
        type: 'addDropshipVariantImage',
        id: variant.id,
        userId: 'user-123',
        imageData: 'dGVzdA==',
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
      const mockImageUploader = new MockImageUploadHelper() as unknown as ImageUploadHelper
      const service = new AddDropshipVariantImageService(unitOfWork, mockImageUploader)

      await expect(service.execute({
        type: 'addDropshipVariantImage',
        id: 'non-existent-id',
        userId: 'user-123',
        imageData: 'dGVzdA==',
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
