import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { UpdateDropshipProductClassificationService } from '../../../../../../src/api/app/dropshipProduct/commands/admin/updateDropshipProductClassificationService'
import { setupTestEnvironment, createTestProduct } from './helpers'

describe('UpdateDropshipProductClassificationService', () => {
  test('should update product vendor', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new UpdateDropshipProductClassificationService(unitOfWork)

      await service.execute({
        type: 'updateDropshipProductClassification',
        id: product.id,
        userId: 'user-123',
        vendor: 'New Vendor',
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(product.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.vendor).toBe('New Vendor')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw on version mismatch', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new UpdateDropshipProductClassificationService(unitOfWork)

      await expect(service.execute({
        type: 'updateDropshipProductClassification',
        id: product.id,
        userId: 'user-123',
        vendor: 'New Vendor',
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
      const service = new UpdateDropshipProductClassificationService(unitOfWork)

      await expect(service.execute({
        type: 'updateDropshipProductClassification',
        id: 'non-existent-id',
        userId: 'user-123',
        vendor: 'New Vendor',
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
