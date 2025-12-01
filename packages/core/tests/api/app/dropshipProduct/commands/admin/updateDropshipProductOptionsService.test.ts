import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { UpdateDropshipProductOptionsService } from '../../../../../../src/api/app/dropshipProduct/commands/admin/updateDropshipProductOptionsService'
import { setupTestEnvironment, createTestProduct } from './helpers'

describe('UpdateDropshipProductOptionsService', () => {
  test('should update product variant options', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new UpdateDropshipProductOptionsService(unitOfWork)

      await service.execute({
        type: 'updateDropshipProductOptions',
        id: product.id,
        userId: 'user-123',
        variantOptions: [
          { name: 'Color', values: ['Red', 'Blue', 'Green'] },
          { name: 'Size', values: ['XS', 'S', 'M', 'L', 'XL'] },
        ],
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(product.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.variantOptions).toEqual([
        { name: 'Color', values: ['Red', 'Blue', 'Green'] },
        { name: 'Size', values: ['XS', 'S', 'M', 'L', 'XL'] },
      ])
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw on version mismatch', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new UpdateDropshipProductOptionsService(unitOfWork)

      await expect(service.execute({
        type: 'updateDropshipProductOptions',
        id: product.id,
        userId: 'user-123',
        variantOptions: [{ name: 'Color', values: ['Red'] }],
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
      const service = new UpdateDropshipProductOptionsService(unitOfWork)

      await expect(service.execute({
        type: 'updateDropshipProductOptions',
        id: 'non-existent-id',
        userId: 'user-123',
        variantOptions: [{ name: 'Color', values: ['Red'] }],
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
