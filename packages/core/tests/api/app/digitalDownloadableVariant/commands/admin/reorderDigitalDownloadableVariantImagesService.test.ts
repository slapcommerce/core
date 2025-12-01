import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { ReorderDigitalDownloadableVariantImagesService } from '../../../../../../src/api/app/digitalDownloadableVariant/commands/admin/reorderDigitalDownloadableVariantImagesService'
import { setupTestEnvironment, createTestProduct, createTestVariant } from './helpers'

describe('ReorderDigitalDownloadableVariantImagesService', () => {
  test('should reorder images', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const service = new ReorderDigitalDownloadableVariantImagesService(unitOfWork)

      // Reorder with empty array (no images yet)
      await service.execute({
        type: 'reorderDigitalDownloadableVariantImages',
        id: variant.id,
        userId: 'user-123',
        orderedImageIds: [],
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload, version FROM snapshots WHERE aggregateId = ?`).get(variant.id) as any
      expect(snapshot.version).toBe(1)
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
      const service = new ReorderDigitalDownloadableVariantImagesService(unitOfWork)

      await expect(service.execute({
        type: 'reorderDigitalDownloadableVariantImages',
        id: variant.id,
        userId: 'user-123',
        orderedImageIds: [],
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
      const service = new ReorderDigitalDownloadableVariantImagesService(unitOfWork)

      await expect(service.execute({
        type: 'reorderDigitalDownloadableVariantImages',
        id: 'non-existent-id',
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
