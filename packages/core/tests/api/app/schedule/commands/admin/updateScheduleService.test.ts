import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDatabase, closeTestDatabase } from '../../../../../helpers/database'
import { TransactionBatcher } from '../../../../../../src/api/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../../../../src/api/infrastructure/unitOfWork'
import { UpdateScheduleService } from '../../../../../../src/api/app/schedule/commands/admin/updateScheduleService'
import { ScheduleAggregate } from '../../../../../../src/api/domain/schedule/aggregate'
import type { UpdateScheduleCommand } from '../../../../../../src/api/app/schedule/commands/commands'
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

async function createScheduleInDatabase(
  unitOfWork: UnitOfWork,
  scheduleId: string,
  correlationId: string,
  status: 'pending' | 'executed' | 'failed' | 'cancelled' = 'pending'
) {
  await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
    const scheduleAggregate = ScheduleAggregate.create({
      id: scheduleId,
      correlationId,
      userId: 'test-user',
      targetAggregateId: randomUUIDv7(),
      targetAggregateType: 'product',
      commandType: 'publishProduct',
      commandData: { original: 'data' },
      scheduledFor: new Date(Date.now() + 86400000),
      createdBy: 'admin-test',
    })

    // Modify status if needed
    if (status === 'executed') {
      scheduleAggregate.markExecuted('test-user')
    } else if (status === 'cancelled') {
      scheduleAggregate.cancel('test-user')
    } else if (status === 'failed') {
      // Mark as failed with max retries to set status to 'failed'
      scheduleAggregate.markFailed('Test error', 'test-user', 0)
    }

    // Save snapshot
    snapshotRepository.saveSnapshot({
      aggregateId: scheduleAggregate.id,
      correlationId: correlationId,
      version: scheduleAggregate.version,
      payload: scheduleAggregate.toSnapshot(),
    })

    // Save events
    for (const event of scheduleAggregate.uncommittedEvents) {
      eventRepository.addEvent(event)
      outboxRepository.addOutboxEvent(event, { id: randomUUIDv7() })
    }
  })
}

