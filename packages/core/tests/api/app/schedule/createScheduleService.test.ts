import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDatabase, closeTestDatabase } from '../../helpers/database'
import { TransactionBatcher } from '../../../../src/api/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../../src/api/infrastructure/unitOfWork'
import { CreateScheduleService } from '../../../../src/api/app/schedule/createScheduleService'
import type { CreateScheduleCommand } from '../../../../src/api/app/schedule/commands/commands'
import { randomUUIDv7 } from 'bun'

async function setupTestEnvironment() {
  const db = createTestDatabase()
  const batcher = new TransactionBatcher(db, {
    flushIntervalMs: 50,
    batchSizeThreshold: 10,
    maxQueueDepth: 100
  })
  batcher.start()
  const unitOfWork = new UnitOfWork(db, batcher)
  return { db, batcher, unitOfWork }
}

describe('CreateScheduleService', () => {
  test('should successfully create schedule with command data', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateScheduleService(unitOfWork)
      const scheduleId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const targetAggregateId = randomUUIDv7()
      const scheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now

      const command: CreateScheduleCommand = {
        type: 'createSchedule',
        id: scheduleId,
        correlationId,
        userId: 'user-123',
        targetAggregateId,
        targetAggregateType: 'product',
        commandType: 'publishProduct',
        commandData: { reason: 'scheduled-launch' },
        scheduledFor,
        createdBy: 'admin-user',
      }

      // Act
      await service.execute(command)

      // Assert - Verify schedule snapshot was created
      const snapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregate_id = ?
        ORDER BY version DESC
        LIMIT 1
      `).get(scheduleId) as any

      expect(snapshot).not.toBeNull()
      expect(snapshot.version).toBe(0)
      expect(snapshot.correlation_id).toBe(correlationId)

      const payload = JSON.parse(snapshot.payload)
      expect(payload.id).toBe(scheduleId)
      expect(payload.targetAggregateId).toBe(targetAggregateId)
      expect(payload.targetAggregateType).toBe('product')
      expect(payload.commandType).toBe('publishProduct')
      expect(payload.commandData).toEqual({ reason: 'scheduled-launch' })
      expect(new Date(payload.scheduledFor).toISOString()).toBe(scheduledFor.toISOString())
      expect(payload.status).toBe('pending')
      expect(payload.retryCount).toBe(0)
      expect(payload.nextRetryAt).toBeNull()
      expect(payload.createdBy).toBe('admin-user')
      expect(payload.errorMessage).toBeNull()

      // Verify events were saved
      const events = db.query(`
        SELECT * FROM events
        WHERE aggregate_id = ?
      `).all(scheduleId) as any[]

      expect(events.length).toBe(1)
      expect(events[0].event_type).toBe('schedule.created')
      expect(events[0].version).toBe(0)
      expect(events[0].correlation_id).toBe(correlationId)

      const eventPayload = JSON.parse(events[0].payload)
      expect(eventPayload.newState.targetAggregateId).toBe(targetAggregateId)
      expect(eventPayload.newState.status).toBe('pending')

      // Verify outbox entries were created
      const outboxEvents = db.query(`
        SELECT * FROM outbox
        WHERE aggregate_id = ?
      `).all(scheduleId) as any[]

      expect(outboxEvents.length).toBe(1)
      expect(outboxEvents[0].event_type).toBe('schedule.created')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should successfully create schedule with null command data', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateScheduleService(unitOfWork)
      const scheduleId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const targetAggregateId = randomUUIDv7()
      const scheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000)

      const command: CreateScheduleCommand = {
        type: 'createSchedule',
        id: scheduleId,
        correlationId,
        userId: 'user-456',
        targetAggregateId,
        targetAggregateType: 'collection',
        commandType: 'publishCollection',
        commandData: null,
        scheduledFor,
        createdBy: 'admin-user-2',
      }

      // Act
      await service.execute(command)

      // Assert - Verify schedule snapshot was created with null commandData
      const snapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregate_id = ?
      `).get(scheduleId) as any

      expect(snapshot).not.toBeNull()
      const payload = JSON.parse(snapshot.payload)
      expect(payload.commandData).toBeNull()
      expect(payload.targetAggregateType).toBe('collection')
      expect(payload.commandType).toBe('publishCollection')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should create schedule with correct initial status as pending', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateScheduleService(unitOfWork)
      const scheduleId = randomUUIDv7()
      const correlationId = randomUUIDv7()

      const command: CreateScheduleCommand = {
        type: 'createSchedule',
        id: scheduleId,
        correlationId,
        userId: 'user-status',
        targetAggregateId: randomUUIDv7(),
        targetAggregateType: 'product',
        commandType: 'updateProduct',
        commandData: null,
        scheduledFor: new Date(Date.now() + 1000),
        createdBy: 'admin',
      }

      // Act
      await service.execute(command)

      // Assert
      const snapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregate_id = ?
      `).get(scheduleId) as any

      const payload = JSON.parse(snapshot.payload)
      expect(payload.status).toBe('pending')
      expect(payload.retryCount).toBe(0)
      expect(payload.nextRetryAt).toBeNull()
      expect(payload.errorMessage).toBeNull()
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should save event with correct data structure', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateScheduleService(unitOfWork)
      const scheduleId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const targetAggregateId = randomUUIDv7()
      const scheduledFor = new Date(Date.now() + 3600000)

      const command: CreateScheduleCommand = {
        type: 'createSchedule',
        id: scheduleId,
        correlationId,
        userId: 'user-event-test',
        targetAggregateId,
        targetAggregateType: 'variant',
        commandType: 'updateVariant',
        commandData: { price: 1999 },
        scheduledFor,
        createdBy: 'admin-event',
      }

      // Act
      await service.execute(command)

      // Assert
      const event = db.query(`
        SELECT * FROM events
        WHERE aggregate_id = ? AND event_type = 'schedule.created'
      `).get(scheduleId) as any

      expect(event).not.toBeNull()
      expect(event.aggregate_id).toBe(scheduleId)
      expect(event.correlation_id).toBe(correlationId)
      expect(event.version).toBe(0)
      expect(event.user_id).toBe('user-event-test')

      const eventPayload = JSON.parse(event.payload)
      expect(eventPayload.priorState).toEqual({})
      expect(eventPayload.newState.targetAggregateId).toBe(targetAggregateId)
      expect(eventPayload.newState.targetAggregateType).toBe('variant')
      expect(eventPayload.newState.commandType).toBe('updateVariant')
      expect(eventPayload.newState.commandData).toEqual({ price: 1999 })
      expect(eventPayload.newState.status).toBe('pending')
      expect(eventPayload.newState.createdBy).toBe('admin-event')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should set correct access level', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateScheduleService(unitOfWork)

      // Assert
      expect(service.accessLevel).toBe('admin')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should create schedules with proper timestamp fields', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateScheduleService(unitOfWork)
      const scheduleId = randomUUIDv7()
      const beforeCreate = new Date()

      const command: CreateScheduleCommand = {
        type: 'createSchedule',
        id: scheduleId,
        correlationId: randomUUIDv7(),
        userId: 'user-timestamp',
        targetAggregateId: randomUUIDv7(),
        targetAggregateType: 'product',
        commandType: 'publishProduct',
        commandData: null,
        scheduledFor: new Date(Date.now() + 86400000),
        createdBy: 'admin-timestamp',
      }

      // Act
      await service.execute(command)
      const afterCreate = new Date()

      // Assert
      const snapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregate_id = ?
      `).get(scheduleId) as any

      const payload = JSON.parse(snapshot.payload)
      const createdAt = new Date(payload.createdAt)
      const updatedAt = new Date(payload.updatedAt)

      expect(createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime())
      expect(createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime())
      expect(updatedAt.getTime()).toBe(createdAt.getTime())
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should create multiple independent schedules', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateScheduleService(unitOfWork)

      // Act - Create first schedule
      const scheduleId1 = randomUUIDv7()
      await service.execute({
        type: 'createSchedule',
        id: scheduleId1,
        correlationId: randomUUIDv7(),
        userId: 'user-1',
        targetAggregateId: randomUUIDv7(),
        targetAggregateType: 'product',
        commandType: 'publishProduct',
        commandData: null,
        scheduledFor: new Date(Date.now() + 1000),
        createdBy: 'admin-1',
      })

      // Act - Create second schedule
      const scheduleId2 = randomUUIDv7()
      await service.execute({
        type: 'createSchedule',
        id: scheduleId2,
        correlationId: randomUUIDv7(),
        userId: 'user-2',
        targetAggregateId: randomUUIDv7(),
        targetAggregateType: 'collection',
        commandType: 'publishCollection',
        commandData: { reason: 'launch' },
        scheduledFor: new Date(Date.now() + 2000),
        createdBy: 'admin-2',
      })

      // Assert - Both schedules exist independently
      const snapshots = db.query(`
        SELECT aggregate_id FROM snapshots
        WHERE aggregate_id IN (?, ?)
      `).all(scheduleId1, scheduleId2) as any[]

      expect(snapshots.length).toBe(2)
      const ids = snapshots.map(s => s.aggregate_id)
      expect(ids).toContain(scheduleId1)
      expect(ids).toContain(scheduleId2)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should handle schedules for different aggregate types', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateScheduleService(unitOfWork)
      const scheduleId = randomUUIDv7()

      const command: CreateScheduleCommand = {
        type: 'createSchedule',
        id: scheduleId,
        correlationId: randomUUIDv7(),
        userId: 'user-multi-type',
        targetAggregateId: randomUUIDv7(),
        targetAggregateType: 'order',
        commandType: 'cancelOrder',
        commandData: { reason: 'auto-cancel' },
        scheduledFor: new Date(Date.now() + 7200000),
        createdBy: 'system',
      }

      // Act
      await service.execute(command)

      // Assert
      const snapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregate_id = ?
      `).get(scheduleId) as any

      const payload = JSON.parse(snapshot.payload)
      expect(payload.targetAggregateType).toBe('order')
      expect(payload.commandType).toBe('cancelOrder')
      expect(payload.commandData).toEqual({ reason: 'auto-cancel' })
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
