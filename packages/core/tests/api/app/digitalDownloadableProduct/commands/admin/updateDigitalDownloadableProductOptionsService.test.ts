import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { UpdateDigitalDownloadableProductOptionsService } from '../../../../../../src/api/app/digitalDownloadableProduct/commands/admin/updateDigitalDownloadableProductOptionsService'
import { setupTestEnvironment, createTestProduct } from './helpers'

describe('UpdateDigitalDownloadableProductOptionsService', () => {
  test('should update variant options', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new UpdateDigitalDownloadableProductOptionsService(unitOfWork)

      await service.execute({
        type: 'updateDigitalDownloadableProductOptions',
        id: product.id,
        userId: 'user-123',
        variantOptions: [{ name: 'Color', values: ['Red', 'Blue'] }],
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(product.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.variantOptions).toEqual([{ name: 'Color', values: ['Red', 'Blue'] }])
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw on version mismatch', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new UpdateDigitalDownloadableProductOptionsService(unitOfWork)

      await expect(service.execute({
        type: 'updateDigitalDownloadableProductOptions',
        id: product.id,
        userId: 'user-123',
        variantOptions: [],
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
      const service = new UpdateDigitalDownloadableProductOptionsService(unitOfWork)

      await expect(service.execute({
        type: 'updateDigitalDownloadableProductOptions',
        id: 'non-existent-id',
        userId: 'user-123',
        variantOptions: [],
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
