import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { UpdateDropshipVariantInventoryService } from '../../../../../../src/api/app/dropshipVariant/commands/admin/updateDropshipVariantInventoryService'
import { setupTestEnvironment, createTestProduct, createTestVariant } from './helpers'

describe('UpdateDropshipVariantInventoryService', () => {
  test('should update variant inventory', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const service = new UpdateDropshipVariantInventoryService(unitOfWork)

      await service.execute({
        type: 'updateDropshipVariantInventory',
        id: variant.id,
        userId: 'user-123',
        inventory: 50,
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(variant.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.inventory).toBe(50)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should allow setting inventory to zero', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const service = new UpdateDropshipVariantInventoryService(unitOfWork)

      await service.execute({
        type: 'updateDropshipVariantInventory',
        id: variant.id,
        userId: 'user-123',
        inventory: 0,
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(variant.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.inventory).toBe(0)
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
      const service = new UpdateDropshipVariantInventoryService(unitOfWork)

      await expect(service.execute({
        type: 'updateDropshipVariantInventory',
        id: variant.id,
        userId: 'user-123',
        inventory: 50,
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
      const service = new UpdateDropshipVariantInventoryService(unitOfWork)

      await expect(service.execute({
        type: 'updateDropshipVariantInventory',
        id: 'non-existent-id',
        userId: 'user-123',
        inventory: 50,
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
