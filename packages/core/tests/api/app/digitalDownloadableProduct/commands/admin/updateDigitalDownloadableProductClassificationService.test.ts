import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { UpdateDigitalDownloadableProductClassificationService } from '../../../../../../src/api/app/digitalDownloadableProduct/commands/admin/updateDigitalDownloadableProductClassificationService'
import { setupTestEnvironment, createTestProduct } from './helpers'

describe('UpdateDigitalDownloadableProductClassificationService', () => {
  test('should update product vendor', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new UpdateDigitalDownloadableProductClassificationService(unitOfWork)

      await service.execute({
        type: 'updateDigitalDownloadableProductClassification',
        id: product.id,
        userId: 'user-123',
        vendor: 'Updated Vendor',
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(product.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.vendor).toBe('Updated Vendor')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw on version mismatch', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new UpdateDigitalDownloadableProductClassificationService(unitOfWork)

      await expect(service.execute({
        type: 'updateDigitalDownloadableProductClassification',
        id: product.id,
        userId: 'user-123',
        vendor: 'Updated Vendor',
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
      const service = new UpdateDigitalDownloadableProductClassificationService(unitOfWork)

      await expect(service.execute({
        type: 'updateDigitalDownloadableProductClassification',
        id: 'non-existent-id',
        userId: 'user-123',
        vendor: 'Updated Vendor',
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
