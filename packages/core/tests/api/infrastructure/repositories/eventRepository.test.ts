import { describe, test, expect } from 'bun:test'
import { EventRepository } from '../../../../src/api/infrastructure/repositories/eventRepository'
import { TransactionBatch } from '../../../../src/api/infrastructure/transactionBatch'
import type { DomainEventUnion } from '../../../../src/api/domain/_base/domainEvent'
import { SkuReleasedEvent } from '../../../../src/api/domain/sku/skuEvents'
import { createTestDatabase, closeTestDatabase } from '../../../helpers/database'

// Helper to create test domain events
function createTestEvent(overrides?: {
  eventName?: string;
  version?: number;
  aggregateId?: string;
  correlationId?: string;
  occurredAt?: Date;
  userId?: string;
  payload?: Record<string, unknown>;
}): DomainEventUnion {
  return new SkuReleasedEvent({
    occurredAt: overrides?.occurredAt ?? new Date(),
    aggregateId: overrides?.aggregateId ?? 'test-aggregate',
    correlationId: overrides?.correlationId ?? 'test-correlation',
    version: overrides?.version ?? 1,
    userId: overrides?.userId ?? 'test-user-id',
    priorState: { sku: 'test-sku', variantId: 'test-variant', status: 'released' },
    newState: { sku: 'test-sku', variantId: 'test-variant', status: 'active' },
  })
}

