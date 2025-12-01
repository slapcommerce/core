import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { UpdateDigitalDownloadableVariantSkuService } from '../../../../../../src/api/app/digitalDownloadableVariant/commands/admin/updateDigitalDownloadableVariantSkuService'
import { setupTestEnvironment, createTestProduct, createTestVariant } from './helpers'

describe('UpdateDigitalDownloadableVariantSkuService', () => {
  test('should update variant SKU', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const service = new UpdateDigitalDownloadableVariantSkuService(unitOfWork)

      await service.execute({
        type: 'updateDigitalDownloadableVariantSku',
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

  test('should reserve new SKU and release old SKU', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork, { sku: 'OLD-SKU' })
      const service = new UpdateDigitalDownloadableVariantSkuService(unitOfWork)

      await service.execute({
        type: 'updateDigitalDownloadableVariantSku',
        id: variant.id,
        userId: 'user-123',
        sku: 'NEW-SKU',
        expectedVersion: 0,
      })

      // Check new SKU is reserved
      const newSkuSnapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get('NEW-SKU') as any
      const newSkuPayload = JSON.parse(newSkuSnapshot.payload)
      expect(newSkuPayload.variantId).toBe(variant.id)
      expect(newSkuPayload.status).toBe('active')

      // Check old SKU is released
      const oldSkuSnapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get('OLD-SKU') as any
      const oldSkuPayload = JSON.parse(oldSkuSnapshot.payload)
      expect(oldSkuPayload.status).toBe('released')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw if new SKU is already in use', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      await createTestVariant(unitOfWork, { id: 'variant-1', sku: 'TAKEN-SKU' })
      await createTestVariant(unitOfWork, { id: 'variant-2', sku: 'OTHER-SKU', options: { Size: 'L' } })

      const service = new UpdateDigitalDownloadableVariantSkuService(unitOfWork)

      await expect(service.execute({
        type: 'updateDigitalDownloadableVariantSku',
        id: 'variant-2',
        userId: 'user-123',
        sku: 'TAKEN-SKU',
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
      const service = new UpdateDigitalDownloadableVariantSkuService(unitOfWork)

      await expect(service.execute({
        type: 'updateDigitalDownloadableVariantSku',
        id: variant.id,
        userId: 'user-123',
        sku: 'NEW-SKU',
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
      const service = new UpdateDigitalDownloadableVariantSkuService(unitOfWork)

      await expect(service.execute({
        type: 'updateDigitalDownloadableVariantSku',
        id: 'non-existent-id',
        userId: 'user-123',
        sku: 'NEW-SKU',
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
