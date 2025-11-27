import { describe, test, expect } from 'bun:test'
import { GetScheduleService } from '../../../../../../src/api/app/schedule/queries/admin/getScheduleService'
import { createTestDatabase, closeTestDatabase } from '../../../../../helpers/database'

// Helper to insert a schedule directly into the read model
function insertSchedule(db: ReturnType<typeof createTestDatabase>, schedule: {
  aggregateId: string
  targetAggregateId: string
  targetAggregateType: string
  commandType: string
  commandData?: string | null
  scheduledFor: string
  status: 'pending' | 'executed' | 'failed' | 'cancelled'
  retryCount?: number
  nextRetryAt?: string | null
  createdBy: string
  errorMessage?: string | null
  correlationId: string
  version: number
  createdAt: string
  updatedAt: string
}) {
  db.run(`
    INSERT INTO schedulesReadModel (
      aggregateId, targetAggregateId, targetAggregateType, commandType, commandData,
      scheduledFor, status, retryCount, nextRetryAt, createdBy, errorMessage,
      correlationId, version, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    schedule.aggregateId,
    schedule.targetAggregateId,
    schedule.targetAggregateType,
    schedule.commandType,
    schedule.commandData ?? null,
    schedule.scheduledFor,
    schedule.status,
    schedule.retryCount ?? 0,
    schedule.nextRetryAt ?? null,
    schedule.createdBy,
    schedule.errorMessage ?? null,
    schedule.correlationId,
    schedule.version,
    schedule.createdAt,
    schedule.updatedAt,
  ])
}

describe('GetScheduleService', () => {
  describe('handle', () => {
    test('returns schedule when found', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetScheduleService(db)
        insertSchedule(db, {
          aggregateId: 'schedule-123',
          targetAggregateId: 'product-456',
          targetAggregateType: 'product',
          commandType: 'publish',
          scheduledFor: '2024-01-15T10:00:00.000Z',
          status: 'pending',
          createdBy: 'user-123',
          correlationId: 'corr-123',
          version: 1,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        })

        // Act
        const result = service.handle({ scheduleId: 'schedule-123' })

        // Assert
        expect(result).not.toBeNull()
        expect(result!.aggregateId).toBe('schedule-123')
        expect(result!.targetAggregateId).toBe('product-456')
        expect(result!.commandType).toBe('publish')
        expect(result!.status).toBe('pending')
      } finally {
        closeTestDatabase(db)
      }
    })

    test('returns null when schedule not found', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetScheduleService(db)
        // No schedule inserted

        // Act
        const result = service.handle({ scheduleId: 'non-existent-schedule' })

        // Assert
        expect(result).toBeNull()
      } finally {
        closeTestDatabase(db)
      }
    })

    test('returns correct schedule among multiple', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetScheduleService(db)
        insertSchedule(db, {
          aggregateId: 'schedule-1',
          targetAggregateId: 'product-1',
          targetAggregateType: 'product',
          commandType: 'publish',
          scheduledFor: '2024-01-01T00:00:00.000Z',
          status: 'pending',
          createdBy: 'user-1',
          correlationId: 'corr-1',
          version: 1,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        })
        insertSchedule(db, {
          aggregateId: 'schedule-2',
          targetAggregateId: 'product-2',
          targetAggregateType: 'product',
          commandType: 'unpublish',
          scheduledFor: '2024-01-02T00:00:00.000Z',
          status: 'executed',
          createdBy: 'user-2',
          correlationId: 'corr-2',
          version: 1,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        })

        // Act
        const result = service.handle({ scheduleId: 'schedule-2' })

        // Assert
        expect(result).not.toBeNull()
        expect(result!.aggregateId).toBe('schedule-2')
        expect(result!.targetAggregateId).toBe('product-2')
        expect(result!.commandType).toBe('unpublish')
        expect(result!.status).toBe('executed')
      } finally {
        closeTestDatabase(db)
      }
    })

    test('returns all fields from read model', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetScheduleService(db)
        insertSchedule(db, {
          aggregateId: 'schedule-full',
          targetAggregateId: 'variant-789',
          targetAggregateType: 'variant',
          commandType: 'archive',
          commandData: '{"reason":"seasonal"}',
          scheduledFor: '2024-06-15T14:00:00.000Z',
          status: 'failed',
          retryCount: 3,
          nextRetryAt: '2024-06-15T15:00:00.000Z',
          createdBy: 'admin-user',
          errorMessage: 'Network timeout',
          correlationId: 'corr-full',
          version: 4,
          createdAt: '2024-06-01T00:00:00.000Z',
          updatedAt: '2024-06-15T14:05:00.000Z',
        })

        // Act
        const result = service.handle({ scheduleId: 'schedule-full' })

        // Assert
        expect(result).not.toBeNull()
        expect(result!.aggregateId).toBe('schedule-full')
        expect(result!.targetAggregateId).toBe('variant-789')
        expect(result!.targetAggregateType).toBe('variant')
        expect(result!.commandType).toBe('archive')
        expect(result!.commandData).toBe('{"reason":"seasonal"}')
        expect(result!.scheduledFor).toBe('2024-06-15T14:00:00.000Z')
        expect(result!.status).toBe('failed')
        expect(result!.retryCount).toBe(3)
        expect(result!.nextRetryAt).toBe('2024-06-15T15:00:00.000Z')
        expect(result!.createdBy).toBe('admin-user')
        expect(result!.errorMessage).toBe('Network timeout')
        expect(result!.correlationId).toBe('corr-full')
        expect(result!.version).toBe(4)
        expect(result!.createdAt).toBe('2024-06-01T00:00:00.000Z')
        expect(result!.updatedAt).toBe('2024-06-15T14:05:00.000Z')
      } finally {
        closeTestDatabase(db)
      }
    })
  })
})
