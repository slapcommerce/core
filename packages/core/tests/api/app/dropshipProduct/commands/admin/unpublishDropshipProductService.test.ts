import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { PublishDropshipProductService } from '../../../../../../src/api/app/dropshipProduct/commands/admin/publishDropshipProductService'
import { UnpublishDropshipProductService } from '../../../../../../src/api/app/dropshipProduct/commands/admin/unpublishDropshipProductService'
import { setupTestEnvironment, createTestProduct } from './helpers'

describe('UnpublishDropshipProductService', () => {
  test('should unpublish a dropship product', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)

      // First publish
      const publishService = new PublishDropshipProductService(unitOfWork)
      await publishService.execute({
        type: 'publishDropshipProduct',
        id: product.id,
        userId: 'user-123',
        expectedVersion: 0,
      })

      // Then unpublish
      const unpublishService = new UnpublishDropshipProductService(unitOfWork)
      await unpublishService.execute({
        type: 'unpublishDropshipProduct',
        id: product.id,
        userId: 'user-123',
        expectedVersion: 1,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(product.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.status).toBe('draft')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw on version mismatch', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new UnpublishDropshipProductService(unitOfWork)

      await expect(service.execute({
        type: 'unpublishDropshipProduct',
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
      const service = new UnpublishDropshipProductService(unitOfWork)

      await expect(service.execute({
        type: 'unpublishDropshipProduct',
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
