import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { UpdateDigitalDownloadableVariantSaleService } from '../../../../../../src/api/app/digitalDownloadableVariant/commands/admin/updateDigitalDownloadableVariantSaleService'
import { setupTestEnvironment, createTestProduct, createTestVariant } from './helpers'

describe('UpdateDigitalDownloadableVariantSaleService', () => {
  test('should update variant sale with fixed price', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const service = new UpdateDigitalDownloadableVariantSaleService(unitOfWork)

      await service.execute({
        type: 'updateDigitalDownloadableVariantSale',
        id: variant.id,
        userId: 'user-123',
        saleType: 'fixed',
        saleValue: 999,
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(variant.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.saleType).toBe('fixed')
      expect(payload.saleValue).toBe(999)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should update variant sale with percent discount', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const service = new UpdateDigitalDownloadableVariantSaleService(unitOfWork)

      await service.execute({
        type: 'updateDigitalDownloadableVariantSale',
        id: variant.id,
        userId: 'user-123',
        saleType: 'percent',
        saleValue: 0.25,
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(variant.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.saleType).toBe('percent')
      expect(payload.saleValue).toBe(0.25)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should update variant sale with amount discount', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const service = new UpdateDigitalDownloadableVariantSaleService(unitOfWork)

      await service.execute({
        type: 'updateDigitalDownloadableVariantSale',
        id: variant.id,
        userId: 'user-123',
        saleType: 'amount',
        saleValue: 500,
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(variant.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.saleType).toBe('amount')
      expect(payload.saleValue).toBe(500)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should clear sale by setting null values', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const service = new UpdateDigitalDownloadableVariantSaleService(unitOfWork)

      // First set a sale
      await service.execute({
        type: 'updateDigitalDownloadableVariantSale',
        id: variant.id,
        userId: 'user-123',
        saleType: 'fixed',
        saleValue: 999,
        expectedVersion: 0,
      })

      // Then clear it
      await service.execute({
        type: 'updateDigitalDownloadableVariantSale',
        id: variant.id,
        userId: 'user-123',
        saleType: null,
        saleValue: null,
        expectedVersion: 1,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(variant.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.saleType).toBeNull()
      expect(payload.saleValue).toBeNull()
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
      const service = new UpdateDigitalDownloadableVariantSaleService(unitOfWork)

      await expect(service.execute({
        type: 'updateDigitalDownloadableVariantSale',
        id: variant.id,
        userId: 'user-123',
        saleType: 'fixed',
        saleValue: 999,
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
      const service = new UpdateDigitalDownloadableVariantSaleService(unitOfWork)

      await expect(service.execute({
        type: 'updateDigitalDownloadableVariantSale',
        id: 'non-existent-id',
        userId: 'user-123',
        saleType: 'fixed',
        saleValue: 999,
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should succeed without expectedVersion (for scheduled commands)', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const service = new UpdateDigitalDownloadableVariantSaleService(unitOfWork)

      // Execute without expectedVersion - should succeed
      await service.execute({
        type: 'updateDigitalDownloadableVariantSale',
        id: variant.id,
        userId: 'user-123',
        saleType: 'fixed',
        saleValue: 999,
        // No expectedVersion provided
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(variant.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.saleType).toBe('fixed')
      expect(payload.saleValue).toBe(999)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should succeed without expectedVersion even when version has changed', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const service = new UpdateDigitalDownloadableVariantSaleService(unitOfWork)

      // First update with expectedVersion
      await service.execute({
        type: 'updateDigitalDownloadableVariantSale',
        id: variant.id,
        userId: 'user-123',
        saleType: 'fixed',
        saleValue: 500,
        expectedVersion: 0,
      })

      // Second update without expectedVersion - should succeed even though version is now 1
      await service.execute({
        type: 'updateDigitalDownloadableVariantSale',
        id: variant.id,
        userId: 'user-123',
        saleType: 'percent',
        saleValue: 0.15,
        // No expectedVersion provided - skips version check
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(variant.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.saleType).toBe('percent')
      expect(payload.saleValue).toBe(0.15)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
