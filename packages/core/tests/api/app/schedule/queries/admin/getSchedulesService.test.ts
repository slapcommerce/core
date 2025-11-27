import { describe, test, expect } from 'bun:test'
import { GetSchedulesService } from '../../../../../../src/api/app/schedule/queries/admin/getSchedulesService'
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

function createBaseSchedule(overrides: Partial<Parameters<typeof insertSchedule>[1]> = {}): Parameters<typeof insertSchedule>[1] {
  return {
    aggregateId: `schedule-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    targetAggregateId: 'target-123',
    targetAggregateType: 'product',
    commandType: 'publish',
    commandData: null,
    scheduledFor: '2024-01-01T12:00:00.000Z',
    status: 'pending',
    retryCount: 0,
    nextRetryAt: null,
    createdBy: 'user-123',
    errorMessage: null,
    correlationId: 'corr-123',
    version: 1,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('GetSchedulesService', () => {
  describe('handle', () => {
    test('returns all schedules when no parameters provided', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetSchedulesService(db)
        insertSchedule(db, createBaseSchedule({ aggregateId: 'sched-1' }))
        insertSchedule(db, createBaseSchedule({ aggregateId: 'sched-2' }))
        insertSchedule(db, createBaseSchedule({ aggregateId: 'sched-3' }))

        // Act
        const result = service.handle()

        // Assert
        expect(result).toHaveLength(3)
      } finally {
        closeTestDatabase(db)
      }
    })

    test('returns empty array when no schedules exist', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetSchedulesService(db)

        // Act
        const result = service.handle()

        // Assert
        expect(result).toHaveLength(0)
        expect(result).toEqual([])
      } finally {
        closeTestDatabase(db)
      }
    })

    test('filters by status parameter', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetSchedulesService(db)
        insertSchedule(db, createBaseSchedule({ aggregateId: 'sched-1', status: 'pending' }))
        insertSchedule(db, createBaseSchedule({ aggregateId: 'sched-2', status: 'executed' }))
        insertSchedule(db, createBaseSchedule({ aggregateId: 'sched-3', status: 'pending' }))
        insertSchedule(db, createBaseSchedule({ aggregateId: 'sched-4', status: 'failed' }))

        // Act
        const result = service.handle({ status: 'pending' })

        // Assert
        expect(result).toHaveLength(2)
        expect(result.every(s => s.status === 'pending')).toBe(true)
      } finally {
        closeTestDatabase(db)
      }
    })

    test('filters by targetAggregateId parameter', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetSchedulesService(db)
        insertSchedule(db, createBaseSchedule({ aggregateId: 'sched-1', targetAggregateId: 'product-1' }))
        insertSchedule(db, createBaseSchedule({ aggregateId: 'sched-2', targetAggregateId: 'product-2' }))
        insertSchedule(db, createBaseSchedule({ aggregateId: 'sched-3', targetAggregateId: 'product-1' }))

        // Act
        const result = service.handle({ targetAggregateId: 'product-1' })

        // Assert
        expect(result).toHaveLength(2)
        expect(result.every(s => s.targetAggregateId === 'product-1')).toBe(true)
      } finally {
        closeTestDatabase(db)
      }
    })

    test('filters by targetAggregateType parameter', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetSchedulesService(db)
        insertSchedule(db, createBaseSchedule({ aggregateId: 'sched-1', targetAggregateType: 'product' }))
        insertSchedule(db, createBaseSchedule({ aggregateId: 'sched-2', targetAggregateType: 'collection' }))
        insertSchedule(db, createBaseSchedule({ aggregateId: 'sched-3', targetAggregateType: 'product' }))

        // Act
        const result = service.handle({ targetAggregateType: 'collection' })

        // Assert
        expect(result).toHaveLength(1)
        expect(result[0]!.targetAggregateType).toBe('collection')
      } finally {
        closeTestDatabase(db)
      }
    })

    test('filters by commandType parameter', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetSchedulesService(db)
        insertSchedule(db, createBaseSchedule({ aggregateId: 'sched-1', commandType: 'publish' }))
        insertSchedule(db, createBaseSchedule({ aggregateId: 'sched-2', commandType: 'unpublish' }))
        insertSchedule(db, createBaseSchedule({ aggregateId: 'sched-3', commandType: 'publish' }))

        // Act
        const result = service.handle({ commandType: 'unpublish' })

        // Assert
        expect(result).toHaveLength(1)
        expect(result[0]!.commandType).toBe('unpublish')
      } finally {
        closeTestDatabase(db)
      }
    })

    test('applies limit parameter', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetSchedulesService(db)
        insertSchedule(db, createBaseSchedule({ aggregateId: 'sched-1', scheduledFor: '2024-01-01T01:00:00.000Z' }))
        insertSchedule(db, createBaseSchedule({ aggregateId: 'sched-2', scheduledFor: '2024-01-01T02:00:00.000Z' }))
        insertSchedule(db, createBaseSchedule({ aggregateId: 'sched-3', scheduledFor: '2024-01-01T03:00:00.000Z' }))
        insertSchedule(db, createBaseSchedule({ aggregateId: 'sched-4', scheduledFor: '2024-01-01T04:00:00.000Z' }))

        // Act
        const result = service.handle({ limit: 2 })

        // Assert
        expect(result).toHaveLength(2)
      } finally {
        closeTestDatabase(db)
      }
    })

    test('applies offset parameter without limit (uses LIMIT -1)', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetSchedulesService(db)
        insertSchedule(db, createBaseSchedule({ aggregateId: 'sched-1', scheduledFor: '2024-01-01T01:00:00.000Z' }))
        insertSchedule(db, createBaseSchedule({ aggregateId: 'sched-2', scheduledFor: '2024-01-01T02:00:00.000Z' }))
        insertSchedule(db, createBaseSchedule({ aggregateId: 'sched-3', scheduledFor: '2024-01-01T03:00:00.000Z' }))
        insertSchedule(db, createBaseSchedule({ aggregateId: 'sched-4', scheduledFor: '2024-01-01T04:00:00.000Z' }))

        // Act
        const result = service.handle({ offset: 2 })

        // Assert
        expect(result).toHaveLength(2) // Skips first 2
      } finally {
        closeTestDatabase(db)
      }
    })

    test('applies both limit and offset parameters for pagination', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetSchedulesService(db)
        insertSchedule(db, createBaseSchedule({ aggregateId: 'sched-1', scheduledFor: '2024-01-01T01:00:00.000Z' }))
        insertSchedule(db, createBaseSchedule({ aggregateId: 'sched-2', scheduledFor: '2024-01-01T02:00:00.000Z' }))
        insertSchedule(db, createBaseSchedule({ aggregateId: 'sched-3', scheduledFor: '2024-01-01T03:00:00.000Z' }))
        insertSchedule(db, createBaseSchedule({ aggregateId: 'sched-4', scheduledFor: '2024-01-01T04:00:00.000Z' }))
        insertSchedule(db, createBaseSchedule({ aggregateId: 'sched-5', scheduledFor: '2024-01-01T05:00:00.000Z' }))

        // Act
        const result = service.handle({ limit: 2, offset: 1 })

        // Assert
        expect(result).toHaveLength(2)
        expect(result[0]!.scheduledFor).toBe('2024-01-01T02:00:00.000Z') // Second item (index 1)
        expect(result[1]!.scheduledFor).toBe('2024-01-01T03:00:00.000Z') // Third item (index 2)
      } finally {
        closeTestDatabase(db)
      }
    })

    test('orders results by scheduledFor ASC', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetSchedulesService(db)
        // Insert in non-chronological order
        insertSchedule(db, createBaseSchedule({ aggregateId: 'sched-3', scheduledFor: '2024-01-03T00:00:00.000Z' }))
        insertSchedule(db, createBaseSchedule({ aggregateId: 'sched-1', scheduledFor: '2024-01-01T00:00:00.000Z' }))
        insertSchedule(db, createBaseSchedule({ aggregateId: 'sched-2', scheduledFor: '2024-01-02T00:00:00.000Z' }))

        // Act
        const result = service.handle()

        // Assert
        expect(result).toHaveLength(3)
        expect(result[0]!.scheduledFor).toBe('2024-01-01T00:00:00.000Z')
        expect(result[1]!.scheduledFor).toBe('2024-01-02T00:00:00.000Z')
        expect(result[2]!.scheduledFor).toBe('2024-01-03T00:00:00.000Z')
      } finally {
        closeTestDatabase(db)
      }
    })

    test('combines multiple filters', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetSchedulesService(db)
        insertSchedule(db, createBaseSchedule({
          aggregateId: 'sched-1',
          status: 'pending',
          targetAggregateType: 'product',
          commandType: 'publish'
        }))
        insertSchedule(db, createBaseSchedule({
          aggregateId: 'sched-2',
          status: 'pending',
          targetAggregateType: 'collection',
          commandType: 'publish'
        }))
        insertSchedule(db, createBaseSchedule({
          aggregateId: 'sched-3',
          status: 'executed',
          targetAggregateType: 'product',
          commandType: 'publish'
        }))
        insertSchedule(db, createBaseSchedule({
          aggregateId: 'sched-4',
          status: 'pending',
          targetAggregateType: 'product',
          commandType: 'unpublish'
        }))

        // Act
        const result = service.handle({
          status: 'pending',
          targetAggregateType: 'product',
          commandType: 'publish'
        })

        // Assert
        expect(result).toHaveLength(1)
        expect(result[0]!.aggregateId).toBe('sched-1')
      } finally {
        closeTestDatabase(db)
      }
    })

    test('returns all fields from read model', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetSchedulesService(db)
        insertSchedule(db, createBaseSchedule({
          aggregateId: 'sched-1',
          targetAggregateId: 'target-456',
          targetAggregateType: 'variant',
          commandType: 'archive',
          commandData: '{"foo":"bar"}',
          scheduledFor: '2024-06-15T14:30:00.000Z',
          status: 'failed',
          retryCount: 3,
          nextRetryAt: '2024-06-15T15:00:00.000Z',
          createdBy: 'admin-user',
          errorMessage: 'Something went wrong',
          correlationId: 'corr-789',
          version: 2,
          createdAt: '2024-06-01T00:00:00.000Z',
          updatedAt: '2024-06-15T14:35:00.000Z',
        }))

        // Act
        const result = service.handle()

        // Assert
        expect(result).toHaveLength(1)
        const schedule = result[0]!
        expect(schedule.aggregateId).toBe('sched-1')
        expect(schedule.targetAggregateId).toBe('target-456')
        expect(schedule.targetAggregateType).toBe('variant')
        expect(schedule.commandType).toBe('archive')
        expect(schedule.commandData).toBe('{"foo":"bar"}')
        expect(schedule.scheduledFor).toBe('2024-06-15T14:30:00.000Z')
        expect(schedule.status).toBe('failed')
        expect(schedule.retryCount).toBe(3)
        expect(schedule.nextRetryAt).toBe('2024-06-15T15:00:00.000Z')
        expect(schedule.createdBy).toBe('admin-user')
        expect(schedule.errorMessage).toBe('Something went wrong')
        expect(schedule.correlationId).toBe('corr-789')
        expect(schedule.version).toBe(2)
        expect(schedule.createdAt).toBe('2024-06-01T00:00:00.000Z')
        expect(schedule.updatedAt).toBe('2024-06-15T14:35:00.000Z')
      } finally {
        closeTestDatabase(db)
      }
    })
  })
})
