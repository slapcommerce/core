import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { UnpublishDigitalDownloadableProductService } from '../../../../../../src/api/app/digitalDownloadableProduct/commands/admin/unpublishDigitalDownloadableProductService'
import { PublishDigitalDownloadableProductService } from '../../../../../../src/api/app/digitalDownloadableProduct/commands/admin/publishDigitalDownloadableProductService'
import { setupTestEnvironment, createTestProduct } from './helpers'

describe('UnpublishDigitalDownloadableProductService', () => {
  test('should unpublish product', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)

      // First publish the product
      const publishService = new PublishDigitalDownloadableProductService(unitOfWork)
      await publishService.execute({
        type: 'publishDigitalDownloadableProduct',
        id: product.id,
        userId: 'user-123',
        expectedVersion: 0,
      })

      // Then unpublish
      const service = new UnpublishDigitalDownloadableProductService(unitOfWork)
      await service.execute({
        type: 'unpublishDigitalDownloadableProduct',
        id: product.id,
        userId: 'user-123',
        expectedVersion: 1,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(product.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.status).toBe('draft')
      expect(payload.publishedAt).toBeNull()
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw on version mismatch', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const publishService = new PublishDigitalDownloadableProductService(unitOfWork)
      await publishService.execute({
        type: 'publishDigitalDownloadableProduct',
        id: product.id,
        userId: 'user-123',
        expectedVersion: 0,
      })

      const service = new UnpublishDigitalDownloadableProductService(unitOfWork)

      await expect(service.execute({
        type: 'unpublishDigitalDownloadableProduct',
        id: product.id,
        userId: 'user-123',
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
      const service = new UnpublishDigitalDownloadableProductService(unitOfWork)

      await expect(service.execute({
        type: 'unpublishDigitalDownloadableProduct',
        id: 'non-existent-id',
        userId: 'user-123',
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
