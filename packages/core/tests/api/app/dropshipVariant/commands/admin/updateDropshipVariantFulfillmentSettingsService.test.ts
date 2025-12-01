import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { UpdateDropshipVariantFulfillmentSettingsService } from '../../../../../../src/api/app/dropshipVariant/commands/admin/updateDropshipVariantFulfillmentSettingsService'
import { setupTestEnvironment, createTestProduct, createTestVariant } from './helpers'

describe('UpdateDropshipVariantFulfillmentSettingsService', () => {
  test('should update fulfillment settings', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const service = new UpdateDropshipVariantFulfillmentSettingsService(unitOfWork)

      await service.execute({
        type: 'updateDropshipVariantFulfillmentSettings',
        id: variant.id,
        userId: 'user-123',
        fulfillmentProviderId: 'provider-123',
        supplierCost: 15.99,
        supplierSku: 'SUPPLIER-SKU-001',
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(variant.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.fulfillmentProviderId).toBe('provider-123')
      expect(payload.supplierCost).toBe(15.99)
      expect(payload.supplierSku).toBe('SUPPLIER-SKU-001')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should allow null values for fulfillment settings', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const service = new UpdateDropshipVariantFulfillmentSettingsService(unitOfWork)

      // First set some values
      await service.execute({
        type: 'updateDropshipVariantFulfillmentSettings',
        id: variant.id,
        userId: 'user-123',
        fulfillmentProviderId: 'provider-123',
        supplierCost: 15.99,
        supplierSku: 'SUPPLIER-SKU-001',
        expectedVersion: 0,
      })

      // Then clear them
      await service.execute({
        type: 'updateDropshipVariantFulfillmentSettings',
        id: variant.id,
        userId: 'user-123',
        fulfillmentProviderId: null,
        supplierCost: null,
        supplierSku: null,
        expectedVersion: 1,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(variant.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.fulfillmentProviderId).toBeNull()
      expect(payload.supplierCost).toBeNull()
      expect(payload.supplierSku).toBeNull()
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
      const service = new UpdateDropshipVariantFulfillmentSettingsService(unitOfWork)

      await expect(service.execute({
        type: 'updateDropshipVariantFulfillmentSettings',
        id: variant.id,
        userId: 'user-123',
        fulfillmentProviderId: 'provider-123',
        supplierCost: 15.99,
        supplierSku: 'SUPPLIER-SKU-001',
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
      const service = new UpdateDropshipVariantFulfillmentSettingsService(unitOfWork)

      await expect(service.execute({
        type: 'updateDropshipVariantFulfillmentSettings',
        id: 'non-existent-id',
        userId: 'user-123',
        fulfillmentProviderId: 'provider-123',
        supplierCost: 15.99,
        supplierSku: 'SUPPLIER-SKU-001',
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