describe('UpdateScheduleService', () => {
  test('should successfully update pending schedule', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const scheduleId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      await createScheduleInDatabase(unitOfWork, scheduleId, correlationId, 'pending')

      const service = new UpdateScheduleService(unitOfWork)
      const newScheduledFor = new Date(Date.now() + 172800000) // 48 hours from now
      const newCommandData = { updated: 'data', reason: 'schedule-change' }

      const command: UpdateScheduleCommand = {
        type: 'updateSchedule',
        id: scheduleId,
        userId: 'updater-user',
        scheduledFor: newScheduledFor,
        commandData: newCommandData,
        expectedVersion: 0,
      }

      // Act
      await service.execute(command)

      // Assert - Verify snapshot was updated
      const snapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregate_id = ?
        ORDER BY version DESC
        LIMIT 1
      `).get(scheduleId) as any

      expect(snapshot).not.toBeNull()
      expect(snapshot.version).toBe(1) // Version incremented from 0 to 1

      const payload = JSON.parse(snapshot.payload)
      expect(new Date(payload.scheduledFor).toISOString()).toBe(newScheduledFor.toISOString())
      expect(payload.commandData).toEqual(newCommandData)
      expect(payload.status).toBe('pending')
      expect(payload.version).toBe(1)

      // Verify update event was saved
      const events = db.query(`
        SELECT * FROM events
        WHERE aggregate_id = ? AND eventType = 'schedule.updated'
      `).all(scheduleId) as any[]

      expect(events.length).toBe(1)
      expect(events[0].version).toBe(1)

      const eventPayload = JSON.parse(events[0].payload)
      expect(eventPayload.priorState.commandData).toEqual({ original: 'data' })
      expect(eventPayload.newState.commandData).toEqual(newCommandData)
      expect(new Date(eventPayload.newState.scheduledFor).toISOString()).toBe(newScheduledFor.toISOString())

      // Verify outbox entry was created for update event
      const outboxEvents = db.query(`
        SELECT * FROM outbox
        WHERE aggregate_id = ? AND eventType = 'schedule.updated'
      `).all(scheduleId) as any[]

      expect(outboxEvents.length).toBe(1)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when schedule not found', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new UpdateScheduleService(unitOfWork)
      const nonExistentId = randomUUIDv7()

      const command: UpdateScheduleCommand = {
        type: 'updateSchedule',
        id: nonExistentId,
        userId: 'user-404',
        scheduledFor: new Date(Date.now() + 1000),
        commandData: null,
        expectedVersion: 0,
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow(
        `Schedule with id ${nonExistentId} not found`
      )
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error on optimistic concurrency conflict', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const scheduleId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      await createScheduleInDatabase(unitOfWork, scheduleId, correlationId, 'pending')

      const service = new UpdateScheduleService(unitOfWork)

      const command: UpdateScheduleCommand = {
        type: 'updateSchedule',
        id: scheduleId,
        userId: 'user-conflict',
        scheduledFor: new Date(Date.now() + 1000),
        commandData: null,
        expectedVersion: 5, // Wrong version - actual version is 0
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow(
        'Optimistic concurrency conflict: expected version 5 but found version 0'
      )
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when attempting to update executed schedule', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const scheduleId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      await createScheduleInDatabase(unitOfWork, scheduleId, correlationId, 'executed')

      const service = new UpdateScheduleService(unitOfWork)

      const command: UpdateScheduleCommand = {
        type: 'updateSchedule',
        id: scheduleId,
        userId: 'user-executed',
        scheduledFor: new Date(Date.now() + 1000),
        commandData: null,
        expectedVersion: 1, // Executed schedules have version 1
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow(
        'Cannot update schedule with status executed. Only pending schedules can be updated.'
      )
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when attempting to update cancelled schedule', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const scheduleId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      await createScheduleInDatabase(unitOfWork, scheduleId, correlationId, 'cancelled')

      const service = new UpdateScheduleService(unitOfWork)

      const command: UpdateScheduleCommand = {
        type: 'updateSchedule',
        id: scheduleId,
        userId: 'user-cancelled',
        scheduledFor: new Date(Date.now() + 1000),
        commandData: { test: 'data' },
        expectedVersion: 1, // Cancelled schedules have version 1
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow(
        'Cannot update schedule with status cancelled. Only pending schedules can be updated.'
      )
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when attempting to update failed schedule', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const scheduleId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      await createScheduleInDatabase(unitOfWork, scheduleId, correlationId, 'failed')

      const service = new UpdateScheduleService(unitOfWork)

      const command: UpdateScheduleCommand = {
        type: 'updateSchedule',
        id: scheduleId,
        userId: 'user-failed',
        scheduledFor: new Date(Date.now() + 1000),
        commandData: null,
        expectedVersion: 1, // Failed schedules have version 1
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow(
        'Cannot update schedule with status failed. Only pending schedules can be updated.'
      )
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should update scheduledFor time correctly', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const scheduleId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      await createScheduleInDatabase(unitOfWork, scheduleId, correlationId, 'pending')

      const service = new UpdateScheduleService(unitOfWork)
      const originalScheduledFor = new Date(Date.now() + 86400000)
      const newScheduledFor = new Date(Date.now() + 259200000) // 3 days from now

      const command: UpdateScheduleCommand = {
        type: 'updateSchedule',
        id: scheduleId,
        userId: 'time-updater',
        scheduledFor: newScheduledFor,
        commandData: { original: 'data' },
        expectedVersion: 0,
      }

      // Act
      await service.execute(command)

      // Assert
      const snapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregate_id = ?
      `).get(scheduleId) as any

      const payload = JSON.parse(snapshot.payload)
      expect(new Date(payload.scheduledFor).toISOString()).toBe(newScheduledFor.toISOString())
      expect(new Date(payload.scheduledFor).toISOString()).not.toBe(originalScheduledFor.toISOString())
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should update commandData correctly', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const scheduleId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      await createScheduleInDatabase(unitOfWork, scheduleId, correlationId, 'pending')

      const service = new UpdateScheduleService(unitOfWork)
      const updatedCommandData = { completely: 'new', data: 'structure' }

      const command: UpdateScheduleCommand = {
        type: 'updateSchedule',
        id: scheduleId,
        userId: 'data-updater',
        scheduledFor: new Date(Date.now() + 1000),
        commandData: updatedCommandData,
        expectedVersion: 0,
      }

      // Act
      await service.execute(command)

      // Assert
      const snapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregate_id = ?
      `).get(scheduleId) as any

      const payload = JSON.parse(snapshot.payload)
      expect(payload.commandData).toEqual(updatedCommandData)
      expect(payload.commandData).not.toEqual({ original: 'data' })
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should update commandData to null', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const scheduleId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      await createScheduleInDatabase(unitOfWork, scheduleId, correlationId, 'pending')

      const service = new UpdateScheduleService(unitOfWork)

      const command: UpdateScheduleCommand = {
        type: 'updateSchedule',
        id: scheduleId,
        userId: 'null-updater',
        scheduledFor: new Date(Date.now() + 1000),
        commandData: null,
        expectedVersion: 0,
      }

      // Act
      await service.execute(command)

      // Assert
      const snapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregate_id = ?
      `).get(scheduleId) as any

      const payload = JSON.parse(snapshot.payload)
      expect(payload.commandData).toBeNull()
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should increment version correctly', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const scheduleId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      await createScheduleInDatabase(unitOfWork, scheduleId, correlationId, 'pending')

      const service = new UpdateScheduleService(unitOfWork)

      // Act - First update
      await service.execute({
        type: 'updateSchedule',
        id: scheduleId,
        userId: 'version-user',
        scheduledFor: new Date(Date.now() + 1000),
        commandData: { update: 1 },
        expectedVersion: 0,
      })

      // Act - Second update
      await service.execute({
        type: 'updateSchedule',
        id: scheduleId,
        userId: 'version-user',
        scheduledFor: new Date(Date.now() + 2000),
        commandData: { update: 2 },
        expectedVersion: 1,
      })

      // Assert
      const snapshot = db.query(`
        SELECT version FROM snapshots
        WHERE aggregate_id = ?
      `).get(scheduleId) as any

      expect(snapshot.version).toBe(2)

      const events = db.query(`
        SELECT version FROM events
        WHERE aggregate_id = ?
        ORDER BY version ASC
      `).all(scheduleId) as any[]

      expect(events.length).toBe(3) // created (v0) + 2 updates (v1, v2)
      expect(events[0].version).toBe(0)
      expect(events[1].version).toBe(1)
      expect(events[2].version).toBe(2)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should set correct access level', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new UpdateScheduleService(unitOfWork)

      // Assert
      expect(service.accessLevel).toBe('admin')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should rollback on error', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const scheduleId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      await createScheduleInDatabase(unitOfWork, scheduleId, correlationId, 'pending')

      // Get initial state
      const initialSnapshotCount = db.query(`
        SELECT COUNT(*) as count FROM snapshots
      `).get() as any

      const initialEventCount = db.query(`
        SELECT COUNT(*) as count FROM events
      `).get() as any

      const service = new UpdateScheduleService(unitOfWork)

      const command: UpdateScheduleCommand = {
        type: 'updateSchedule',
        id: scheduleId,
        userId: 'rollback-user',
        scheduledFor: new Date(Date.now() + 1000),
        commandData: null,
        expectedVersion: 999, // Wrong version - will cause error
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow()

      // Verify no new snapshots or events were created
      const finalSnapshotCount = db.query(`
        SELECT COUNT(*) as count FROM snapshots
      `).get() as any

      const finalEventCount = db.query(`
        SELECT COUNT(*) as count FROM events
      `).get() as any

      expect(finalSnapshotCount.count).toBe(initialSnapshotCount.count)
      expect(finalEventCount.count).toBe(initialEventCount.count)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should update updatedAt timestamp', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const scheduleId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      await createScheduleInDatabase(unitOfWork, scheduleId, correlationId, 'pending')

      // Get original timestamp
      const originalSnapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregate_id = ?
      `).get(scheduleId) as any
      const originalPayload = JSON.parse(originalSnapshot.payload)
      const originalUpdatedAt = new Date(originalPayload.updatedAt)

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10))

      const service = new UpdateScheduleService(unitOfWork)

      const command: UpdateScheduleCommand = {
        type: 'updateSchedule',
        id: scheduleId,
        userId: 'timestamp-user',
        scheduledFor: new Date(Date.now() + 1000),
        commandData: { updated: 'yes' },
        expectedVersion: 0,
      }

      // Act
      await service.execute(command)

      // Assert
      const updatedSnapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregate_id = ?
      `).get(scheduleId) as any
      const updatedPayload = JSON.parse(updatedSnapshot.payload)
      const newUpdatedAt = new Date(updatedPayload.updatedAt)

      expect(newUpdatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
