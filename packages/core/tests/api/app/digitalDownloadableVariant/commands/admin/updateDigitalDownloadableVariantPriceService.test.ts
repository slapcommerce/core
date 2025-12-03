import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { UpdateDigitalDownloadableVariantPriceService } from '../../../../../../src/api/app/digitalDownloadableVariant/commands/admin/updateDigitalDownloadableVariantPriceService'
import { setupTestEnvironment, createTestProduct, createTestVariant } from './helpers'

describe('UpdateDigitalDownloadableVariantPriceService', () => {
  test('should update variant price', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const service = new UpdateDigitalDownloadableVariantPriceService(unitOfWork)

      await service.execute({
        type: 'updateDigitalDownloadableVariantPrice',
        id: variant.id,
        userId: 'user-123',
        price: 2999,
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(variant.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.listPrice).toBe(2999)
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
      const service = new UpdateDigitalDownloadableVariantPriceService(unitOfWork)

      await expect(service.execute({
        type: 'updateDigitalDownloadableVariantPrice',
        id: variant.id,
        userId: 'user-123',
        price: 2999,
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
      const service = new UpdateDigitalDownloadableVariantPriceService(unitOfWork)

      await expect(service.execute({
        type: 'updateDigitalDownloadableVariantPrice',
        id: 'non-existent-id',
        userId: 'user-123',
        price: 2999,
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
