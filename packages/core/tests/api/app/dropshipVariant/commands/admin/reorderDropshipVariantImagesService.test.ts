import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { ReorderDropshipVariantImagesService } from '../../../../../../src/api/app/dropshipVariant/commands/admin/reorderDropshipVariantImagesService'
import { setupTestEnvironment, createTestProduct, createTestVariant } from './helpers'

describe('ReorderDropshipVariantImagesService', () => {
  test('should reorder variant images', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const service = new ReorderDropshipVariantImagesService(unitOfWork)

      // With no images, reordering with empty array should work
      await service.execute({
        type: 'reorderDropshipVariantImages',
        id: variant.id,
        userId: 'user-123',
        orderedImageIds: [],
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(variant.id) as any
      expect(snapshot).not.toBeNull()
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
      const service = new ReorderDropshipVariantImagesService(unitOfWork)

      await expect(service.execute({
        type: 'reorderDropshipVariantImages',
        id: variant.id,
        userId: 'user-123',
        orderedImageIds: ['image-2', 'image-1'],
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
      const service = new ReorderDropshipVariantImagesService(unitOfWork)

      await expect(service.execute({
        type: 'reorderDropshipVariantImages',
        id: 'non-existent-id',
        userId: 'user-123',
        orderedImageIds: ['image-2', 'image-1'],
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
