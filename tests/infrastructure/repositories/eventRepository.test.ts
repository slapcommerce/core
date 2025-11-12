import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { EventRepository } from '../../../src/infrastructure/repositories/eventRepository'
import { TransactionBatch } from '../../../src/infrastructure/transactionBatch'
import type { DomainEvent } from '../../../src/domain/_base/domainEvent'

// Helper to create test domain events
function createTestEvent(overrides?: Partial<DomainEvent<string, Record<string, unknown>>>): DomainEvent<string, Record<string, unknown>> {
  return {
    eventName: overrides?.eventName ?? 'TestEvent',
    version: overrides?.version ?? 1,
    aggregateId: overrides?.aggregateId ?? 'test-aggregate',
    correlationId: overrides?.correlationId ?? 'test-correlation',
    occurredAt: overrides?.occurredAt ?? new Date(),
    payload: overrides?.payload ?? { test: true }
  }
}

describe('EventRepository', () => {
  let db: Database
  let batch: TransactionBatch

  beforeEach(() => {
    db = new Database(':memory:')
    db.run(`
      CREATE TABLE events (
        event_type TEXT NOT NULL,
        version INTEGER NOT NULL,
        aggregate_id TEXT NOT NULL,
        correlation_id TEXT NOT NULL,
        occurred_at INTEGER NOT NULL,
        payload TEXT NOT NULL,
        PRIMARY KEY (aggregate_id, version)
      )
    `)
    batch = new TransactionBatch()
  })

  afterEach(() => {
    db.close()
  })

  test('constructor properly initializes with Database and TransactionBatch dependencies', () => {
    // Act
    const repository = new EventRepository(db, batch)

    // Assert - Repository should be created without errors
    expect(repository).toBeDefined()
    expect(repository).toBeInstanceOf(EventRepository)
  })

  test('addEvent creates a prepared SQL statement with correct INSERT query', () => {
    // Arrange
    const repository = new EventRepository(db, batch)
    const event = createTestEvent()

    // Act
    repository.addEvent(event)

    // Assert - Verify the command was added to batch
    expect(batch.commands.length).toBe(1)
    expect(batch.commands[0]!.type).toBe('insert')
    expect(batch.commands[0]!.statement).toBeDefined()
  })

  test('addEvent adds command to batch with correct parameters', () => {
    // Arrange
    const repository = new EventRepository(db, batch)
    const occurredAt = new Date(1234567890)
    const event = createTestEvent({
      eventName: 'ProductCreated',
      version: 2,
      aggregateId: 'product-123',
      correlationId: 'corr-456',
      occurredAt,
      payload: { name: 'Test Product' }
    })

    // Act
    repository.addEvent(event)

    // Assert
    expect(batch.commands.length).toBe(1)
    const command = batch.commands[0]!
    expect(command.params).toEqual([
      'ProductCreated',
      2,
      'product-123',
      'corr-456',
      occurredAt.toISOString(),
      JSON.stringify({ name: 'Test Product' })
    ])
  })

  test('addEvent sets command type to insert', () => {
    // Arrange
    const repository = new EventRepository(db, batch)
    const event = createTestEvent()

    // Act
    repository.addEvent(event)

    // Assert
    expect(batch.commands[0]!.type).toBe('insert')
  })

  test('multiple events can be added sequentially', () => {
    // Arrange
    const repository = new EventRepository(db, batch)

    // Act
    repository.addEvent(createTestEvent({
      eventName: 'Event1',
      aggregateId: 'agg-1',
      correlationId: 'corr-1',
      payload: { event: 1 }
    }))

    repository.addEvent(createTestEvent({
      eventName: 'Event2',
      version: 2,
      aggregateId: 'agg-2',
      correlationId: 'corr-2',
      payload: { event: 2 }
    }))

    repository.addEvent(createTestEvent({
      eventName: 'Event3',
      version: 3,
      aggregateId: 'agg-3',
      correlationId: 'corr-3',
      payload: { event: 3 }
    }))

    // Assert
    expect(batch.commands.length).toBe(3)
    expect(batch.commands[0]!.params[0]).toBe('Event1')
    expect(batch.commands[1]!.params[0]).toBe('Event2')
    expect(batch.commands[2]!.params[0]).toBe('Event3')
  })

  test('all event fields are correctly passed to the batch', () => {
    // Arrange
    const repository = new EventRepository(db, batch)
    const eventType = 'OrderPlaced'
    const version = 5
    const aggregateId = 'order-789'
    const correlationId = 'corr-999'
    const occurredAt = new Date(9876543210)
    const payload = { orderId: '789', total: 99.99 }

    const event = createTestEvent({
      eventName: eventType,
      version,
      aggregateId,
      correlationId,
      occurredAt,
      payload
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
    expect(command.params[5]).toBe(JSON.stringify(payload))
  })
})