describe('EventRepository', () => {
  test('constructor properly initializes with Database and TransactionBatch dependencies', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      // Act
      const repository = new EventRepository(db, batch)

      // Assert - Repository should be created without errors
      expect(repository).toBeDefined()
      expect(repository).toBeInstanceOf(EventRepository)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('addEvent creates a prepared SQL statement with correct INSERT query', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new EventRepository(db, batch)
    const event = createTestEvent()

    // Act
    repository.addEvent(event)

      // Assert - Verify the command was added to batch
      expect(batch.commands.length).toBe(1)
      expect(batch.commands[0]!.type).toBe('insert')
      expect(batch.commands[0]!.statement).toBeDefined()
    } finally {
      closeTestDatabase(db)
    }
  })

  test('addEvent adds command to batch with correct parameters', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new EventRepository(db, batch)
      const occurredAt = new Date(1234567890)
      const event = createTestEvent({
        version: 2,
        aggregateId: 'product-123',
        correlationId: 'corr-456',
        occurredAt,
      })

      // Act
      repository.addEvent(event)

      // Assert
      expect(batch.commands.length).toBe(1)
      const command = batch.commands[0]!
      expect(command.params).toEqual([
        'sku.released',
        2,
        'product-123',
        'corr-456',
        occurredAt.toISOString(),
        'test-user-id',
        JSON.stringify({
          priorState: { sku: 'test-sku', variantId: 'test-variant', status: 'released' },
          newState: { sku: 'test-sku', variantId: 'test-variant', status: 'active' }
        })
      ])
    } finally {
      closeTestDatabase(db)
    }
  })

  test('addEvent sets command type to insert', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new EventRepository(db, batch)
    const event = createTestEvent()

    // Act
    repository.addEvent(event)

      // Assert
      expect(batch.commands[0]!.type).toBe('insert')
    } finally {
      closeTestDatabase(db)
    }
  })

  test('multiple events can be added sequentially', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new EventRepository(db, batch)

      // Act
      repository.addEvent(createTestEvent({
        aggregateId: 'agg-1',
        correlationId: 'corr-1',
      }))

      repository.addEvent(createTestEvent({
        version: 2,
        aggregateId: 'agg-2',
        correlationId: 'corr-2',
      }))

      repository.addEvent(createTestEvent({
        version: 3,
        aggregateId: 'agg-3',
        correlationId: 'corr-3',
      }))

      // Assert
      expect(batch.commands.length).toBe(3)
      expect(batch.commands[0]!.params[0]).toBe('sku.released')
      expect(batch.commands[1]!.params[0]).toBe('sku.released')
      expect(batch.commands[2]!.params[0]).toBe('sku.released')
    } finally {
      closeTestDatabase(db)
    }
  })

  test('all event fields are correctly passed to the batch', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new EventRepository(db, batch)
      const eventType = 'sku.released'
      const version = 5
      const aggregateId = 'order-789'
      const correlationId = 'corr-999'
      const occurredAt = new Date(9876543210)
      const payload = {
        priorState: { sku: 'test-sku', variantId: 'test-variant', status: 'released' },
        newState: { sku: 'test-sku', variantId: 'test-variant', status: 'active' }
      }

      const event = createTestEvent({
        version,
        aggregateId,
        correlationId,
        occurredAt,
      })

      // Act
      repository.addEvent(event)

      // Assert
      const command = batch.commands[0]!
      expect(command.params[0]).toBe(eventType)
      expect(command.params[1]).toBe(version)
      expect(command.params[2]).toBe(aggregateId)
      expect(command.params[3]).toBe(correlationId)
      expect(command.params[4]).toBe(occurredAt.toISOString())
      expect(command.params[5]).toBe('test-user-id')
      expect(command.params[6]).toBe(JSON.stringify(payload))
    } finally {
      closeTestDatabase(db)
    }
  })

  describe('getEvents', () => {
    test('returns empty array for non-existent aggregate', () => {
      // Arrange
      const db = createTestDatabase()
      const batch = new TransactionBatch()

      try {
        const repository = new EventRepository(db, batch)

        // Act
        const events = repository.getEvents('non-existent-aggregate')

        // Assert
        expect(events).toEqual([])
        expect(events).toHaveLength(0)
      } finally {
        closeTestDatabase(db)
      }
    })

    test('returns events for existing aggregate', () => {
      // Arrange
      const db = createTestDatabase()
      const batch = new TransactionBatch()

      try {
        // Insert event directly into database
        const occurredAt = new Date('2024-01-15T10:00:00.000Z')
        const payload = { priorState: { foo: 'bar' }, newState: { foo: 'baz' } }
        db.run(`
          INSERT INTO events (eventType, version, aggregateId, correlationId, occurredAt, userId, payload)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          'test.event',
          1,
          'aggregate-123',
          'correlation-456',
          occurredAt.toISOString(),
          'user-789',
          JSON.stringify(payload),
        ])

        const repository = new EventRepository(db, batch)

        // Act
        const events = repository.getEvents('aggregate-123')

        // Assert
        expect(events).toHaveLength(1)
        expect(events[0]!.eventName as string).toBe('test.event')
        expect(events[0]!.version).toBe(1)
        expect(events[0]!.aggregateId).toBe('aggregate-123')
        expect(events[0]!.correlationId).toBe('correlation-456')
        expect(events[0]!.userId).toBe('user-789')
      } finally {
        closeTestDatabase(db)
      }
    })

    test('returns events ordered by version ASC', () => {
      // Arrange
      const db = createTestDatabase()
      const batch = new TransactionBatch()

      try {
        // Insert events in reverse order
        const baseTime = new Date('2024-01-15T10:00:00.000Z')
        const payload = { priorState: {}, newState: {} }

        db.run(`
          INSERT INTO events (eventType, version, aggregateId, correlationId, occurredAt, userId, payload)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, ['event.v3', 3, 'aggregate-order', 'corr-1', baseTime.toISOString(), 'user-1', JSON.stringify(payload)])

        db.run(`
          INSERT INTO events (eventType, version, aggregateId, correlationId, occurredAt, userId, payload)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, ['event.v1', 1, 'aggregate-order', 'corr-1', baseTime.toISOString(), 'user-1', JSON.stringify(payload)])

        db.run(`
          INSERT INTO events (eventType, version, aggregateId, correlationId, occurredAt, userId, payload)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, ['event.v2', 2, 'aggregate-order', 'corr-1', baseTime.toISOString(), 'user-1', JSON.stringify(payload)])

        const repository = new EventRepository(db, batch)

        // Act
        const events = repository.getEvents('aggregate-order')

        // Assert
        expect(events).toHaveLength(3)
        expect(events[0]!.eventName as string).toBe('event.v1')
        expect(events[0]!.version).toBe(1)
        expect(events[1]!.eventName as string).toBe('event.v2')
        expect(events[1]!.version).toBe(2)
        expect(events[2]!.eventName as string).toBe('event.v3')
        expect(events[2]!.version).toBe(3)
      } finally {
        closeTestDatabase(db)
      }
    })

    test('correctly deserializes event dates', () => {
      // Arrange
      const db = createTestDatabase()
      const batch = new TransactionBatch()

      try {
        const occurredAt = new Date('2024-06-15T14:30:45.123Z')
        const payload = { priorState: {}, newState: {} }
        db.run(`
          INSERT INTO events (eventType, version, aggregateId, correlationId, occurredAt, userId, payload)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, ['test.event', 1, 'aggregate-date', 'corr-1', occurredAt.toISOString(), 'user-1', JSON.stringify(payload)])

        const repository = new EventRepository(db, batch)

        // Act
        const events = repository.getEvents('aggregate-date')

        // Assert
        expect(events).toHaveLength(1)
        expect(events[0]!.occurredAt).toBeInstanceOf(Date)
        expect(events[0]!.occurredAt.toISOString()).toBe('2024-06-15T14:30:45.123Z')
      } finally {
        closeTestDatabase(db)
      }
    })

    test('correctly deserializes JSON payload', () => {
      // Arrange
      const db = createTestDatabase()
      const batch = new TransactionBatch()

      try {
        const complexPayload = {
          priorState: {
            name: 'Old Name',
            count: 42,
            items: ['a', 'b', 'c'],
            nested: { deep: true },
          },
          newState: {
            name: 'New Name',
            count: 43,
            items: ['a', 'b', 'c', 'd'],
            nested: { deep: false },
          },
        }
        db.run(`
          INSERT INTO events (eventType, version, aggregateId, correlationId, occurredAt, userId, payload)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, ['test.event', 1, 'aggregate-payload', 'corr-1', new Date().toISOString(), 'user-1', JSON.stringify(complexPayload)])

        const repository = new EventRepository(db, batch)

        // Act
        const events = repository.getEvents('aggregate-payload')

        // Assert
        expect(events).toHaveLength(1)
        const payload = events[0]!.payload as typeof complexPayload
        expect(payload).toEqual(complexPayload)
        expect(payload.priorState.name).toBe('Old Name')
        expect(payload.newState.count).toBe(43)
        expect(payload.newState.items).toContain('d')
        expect(payload.newState.nested.deep).toBe(false)
      } finally {
        closeTestDatabase(db)
      }
    })

    test('only returns events for specified aggregate', () => {
      // Arrange
      const db = createTestDatabase()
      const batch = new TransactionBatch()

      try {
        const payload = { priorState: {}, newState: {} }
        const time = new Date().toISOString()

        // Insert events for different aggregates
        db.run(`
          INSERT INTO events (eventType, version, aggregateId, correlationId, occurredAt, userId, payload)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, ['event.a', 1, 'aggregate-A', 'corr-1', time, 'user-1', JSON.stringify(payload)])

        db.run(`
          INSERT INTO events (eventType, version, aggregateId, correlationId, occurredAt, userId, payload)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, ['event.b', 1, 'aggregate-B', 'corr-2', time, 'user-1', JSON.stringify(payload)])

        db.run(`
          INSERT INTO events (eventType, version, aggregateId, correlationId, occurredAt, userId, payload)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, ['event.a2', 2, 'aggregate-A', 'corr-3', time, 'user-1', JSON.stringify(payload)])

        const repository = new EventRepository(db, batch)

        // Act
        const eventsA = repository.getEvents('aggregate-A')
        const eventsB = repository.getEvents('aggregate-B')

        // Assert
        expect(eventsA).toHaveLength(2)
        expect(eventsB).toHaveLength(1)
        expect(eventsA.every(e => e.aggregateId === 'aggregate-A')).toBe(true)
        expect(eventsB[0]!.aggregateId).toBe('aggregate-B')
      } finally {
        closeTestDatabase(db)
      }
    })
  })
})

