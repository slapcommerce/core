import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { ScheduleDropshipProductVisibleDropService } from '../../../../../../src/api/app/dropshipProduct/commands/admin/scheduleDropshipProductVisibleDropService'
import { setupTestEnvironment, createTestProduct } from './helpers'

describe('ScheduleDropshipProductVisibleDropService', () => {
  test('should set product to visible pending drop status', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new ScheduleDropshipProductVisibleDropService(unitOfWork)

      const scheduledFor = new Date(Date.now() + 86400000)
      const result = await service.execute({
        type: 'scheduleDropshipProductVisibleDrop',
        id: product.id,
        correlationId: 'correlation-123',
        userId: 'user-123',
        scheduledFor,
        expectedVersion: 0,
      })

      expect(result.scheduleId).toBeTruthy()

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(product.id) as any
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
      const product = await createTestProduct(unitOfWork)
      const service = new ScheduleDropshipProductVisibleDropService(unitOfWork)

      const scheduledFor = new Date(Date.now() + 86400000)
      const result = await service.execute({
        type: 'scheduleDropshipProductVisibleDrop',
        id: product.id,
        correlationId: 'correlation-123',
        userId: 'user-123',
        scheduledFor,
        expectedVersion: 0,
      })

      const scheduleSnapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(result.scheduleId) as any
      const schedulePayload = JSON.parse(scheduleSnapshot.payload)
      expect(schedulePayload.targetAggregateId).toBe(product.id)
      expect(schedulePayload.commandType).toBe('publishDropshipProduct')
      expect(schedulePayload.status).toBe('pending')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw on version mismatch', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new ScheduleDropshipProductVisibleDropService(unitOfWork)

      await expect(service.execute({
        type: 'scheduleDropshipProductVisibleDrop',
        id: product.id,
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

  test('should throw if product not found', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new ScheduleDropshipProductVisibleDropService(unitOfWork)

      await expect(service.execute({
        type: 'scheduleDropshipProductVisibleDrop',
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
      const product = await createTestProduct(unitOfWork)
      const service = new ScheduleDropshipProductVisibleDropService(unitOfWork)

      await service.execute({
        type: 'scheduleDropshipProductVisibleDrop',
        id: product.id,
        correlationId: 'correlation-123',
        userId: 'user-123',
        scheduledFor: new Date(),
        expectedVersion: 0,
      })

      const events = db.query(`SELECT eventType FROM events WHERE aggregateId = ?`).all(product.id) as any[]
      const eventTypes = events.map(e => e.eventType)
      expect(eventTypes).toContain('dropship_product.visible_drop_scheduled')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
