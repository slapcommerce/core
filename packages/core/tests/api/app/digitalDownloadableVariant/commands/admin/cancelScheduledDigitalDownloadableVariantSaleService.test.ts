import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { ScheduleDigitalDownloadableVariantSaleService } from '../../../../../../src/api/app/digitalDownloadableVariant/commands/admin/scheduleDigitalDownloadableVariantSaleService'
import { CancelScheduledDigitalDownloadableVariantSaleService } from '../../../../../../src/api/app/digitalDownloadableVariant/commands/admin/cancelScheduledDigitalDownloadableVariantSaleService'
import { setupTestEnvironment, createTestProduct, createTestVariant } from './helpers'

describe('CancelScheduledDigitalDownloadableVariantSaleService', () => {
  test('should cancel scheduled sale', async () => {
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

      // Cancel scheduled sale
      const cancelService = new CancelScheduledDigitalDownloadableVariantSaleService(unitOfWork)
      await cancelService.execute({
        type: 'cancelScheduledDigitalDownloadableVariantSale',
        id: variant.id,
        userId: 'user-123',
        expectedVersion: 1,
      })

      // Verify variant snapshot has cancelled saleSchedule
      const variantSnapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(variant.id) as any
      const variantPayload = JSON.parse(variantSnapshot.payload)
      expect(variantPayload.saleSchedule).toBeTruthy()
      expect(variantPayload.saleSchedule.status).toBe('cancelled')

      // Verify pending schedule records were removed
      const pendingSchedules = db.query(
        `SELECT * FROM pendingSchedulesReadModel WHERE aggregateId = ?`
      ).all(variant.id) as any[]

      expect(pendingSchedules).toHaveLength(0)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw if variant not found', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const cancelService = new CancelScheduledDigitalDownloadableVariantSaleService(unitOfWork)
      await expect(cancelService.execute({
        type: 'cancelScheduledDigitalDownloadableVariantSale',
        id: '019359b3-0000-7000-0000-000000000099',
        userId: 'user-123',
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

      const cancelService = new CancelScheduledDigitalDownloadableVariantSaleService(unitOfWork)
      await expect(cancelService.execute({
        type: 'cancelScheduledDigitalDownloadableVariantSale',
        id: variant.id,
        userId: 'user-123',
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

      const cancelService = new CancelScheduledDigitalDownloadableVariantSaleService(unitOfWork)
      await expect(cancelService.execute({
        type: 'cancelScheduledDigitalDownloadableVariantSale',
        id: variant.id,
        userId: 'user-123',
        expectedVersion: 0,
      })).rejects.toThrow('No scheduled sale to cancel')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
