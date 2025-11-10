import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { EventRepository } from '../../src/infrastructure/repository'
import { TransactionBatch } from '../../src/infrastructure/transactionBatch'

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
    const event = {
      event_type: 'TestEvent',
      version: 1,
      aggregate_id: 'test-aggregate',
      correlation_id: 'test-correlation',
      occurred_at: Date.now(),
      payload: JSON.stringify({ test: true })
    }

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
    const event = {
      event_type: 'ProductCreated',
      version: 2,
      aggregate_id: 'product-123',
      correlation_id: 'corr-456',
      occurred_at: 1234567890,
      payload: JSON.stringify({ name: 'Test Product' })
    }

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
      1234567890,
      JSON.stringify({ name: 'Test Product' })
    ])
  })

  test('addEvent sets command type to insert', () => {
    // Arrange
    const repository = new EventRepository(db, batch)
    const event = {
      event_type: 'TestEvent',
      version: 1,
      aggregate_id: 'test-aggregate',
      correlation_id: 'test-correlation',
      occurred_at: Date.now(),
      payload: JSON.stringify({ test: true })
    }

    // Act
    repository.addEvent(event)

    // Assert
    expect(batch.commands[0]!.type).toBe('insert')
  })

  test('multiple events can be added sequentially', () => {
    // Arrange
    const repository = new EventRepository(db, batch)

    // Act
    repository.addEvent({
      event_type: 'Event1',
      version: 1,
      aggregate_id: 'agg-1',
      correlation_id: 'corr-1',
      occurred_at: Date.now(),
      payload: JSON.stringify({ event: 1 })
    })

    repository.addEvent({
      event_type: 'Event2',
      version: 2,
      aggregate_id: 'agg-2',
      correlation_id: 'corr-2',
      occurred_at: Date.now(),
      payload: JSON.stringify({ event: 2 })
    })

    repository.addEvent({
      event_type: 'Event3',
      version: 3,
      aggregate_id: 'agg-3',
      correlation_id: 'corr-3',
      occurred_at: Date.now(),
      payload: JSON.stringify({ event: 3 })
    })

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
    const occurredAt = 9876543210
    const payload = JSON.stringify({ orderId: '789', total: 99.99 })

    const event = {
      event_type: eventType,
      version,
      aggregate_id: aggregateId,
      correlation_id: correlationId,
      occurred_at: occurredAt,
      payload
    }

    // Act
    repository.addEvent(event)

    // Assert
    const command = batch.commands[0]!
    expect(command.params[0]).toBe(eventType)
    expect(command.params[1]).toBe(version)
    expect(command.params[2]).toBe(aggregateId)
    expect(command.params[3]).toBe(correlationId)
    expect(command.params[4]).toBe(occurredAt)
    expect(command.params[5]).toBe(payload)
  })
})

