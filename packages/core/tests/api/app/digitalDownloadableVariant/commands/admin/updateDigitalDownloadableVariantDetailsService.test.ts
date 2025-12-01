import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { UpdateDigitalDownloadableVariantDetailsService } from '../../../../../../src/api/app/digitalDownloadableVariant/commands/admin/updateDigitalDownloadableVariantDetailsService'
import { setupTestEnvironment, createTestProduct, createTestVariant } from './helpers'

describe('UpdateDigitalDownloadableVariantDetailsService', () => {
  test('should update variant options', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const service = new UpdateDigitalDownloadableVariantDetailsService(unitOfWork)

      await service.execute({
        type: 'updateDigitalDownloadableVariantDetails',
        id: variant.id,
        userId: 'user-123',
        options: { Size: 'L' },
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(variant.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.options).toEqual({ Size: 'L' })
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
      const service = new UpdateDigitalDownloadableVariantDetailsService(unitOfWork)

      await expect(service.execute({
        type: 'updateDigitalDownloadableVariantDetails',
        id: variant.id,
        userId: 'user-123',
        options: { Size: 'L' },
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
      const service = new UpdateDigitalDownloadableVariantDetailsService(unitOfWork)

      await expect(service.execute({
        type: 'updateDigitalDownloadableVariantDetails',
        id: 'non-existent-id',
        userId: 'user-123',
        options: { Size: 'L' },
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
