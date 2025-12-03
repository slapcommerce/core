import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { ScheduleDigitalDownloadableVariantSaleService } from '../../../../../../src/api/app/digitalDownloadableVariant/commands/admin/scheduleDigitalDownloadableVariantSaleService'
import { UpdateScheduledDigitalDownloadableVariantSaleService } from '../../../../../../src/api/app/digitalDownloadableVariant/commands/admin/updateScheduledDigitalDownloadableVariantSaleService'
import { setupTestEnvironment, createTestProduct, createTestVariant } from './helpers'

describe('UpdateScheduledDigitalDownloadableVariantSaleService', () => {
  test('should update both schedule dates', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)

      // Create scheduled sale
      const scheduleService = new ScheduleDigitalDownloadableVariantSaleService(unitOfWork)
      const startDate = new Date(Date.now() + 86400000)
      const endDate = new Date(Date.now() + 172800000)

      await scheduleService.execute({
        type: 'scheduleDigitalDownloadableVariantSale',
        id: variant.id,
        correlationId: '019359b3-0000-7000-0000-000000000001',
        userId: 'user-123',
        saleType: 'percent',
        saleValue: 0.2,
        startDate,
        endDate,
        expectedVersion: 0,
      })

      // Update scheduled sale dates
      const newStartDate = new Date(Date.now() + 259200000) // 3 days from now
      const newEndDate = new Date(Date.now() + 345600000) // 4 days from now

      const updateService = new UpdateScheduledDigitalDownloadableVariantSaleService(unitOfWork)
      await updateService.execute({
        type: 'updateScheduledDigitalDownloadableVariantSale',
        id: variant.id,
        userId: 'user-123',
        startDate: newStartDate,
        endDate: newEndDate,
        expectedVersion: 1,
      })

      // Verify variant snapshot has updated saleSchedule
      const variantSnapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(variant.id) as any
      const variantPayload = JSON.parse(variantSnapshot.payload)
      expect(variantPayload.saleSchedule).toBeTruthy()
      expect(new Date(variantPayload.saleSchedule.startDate).getTime()).toBe(newStartDate.getTime())
      expect(new Date(variantPayload.saleSchedule.endDate).getTime()).toBe(newEndDate.getTime())
      expect(variantPayload.saleSchedule.saleType).toBe('percent')
      expect(variantPayload.saleSchedule.saleValue).toBe(0.2)

      // Verify pending schedule records were updated
      const pendingSchedules = db.query(
        `SELECT * FROM pendingSchedulesReadModel WHERE aggregateId = ? ORDER BY scheduleType`
      ).all(variant.id) as any[]

      expect(pendingSchedules).toHaveLength(2)
      expect(pendingSchedules[0].scheduleType).toBe('sale_end')
      expect(pendingSchedules[0].dueAt).toBe(newEndDate.toISOString())
      expect(pendingSchedules[1].scheduleType).toBe('sale_start')
      expect(pendingSchedules[1].dueAt).toBe(newStartDate.toISOString())
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should update sale discount', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)

      // Create scheduled sale
      const scheduleService = new ScheduleDigitalDownloadableVariantSaleService(unitOfWork)
      const startDate = new Date(Date.now() + 86400000)
      const endDate = new Date(Date.now() + 172800000)

      await scheduleService.execute({
        type: 'scheduleDigitalDownloadableVariantSale',
        id: variant.id,
        correlationId: '019359b3-0000-7000-0000-000000000001',
        userId: 'user-123',
        saleType: 'percent',
        saleValue: 0.2,
        startDate,
        endDate,
        expectedVersion: 0,
      })

      // Update the discount
      const updateService = new UpdateScheduledDigitalDownloadableVariantSaleService(unitOfWork)
      await updateService.execute({
        type: 'updateScheduledDigitalDownloadableVariantSale',
        id: variant.id,
        userId: 'user-123',
        saleType: 'fixed',
        saleValue: 1999,
        expectedVersion: 1,
      })

      // Verify variant snapshot has updated saleSchedule
      const variantSnapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(variant.id) as any
      const variantPayload = JSON.parse(variantSnapshot.payload)
      expect(variantPayload.saleSchedule).toBeTruthy()
      expect(variantPayload.saleSchedule.saleType).toBe('fixed')
      expect(variantPayload.saleSchedule.saleValue).toBe(1999)
      expect(new Date(variantPayload.saleSchedule.startDate).getTime()).toBe(startDate.getTime())
      expect(new Date(variantPayload.saleSchedule.endDate).getTime()).toBe(endDate.getTime())
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should update both dates and discount', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)

      // Create scheduled sale
      const scheduleService = new ScheduleDigitalDownloadableVariantSaleService(unitOfWork)
      const startDate = new Date(Date.now() + 86400000)
      const endDate = new Date(Date.now() + 172800000)

      await scheduleService.execute({
        type: 'scheduleDigitalDownloadableVariantSale',
        id: variant.id,
        correlationId: '019359b3-0000-7000-0000-000000000001',
        userId: 'user-123',
        saleType: 'percent',
        saleValue: 0.2,
        startDate,
        endDate,
        expectedVersion: 0,
      })

      // Update dates and discount
      const newStartDate = new Date(Date.now() + 259200000) // 3 days from now
      const newEndDate = new Date(Date.now() + 345600000) // 4 days from now

      const updateService = new UpdateScheduledDigitalDownloadableVariantSaleService(unitOfWork)
      await updateService.execute({
        type: 'updateScheduledDigitalDownloadableVariantSale',
        id: variant.id,
        userId: 'user-123',
        saleType: 'fixed',
        saleValue: 1999,
        startDate: newStartDate,
        endDate: newEndDate,
        expectedVersion: 1,
      })

      // Verify variant snapshot has fully updated saleSchedule
      const variantSnapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(variant.id) as any
      const variantPayload = JSON.parse(variantSnapshot.payload)
      expect(variantPayload.saleSchedule).toBeTruthy()
      expect(variantPayload.saleSchedule.saleType).toBe('fixed')
      expect(variantPayload.saleSchedule.saleValue).toBe(1999)
      expect(new Date(variantPayload.saleSchedule.startDate).getTime()).toBe(newStartDate.getTime())
      expect(new Date(variantPayload.saleSchedule.endDate).getTime()).toBe(newEndDate.getTime())
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw if new end date is before start date', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)

      const scheduleService = new ScheduleDigitalDownloadableVariantSaleService(unitOfWork)
      const startDate = new Date(Date.now() + 86400000)
      const endDate = new Date(Date.now() + 172800000)

      await scheduleService.execute({
        type: 'scheduleDigitalDownloadableVariantSale',
        id: variant.id,
        correlationId: '019359b3-0000-7000-0000-000000000001',
        userId: 'user-123',
        saleType: 'percent',
        saleValue: 0.2,
        startDate,
        endDate,
        expectedVersion: 0,
      })

      // Try to set end date before start date
      const updateService = new UpdateScheduledDigitalDownloadableVariantSaleService(unitOfWork)
      await expect(updateService.execute({
        type: 'updateScheduledDigitalDownloadableVariantSale',
        id: variant.id,
        userId: 'user-123',
        startDate: new Date(Date.now() + 172800000), // Day after tomorrow
        endDate: new Date(Date.now() + 86400000), // Tomorrow (before start)
        expectedVersion: 1,
      })).rejects.toThrow('End date must be after start date')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw if variant not found', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const updateService = new UpdateScheduledDigitalDownloadableVariantSaleService(unitOfWork)
      await expect(updateService.execute({
        type: 'updateScheduledDigitalDownloadableVariantSale',
        id: '019359b3-0000-7000-0000-000000000099',
        userId: 'user-123',
        saleType: 'fixed',
        saleValue: 1999,
        expectedVersion: 0,
      })).rejects.toThrow('not found')
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

      const scheduleService = new ScheduleDigitalDownloadableVariantSaleService(unitOfWork)
      const startDate = new Date(Date.now() + 86400000)
      const endDate = new Date(Date.now() + 172800000)

      await scheduleService.execute({
        type: 'scheduleDigitalDownloadableVariantSale',
        id: variant.id,
        correlationId: '019359b3-0000-7000-0000-000000000001',
        userId: 'user-123',
        saleType: 'percent',
        saleValue: 0.2,
        startDate,
        endDate,
        expectedVersion: 0,
      })

      const updateService = new UpdateScheduledDigitalDownloadableVariantSaleService(unitOfWork)
      await expect(updateService.execute({
        type: 'updateScheduledDigitalDownloadableVariantSale',
        id: variant.id,
        userId: 'user-123',
        saleType: 'fixed',
        saleValue: 1999,
        expectedVersion: 99,
      })).rejects.toThrow('Optimistic concurrency conflict')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw if no sale is scheduled', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)

      const updateService = new UpdateScheduledDigitalDownloadableVariantSaleService(unitOfWork)
      await expect(updateService.execute({
        type: 'updateScheduledDigitalDownloadableVariantSale',
        id: variant.id,
        userId: 'user-123',
        saleType: 'fixed',
        saleValue: 1999,
        expectedVersion: 0,
      })).rejects.toThrow('No scheduled sale to update')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
