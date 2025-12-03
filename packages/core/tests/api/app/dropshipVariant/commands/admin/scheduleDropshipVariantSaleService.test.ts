import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { ScheduleDropshipVariantSaleService } from '../../../../../../src/api/app/dropshipVariant/commands/admin/scheduleDropshipVariantSaleService'
import { setupTestEnvironment, createTestProduct, createTestVariant } from './helpers'

describe('ScheduleDropshipVariantSaleService', () => {
  test('should schedule a sale on the variant', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const service = new ScheduleDropshipVariantSaleService(unitOfWork)

      const startDate = new Date(Date.now() + 86400000) // Tomorrow
      const endDate = new Date(Date.now() + 172800000) // Day after tomorrow

      const result = await service.execute({
        type: 'scheduleDropshipVariantSale',
        id: variant.id,
        correlationId: '019359b3-0000-7000-0000-000000000001',
        userId: 'user-123',
        saleType: 'percent',
        saleValue: 0.2,
        startDate,
        endDate,
        expectedVersion: 0,
      })

      expect(result.scheduleGroupId).toBeTruthy()

      // Verify variant snapshot now has saleSchedule
      const variantSnapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(variant.id) as any
      const variantPayload = JSON.parse(variantSnapshot.payload)
      expect(variantPayload.saleSchedule).toBeTruthy()
      expect(variantPayload.saleSchedule.saleType).toBe('percent')
      expect(variantPayload.saleSchedule.saleValue).toBe(0.2)
      expect(variantPayload.saleSchedule.status).toBe('pending')

      // Verify pending schedule records were created
      const pendingSchedules = db.query(
        `SELECT * FROM pendingSchedulesReadModel WHERE aggregateId = ? ORDER BY scheduleType`
      ).all(variant.id) as any[]

      expect(pendingSchedules).toHaveLength(2)
      expect(pendingSchedules[0].scheduleType).toBe('sale_end')
      expect(pendingSchedules[1].scheduleType).toBe('sale_start')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw if end date is before start date', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const service = new ScheduleDropshipVariantSaleService(unitOfWork)

      const startDate = new Date(Date.now() + 172800000) // Day after tomorrow
      const endDate = new Date(Date.now() + 86400000) // Tomorrow (before start)

      await expect(service.execute({
        type: 'scheduleDropshipVariantSale',
        id: variant.id,
        correlationId: '019359b3-0000-7000-0000-000000000001',
        userId: 'user-123',
        saleType: 'fixed',
        saleValue: 999,
        startDate,
        endDate,
        expectedVersion: 0,
      })).rejects.toThrow('Sale end date must be after start date')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw if end date equals start date', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const service = new ScheduleDropshipVariantSaleService(unitOfWork)

      const sameDate = new Date(Date.now() + 86400000)

      await expect(service.execute({
        type: 'scheduleDropshipVariantSale',
        id: variant.id,
        correlationId: '019359b3-0000-7000-0000-000000000001',
        userId: 'user-123',
        saleType: 'fixed',
        saleValue: 999,
        startDate: sameDate,
        endDate: sameDate,
        expectedVersion: 0,
      })).rejects.toThrow('Sale end date must be after start date')
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
      const service = new ScheduleDropshipVariantSaleService(unitOfWork)

      const startDate = new Date(Date.now() + 86400000)
      const endDate = new Date(Date.now() + 172800000)

      await expect(service.execute({
        type: 'scheduleDropshipVariantSale',
        id: variant.id,
        correlationId: '019359b3-0000-7000-0000-000000000001',
        userId: 'user-123',
        saleType: 'fixed',
        saleValue: 999,
        startDate,
        endDate,
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
      const service = new ScheduleDropshipVariantSaleService(unitOfWork)

      const startDate = new Date(Date.now() + 86400000)
      const endDate = new Date(Date.now() + 172800000)

      await expect(service.execute({
        type: 'scheduleDropshipVariantSale',
        id: '019359b3-0000-7000-0000-000000000099',
        correlationId: '019359b3-0000-7000-0000-000000000001',
        userId: 'user-123',
        saleType: 'fixed',
        saleValue: 999,
        startDate,
        endDate,
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw if sale already scheduled', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const service = new ScheduleDropshipVariantSaleService(unitOfWork)

      const startDate = new Date(Date.now() + 86400000)
      const endDate = new Date(Date.now() + 172800000)

      // Schedule first sale
      await service.execute({
        type: 'scheduleDropshipVariantSale',
        id: variant.id,
        correlationId: '019359b3-0000-7000-0000-000000000001',
        userId: 'user-123',
        saleType: 'percent',
        saleValue: 0.2,
        startDate,
        endDate,
        expectedVersion: 0,
      })

      // Try to schedule second sale
      await expect(service.execute({
        type: 'scheduleDropshipVariantSale',
        id: variant.id,
        correlationId: '019359b3-0000-7000-0000-000000000002',
        userId: 'user-123',
        saleType: 'percent',
        saleValue: 0.3,
        startDate,
        endDate,
        expectedVersion: 1,
      })).rejects.toThrow('A sale is already scheduled')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
