import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { ScheduleDigitalDownloadableVariantVisibleDropService } from '../../../../../../src/api/app/digitalDownloadableVariant/commands/admin/scheduleDigitalDownloadableVariantVisibleDropService'
import { setupTestEnvironment, createTestProduct, createTestVariant } from './helpers'

describe('ScheduleDigitalDownloadableVariantVisibleDropService', () => {
  test('should set variant to visible pending drop status', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const service = new ScheduleDigitalDownloadableVariantVisibleDropService(unitOfWork)

      const scheduledFor = new Date(Date.now() + 86400000)
      const result = await service.execute({
        type: 'scheduleDigitalDownloadableVariantVisibleDrop',
        id: variant.id,
        correlationId: 'correlation-123',
        userId: 'user-123',
        scheduledFor,
        expectedVersion: 0,
      })

      expect(result.scheduleId).toBeTruthy()

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(variant.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.status).toBe('visible_pending_drop')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should create schedule for publish command', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const service = new ScheduleDigitalDownloadableVariantVisibleDropService(unitOfWork)

      const scheduledFor = new Date(Date.now() + 86400000)
      const result = await service.execute({
        type: 'scheduleDigitalDownloadableVariantVisibleDrop',
        id: variant.id,
        correlationId: 'correlation-123',
        userId: 'user-123',
        scheduledFor,
        expectedVersion: 0,
      })

      const scheduleSnapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(result.scheduleId) as any
      const schedulePayload = JSON.parse(scheduleSnapshot.payload)
      expect(schedulePayload.targetAggregateId).toBe(variant.id)
      expect(schedulePayload.commandType).toBe('publishDigitalDownloadableVariant')
      expect(schedulePayload.status).toBe('pending')
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
      const service = new ScheduleDigitalDownloadableVariantVisibleDropService(unitOfWork)

      await expect(service.execute({
        type: 'scheduleDigitalDownloadableVariantVisibleDrop',
        id: variant.id,
        correlationId: 'correlation-123',
        userId: 'user-123',
        scheduledFor: new Date(),
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
      const service = new ScheduleDigitalDownloadableVariantVisibleDropService(unitOfWork)

      await expect(service.execute({
        type: 'scheduleDigitalDownloadableVariantVisibleDrop',
        id: 'non-existent-id',
        correlationId: 'correlation-123',
        userId: 'user-123',
        scheduledFor: new Date(),
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should create visible drop scheduled event', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const service = new ScheduleDigitalDownloadableVariantVisibleDropService(unitOfWork)

      await service.execute({
        type: 'scheduleDigitalDownloadableVariantVisibleDrop',
        id: variant.id,
        correlationId: 'correlation-123',
        userId: 'user-123',
        scheduledFor: new Date(),
        expectedVersion: 0,
      })

      const events = db.query(`SELECT eventType FROM events WHERE aggregateId = ?`).all(variant.id) as any[]
      const eventTypes = events.map(e => e.eventType)
      expect(eventTypes).toContain('digital_downloadable_variant.visible_drop_scheduled')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
