import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDatabase, closeTestDatabase } from '../../helpers/database'
import { TransactionBatcher } from '../../../../src/api/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../../src/api/infrastructure/unitOfWork'
import { CancelScheduleService } from '../../../../src/api/app/schedule/cancelScheduleService'
import { ScheduleAggregate } from '../../../../src/api/domain/schedule/aggregate'
import type { CancelScheduleCommand } from '../../../../src/api/app/schedule/commands'
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
      commandData: { reason: 'test' },
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
      aggregate_id: scheduleAggregate.id,
      correlation_id: correlationId,
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

describe('CancelScheduleService', () => {
  test('should successfully cancel pending schedule', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const scheduleId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      await createScheduleInDatabase(unitOfWork, scheduleId, correlationId, 'pending')

      const service = new CancelScheduleService(unitOfWork)

      const command: CancelScheduleCommand = {
        type: 'cancelSchedule',
        id: scheduleId,
        userId: 'canceller-user',
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
      expect(payload.status).toBe('cancelled')
      expect(payload.version).toBe(1)

      // Verify cancel event was saved
      const events = db.query(`
        SELECT * FROM events
        WHERE aggregate_id = ? AND event_type = 'schedule.cancelled'
      `).all(scheduleId) as any[]

      expect(events.length).toBe(1)
      expect(events[0].version).toBe(1)
      expect(events[0].user_id).toBe('canceller-user')

      const eventPayload = JSON.parse(events[0].payload)
      expect(eventPayload.priorState.status).toBe('pending')
      expect(eventPayload.newState.status).toBe('cancelled')

      // Verify outbox entry was created for cancel event
      const outboxEvents = db.query(`
        SELECT * FROM outbox
        WHERE aggregate_id = ? AND event_type = 'schedule.cancelled'
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
      const service = new CancelScheduleService(unitOfWork)
      const nonExistentId = randomUUIDv7()

      const command: CancelScheduleCommand = {
        type: 'cancelSchedule',
        id: nonExistentId,
        userId: 'user-404',
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

      const service = new CancelScheduleService(unitOfWork)

      const command: CancelScheduleCommand = {
        type: 'cancelSchedule',
        id: scheduleId,
        userId: 'user-conflict',
        expectedVersion: 7, // Wrong version - actual version is 0
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow(
        'Optimistic concurrency conflict: expected version 7 but found version 0'
      )
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when attempting to cancel already executed schedule', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const scheduleId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      await createScheduleInDatabase(unitOfWork, scheduleId, correlationId, 'executed')

      const service = new CancelScheduleService(unitOfWork)

      const command: CancelScheduleCommand = {
        type: 'cancelSchedule',
        id: scheduleId,
        userId: 'user-executed',
        expectedVersion: 1, // Executed schedules have version 1
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow(
        'Cannot cancel an already executed schedule'
      )
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when attempting to cancel already cancelled schedule', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const scheduleId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      await createScheduleInDatabase(unitOfWork, scheduleId, correlationId, 'cancelled')

      const service = new CancelScheduleService(unitOfWork)

      const command: CancelScheduleCommand = {
        type: 'cancelSchedule',
        id: scheduleId,
        userId: 'user-double-cancel',
        expectedVersion: 1, // Cancelled schedules have version 1
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow(
        'Schedule is already cancelled'
      )
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should successfully cancel failed schedule', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const scheduleId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      await createScheduleInDatabase(unitOfWork, scheduleId, correlationId, 'failed')

      const service = new CancelScheduleService(unitOfWork)

      const command: CancelScheduleCommand = {
        type: 'cancelSchedule',
        id: scheduleId,
        userId: 'user-cancel-failed',
        expectedVersion: 1, // Failed schedules have version 1
      }

      // Act
      await service.execute(command)

      // Assert - Failed schedules can be cancelled
      const snapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregate_id = ?
      `).get(scheduleId) as any

      const payload = JSON.parse(snapshot.payload)
      expect(payload.status).toBe('cancelled')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should verify status changes to cancelled', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const scheduleId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      await createScheduleInDatabase(unitOfWork, scheduleId, correlationId, 'pending')

      // Verify initial status
      const beforeSnapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregate_id = ?
      `).get(scheduleId) as any
      const beforePayload = JSON.parse(beforeSnapshot.payload)
      expect(beforePayload.status).toBe('pending')

      const service = new CancelScheduleService(unitOfWork)

      const command: CancelScheduleCommand = {
        type: 'cancelSchedule',
        id: scheduleId,
        userId: 'status-checker',
        expectedVersion: 0,
      }

      // Act
      await service.execute(command)

      // Assert - Status changed to cancelled
      const afterSnapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregate_id = ?
      `).get(scheduleId) as any
      const afterPayload = JSON.parse(afterSnapshot.payload)
      expect(afterPayload.status).toBe('cancelled')
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

      const service = new CancelScheduleService(unitOfWork)

      const command: CancelScheduleCommand = {
        type: 'cancelSchedule',
        id: scheduleId,
        userId: 'version-user',
        expectedVersion: 0,
      }

      // Act
      await service.execute(command)

      // Assert
      const snapshot = db.query(`
        SELECT version FROM snapshots
        WHERE aggregate_id = ?
      `).get(scheduleId) as any

      expect(snapshot.version).toBe(1) // Incremented from 0 to 1

      const events = db.query(`
        SELECT version FROM events
        WHERE aggregate_id = ?
        ORDER BY version ASC
      `).all(scheduleId) as any[]

      expect(events.length).toBe(2) // created (v0) + cancelled (v1)
      expect(events[0].version).toBe(0)
      expect(events[1].version).toBe(1)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should set correct access level', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CancelScheduleService(unitOfWork)

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

      const service = new CancelScheduleService(unitOfWork)

      const command: CancelScheduleCommand = {
        type: 'cancelSchedule',
        id: scheduleId,
        userId: 'rollback-user',
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

      const service = new CancelScheduleService(unitOfWork)

      const command: CancelScheduleCommand = {
        type: 'cancelSchedule',
        id: scheduleId,
        userId: 'timestamp-user',
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

  test('should preserve other schedule properties when cancelling', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const scheduleId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      await createScheduleInDatabase(unitOfWork, scheduleId, correlationId, 'pending')

      // Get original data
      const originalSnapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregate_id = ?
      `).get(scheduleId) as any
      const originalPayload = JSON.parse(originalSnapshot.payload)

      const service = new CancelScheduleService(unitOfWork)

      const command: CancelScheduleCommand = {
        type: 'cancelSchedule',
        id: scheduleId,
        userId: 'preserve-user',
        expectedVersion: 0,
      }

      // Act
      await service.execute(command)

      // Assert - Other properties should remain unchanged
      const updatedSnapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregate_id = ?
      `).get(scheduleId) as any
      const updatedPayload = JSON.parse(updatedSnapshot.payload)

      expect(updatedPayload.targetAggregateId).toBe(originalPayload.targetAggregateId)
      expect(updatedPayload.targetAggregateType).toBe(originalPayload.targetAggregateType)
      expect(updatedPayload.commandType).toBe(originalPayload.commandType)
      expect(updatedPayload.commandData).toEqual(originalPayload.commandData)
      expect(updatedPayload.scheduledFor).toBe(originalPayload.scheduledFor)
      expect(updatedPayload.createdBy).toBe(originalPayload.createdBy)
      expect(updatedPayload.retryCount).toBe(originalPayload.retryCount)
      expect(updatedPayload.errorMessage).toBe(originalPayload.errorMessage)

      // Only status should change
      expect(updatedPayload.status).not.toBe(originalPayload.status)
      expect(updatedPayload.status).toBe('cancelled')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should handle multiple schedules independently', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const scheduleId1 = randomUUIDv7()
      const scheduleId2 = randomUUIDv7()
      const correlationId1 = randomUUIDv7()
      const correlationId2 = randomUUIDv7()

      await createScheduleInDatabase(unitOfWork, scheduleId1, correlationId1, 'pending')
      await createScheduleInDatabase(unitOfWork, scheduleId2, correlationId2, 'pending')

      const service = new CancelScheduleService(unitOfWork)

      // Act - Cancel only the first schedule
      await service.execute({
        type: 'cancelSchedule',
        id: scheduleId1,
        userId: 'multi-user',
        expectedVersion: 0,
      })

      // Assert - First schedule is cancelled
      const snapshot1 = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregate_id = ?
      `).get(scheduleId1) as any
      const payload1 = JSON.parse(snapshot1.payload)
      expect(payload1.status).toBe('cancelled')

      // Assert - Second schedule is still pending
      const snapshot2 = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregate_id = ?
      `).get(scheduleId2) as any
      const payload2 = JSON.parse(snapshot2.payload)
      expect(payload2.status).toBe('pending')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
