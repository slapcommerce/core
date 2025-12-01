import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { UpdateDropshipVariantDetailsService } from '../../../../../../src/api/app/dropshipVariant/commands/admin/updateDropshipVariantDetailsService'
import { setupTestEnvironment, createTestProduct, createTestVariant } from './helpers'

describe('UpdateDropshipVariantDetailsService', () => {
  test('should update variant details', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const service = new UpdateDropshipVariantDetailsService(unitOfWork)

      await service.execute({
        type: 'updateDropshipVariantDetails',
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
      const service = new UpdateDropshipVariantDetailsService(unitOfWork)

      await expect(service.execute({
        type: 'updateDropshipVariantDetails',
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
      const service = new UpdateDropshipVariantDetailsService(unitOfWork)

      await expect(service.execute({
        type: 'updateDropshipVariantDetails',
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
