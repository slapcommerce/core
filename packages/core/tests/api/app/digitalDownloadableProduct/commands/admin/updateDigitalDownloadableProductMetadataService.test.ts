import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { UpdateDigitalDownloadableProductMetadataService } from '../../../../../../src/api/app/digitalDownloadableProduct/commands/admin/updateDigitalDownloadableProductMetadataService'
import { setupTestEnvironment, createTestProduct } from './helpers'

describe('UpdateDigitalDownloadableProductMetadataService', () => {
  test('should update product metadata', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new UpdateDigitalDownloadableProductMetadataService(unitOfWork)

      await service.execute({
        type: 'updateDigitalDownloadableProductMetadata',
        id: product.id,
        userId: 'user-123',
        metaTitle: 'Updated Meta Title',
        metaDescription: 'Updated Meta Description',
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(product.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.metaTitle).toBe('Updated Meta Title')
      expect(payload.metaDescription).toBe('Updated Meta Description')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw on version mismatch', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new UpdateDigitalDownloadableProductMetadataService(unitOfWork)

      await expect(service.execute({
        type: 'updateDigitalDownloadableProductMetadata',
        id: product.id,
        userId: 'user-123',
        metaTitle: 'Updated Meta Title',
        metaDescription: 'Updated Meta Description',
        expectedVersion: 99,
      })).rejects.toThrow('Optimistic concurrency conflict')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw if product not found', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new UpdateDigitalDownloadableProductMetadataService(unitOfWork)

      await expect(service.execute({
        type: 'updateDigitalDownloadableProductMetadata',
        id: 'non-existent-id',
        userId: 'user-123',
        metaTitle: 'Updated Meta Title',
        metaDescription: 'Updated Meta Description',
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
