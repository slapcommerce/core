import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { UpdateDropshipVariantSkuService } from '../../../../../../src/api/app/dropshipVariant/commands/admin/updateDropshipVariantSkuService'
import { setupTestEnvironment, createTestProduct, createTestVariant, createValidVariantCommand } from './helpers'
import { CreateDropshipVariantService } from '../../../../../../src/api/app/dropshipVariant/commands/admin/createDropshipVariantService'

describe('UpdateDropshipVariantSkuService', () => {
  test('should update variant SKU', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const service = new UpdateDropshipVariantSkuService(unitOfWork)

      await service.execute({
        type: 'updateDropshipVariantSku',
        id: variant.id,
        userId: 'user-123',
        sku: 'NEW-SKU-001',
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(variant.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.sku).toBe('NEW-SKU-001')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should release old SKU and reserve new SKU', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const service = new UpdateDropshipVariantSkuService(unitOfWork)

      await service.execute({
        type: 'updateDropshipVariantSku',
        id: variant.id,
        userId: 'user-123',
        sku: 'NEW-SKU-001',
        expectedVersion: 0,
      })

      const oldSkuSnapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get('TEST-SKU-001') as any
      const oldSkuPayload = JSON.parse(oldSkuSnapshot.payload)
      expect(oldSkuPayload.status).toBe('released')

      const newSkuSnapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get('NEW-SKU-001') as any
      const newSkuPayload = JSON.parse(newSkuSnapshot.payload)
      expect(newSkuPayload.status).toBe('active')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw if new SKU is already in use', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      await createTestVariant(unitOfWork)

      // Create another variant with a different SKU
      const createService = new CreateDropshipVariantService(unitOfWork)
      await createService.execute(createValidVariantCommand({
        id: 'variant-456',
        sku: 'OTHER-SKU',
        options: { Size: 'L' }
      }))

      const service = new UpdateDropshipVariantSkuService(unitOfWork)

      // Try to update the second variant to use the first variant's SKU
      await expect(service.execute({
        type: 'updateDropshipVariantSku',
        id: 'variant-456',
        userId: 'user-123',
        sku: 'TEST-SKU-001',
        expectedVersion: 0,
      })).rejects.toThrow('already in use')
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
      const service = new UpdateDropshipVariantSkuService(unitOfWork)

      await expect(service.execute({
        type: 'updateDropshipVariantSku',
        id: variant.id,
        userId: 'user-123',
        sku: 'NEW-SKU-001',
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
      const service = new UpdateDropshipVariantSkuService(unitOfWork)

      await expect(service.execute({
        type: 'updateDropshipVariantSku',
        id: 'non-existent-id',
        userId: 'user-123',
        sku: 'NEW-SKU-001',
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
