import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { UpdateDropshipProductSafetyBufferService } from '../../../../../../src/api/app/dropshipProduct/commands/admin/updateDropshipProductSafetyBufferService'
import { setupTestEnvironment, createTestProduct } from './helpers'

describe('UpdateDropshipProductSafetyBufferService', () => {
  test('should update safety buffer', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new UpdateDropshipProductSafetyBufferService(unitOfWork)

      await service.execute({
        type: 'updateDropshipProductSafetyBuffer',
        id: product.id,
        userId: 'user-123',
        dropshipSafetyBuffer: 10,
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(product.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.dropshipSafetyBuffer).toBe(10)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw on version mismatch', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new UpdateDropshipProductSafetyBufferService(unitOfWork)

      await expect(service.execute({
        type: 'updateDropshipProductSafetyBuffer',
        id: product.id,
        userId: 'user-123',
        dropshipSafetyBuffer: 10,
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
      const service = new UpdateDropshipProductSafetyBufferService(unitOfWork)

      await expect(service.execute({
        type: 'updateDropshipProductSafetyBuffer',
        id: 'non-existent-id',
        userId: 'user-123',
        dropshipSafetyBuffer: 10,
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
