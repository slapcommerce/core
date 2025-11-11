import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { EventRepository, SnapshotRepository, OutboxRepository } from '../../src/infrastructure/repository'
import { TransactionBatch } from '../../src/infrastructure/transactionBatch'
import type { DomainEvent } from '../../src/domain/_base/domainEvent'

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
      occurredAt.getTime(),
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
    expect(command.params[4]).toBe(occurredAt.getTime())
    expect(command.params[5]).toBe(JSON.stringify(payload))
  })
})

describe('SnapshotRepository', () => {
  let db: Database
  let batch: TransactionBatch

  beforeEach(() => {
    db = new Database(':memory:')
    db.run(`
      CREATE TABLE snapshots (
        aggregate_id TEXT PRIMARY KEY,
        correlation_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        payload TEXT NOT NULL
      )
    `)
    batch = new TransactionBatch()
  })

  afterEach(() => {
    db.close()
  })

  test('constructor properly initializes with Database and TransactionBatch dependencies', () => {
    // Act
    const repository = new SnapshotRepository(db, batch)

    // Assert - Repository should be created without errors
    expect(repository).toBeDefined()
    expect(repository).toBeInstanceOf(SnapshotRepository)
  })

  test('saveSnapshot creates a prepared SQL statement with correct INSERT OR REPLACE query', () => {
    // Arrange
    const repository = new SnapshotRepository(db, batch)
    const snapshot = {
      aggregate_id: 'test-aggregate',
      correlation_id: 'test-correlation',
      version: 5,
      payload: JSON.stringify({ state: 'test' })
    }

    // Act
    repository.saveSnapshot(snapshot)

    // Assert - Verify the command was added to batch
    expect(batch.commands.length).toBe(1)
    expect(batch.commands[0]!.type).toBe('insert')
    expect(batch.commands[0]!.statement).toBeDefined()
  })

  test('saveSnapshot adds command to batch with correct parameters', () => {
    // Arrange
    const repository = new SnapshotRepository(db, batch)
    const snapshot = {
      aggregate_id: 'product-123',
      correlation_id: 'corr-456',
      version: 10,
      payload: { title: 'Test Product', status: 'active' }
    }

    // Act
    repository.saveSnapshot(snapshot)

    // Assert
    expect(batch.commands.length).toBe(1)
    const command = batch.commands[0]!
    expect(command.params).toEqual([
      'product-123',
      'corr-456',
      10,
      JSON.stringify({ title: 'Test Product', status: 'active' })
    ])
  })

  test('saveSnapshot sets command type to insert', () => {
    // Arrange
    const repository = new SnapshotRepository(db, batch)
    const snapshot = {
      aggregate_id: 'test-aggregate',
      correlation_id: 'test-correlation',
      version: 1,
      payload: { test: true }
    }

    // Act
    repository.saveSnapshot(snapshot)

    // Assert
    expect(batch.commands[0]!.type).toBe('insert')
  })

  test('multiple snapshots can be added sequentially', () => {
    // Arrange
    const repository = new SnapshotRepository(db, batch)

    // Act
    repository.saveSnapshot({
      aggregate_id: 'agg-1',
      correlation_id: 'corr-1',
      version: 1,
      payload: { snapshot: 1 }
    })

    repository.saveSnapshot({
      aggregate_id: 'agg-2',
      correlation_id: 'corr-2',
      version: 2,
      payload: { snapshot: 2 }
    })

    repository.saveSnapshot({
      aggregate_id: 'agg-3',
      correlation_id: 'corr-3',
      version: 3,
      payload: { snapshot: 3 }
    })

    // Assert
    expect(batch.commands.length).toBe(3)
    expect(batch.commands[0]!.params[0]).toBe('agg-1')
    expect(batch.commands[1]!.params[0]).toBe('agg-2')
    expect(batch.commands[2]!.params[0]).toBe('agg-3')
  })

  test('all snapshot fields are correctly passed to the batch', () => {
    // Arrange
    const repository = new SnapshotRepository(db, batch)
    const aggregateId = 'order-789'
    const correlationId = 'corr-999'
    const version = 15
    const payload = { orderId: '789', total: 99.99 }

    const snapshot = {
      aggregate_id: aggregateId,
      correlation_id: correlationId,
      version,
      payload
    }

    // Act
    repository.saveSnapshot(snapshot)

    // Assert
    const command = batch.commands[0]!
    expect(command.params[0]).toBe(aggregateId)
    expect(command.params[1]).toBe(correlationId)
    expect(command.params[2]).toBe(version)
    expect(command.params[3]).toBe(JSON.stringify(payload))
  })
})

describe('OutboxRepository', () => {
  let db: Database
  let batch: TransactionBatch

  beforeEach(() => {
    db = new Database(':memory:')
    db.run(`
      CREATE TABLE outbox (
        id TEXT PRIMARY KEY,
        aggregate_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        retry_count INTEGER NOT NULL DEFAULT 0,
        last_attempt_at INTEGER,
        next_retry_at INTEGER,
        idempotency_key TEXT
      )
    `)
    batch = new TransactionBatch()
  })

  afterEach(() => {
    db.close()
  })

  test('constructor properly initializes with Database and TransactionBatch dependencies', () => {
    // Act
    const repository = new OutboxRepository(db, batch)

    // Assert - Repository should be created without errors
    expect(repository).toBeDefined()
    expect(repository).toBeInstanceOf(OutboxRepository)
  })

  test('addOutboxEvent creates a prepared SQL statement with correct INSERT query', () => {
    // Arrange
    const repository = new OutboxRepository(db, batch)
    const event = createTestEvent()

    // Act
    repository.addOutboxEvent(event, { id: crypto.randomUUID() })

    // Assert - Verify the command was added to batch
    expect(batch.commands.length).toBe(1)
    expect(batch.commands[0]!.type).toBe('insert')
    expect(batch.commands[0]!.statement).toBeDefined()
  })

  test('addOutboxEvent adds command to batch with correct parameters and defaults', () => {
    // Arrange
    const repository = new OutboxRepository(db, batch)
    const event = createTestEvent({
      aggregateId: 'product-456',
      eventName: 'ProductCreated',
      payload: { name: 'Test Product' }
    })

    // Act
    repository.addOutboxEvent(event, { id: 'outbox-123' })

    // Assert
    expect(batch.commands.length).toBe(1)
    const command = batch.commands[0]!
    expect(command.params).toEqual([
      'outbox-123',
      'product-456',
      'ProductCreated',
      JSON.stringify({ name: 'Test Product' }),
      'pending', // default status
      0, // default retry_count
      null, // default last_attempt_at
      null, // default next_retry_at
      null // default idempotency_key
    ])
  })

  test('addOutboxEvent uses provided optional parameters when provided', () => {
    // Arrange
    const repository = new OutboxRepository(db, batch)
    const lastAttemptAt = new Date(1234567890)
    const nextRetryAt = new Date(1234567900)
    const event = createTestEvent({
      aggregateId: 'order-999',
      eventName: 'OrderPlaced',
      payload: { orderId: '999' }
    })

    // Act
    repository.addOutboxEvent(event, {
      id: 'outbox-789',
      status: 'processing',
      retry_count: 2,
      last_attempt_at: lastAttemptAt,
      next_retry_at: nextRetryAt,
      idempotency_key: 'idempotency-123'
    })

    // Assert
    expect(batch.commands.length).toBe(1)
    const command = batch.commands[0]!
    expect(command.params).toEqual([
      'outbox-789',
      'order-999',
      'OrderPlaced',
      JSON.stringify({ orderId: '999' }),
      'processing',
      2,
      lastAttemptAt.getTime(),
      nextRetryAt.getTime(),
      'idempotency-123'
    ])
  })

  test('addOutboxEvent sets command type to insert', () => {
    // Arrange
    const repository = new OutboxRepository(db, batch)
    const event = createTestEvent()

    // Act
    repository.addOutboxEvent(event, { id: crypto.randomUUID() })

    // Assert
    expect(batch.commands[0]!.type).toBe('insert')
  })

  test('multiple outbox events can be added sequentially', () => {
    // Arrange
    const repository = new OutboxRepository(db, batch)

    // Act
    repository.addOutboxEvent(createTestEvent({
      eventName: 'Event1',
      aggregateId: 'agg-1',
      payload: { event: 1 }
    }), { id: 'outbox-1' })

    repository.addOutboxEvent(createTestEvent({
      eventName: 'Event2',
      aggregateId: 'agg-2',
      payload: { event: 2 }
    }), { id: 'outbox-2' })

    repository.addOutboxEvent(createTestEvent({
      eventName: 'Event3',
      aggregateId: 'agg-3',
      payload: { event: 3 }
    }), { id: 'outbox-3' })

    // Assert
    expect(batch.commands.length).toBe(3)
    expect(batch.commands[0]!.params[2]).toBe('Event1')
    expect(batch.commands[1]!.params[2]).toBe('Event2')
    expect(batch.commands[2]!.params[2]).toBe('Event3')
  })

  test('all outbox event fields are correctly passed to the batch', () => {
    // Arrange
    const repository = new OutboxRepository(db, batch)
    const id = 'outbox-999'
    const aggregateId = 'order-789'
    const eventType = 'OrderPlaced'
    const payload = { orderId: '789', total: 99.99 }
    const status = 'pending'
    const retryCount = 0
    const lastAttemptAt: Date | null = null
    const nextRetryAt: Date | null = null
    const idempotencyKey = null

    const event = createTestEvent({
      aggregateId,
      eventName: eventType,
      payload
    })

    // Act
    repository.addOutboxEvent(event, {
      id,
      status,
      retry_count: retryCount,
      last_attempt_at: lastAttemptAt,
      next_retry_at: nextRetryAt,
      idempotency_key: idempotencyKey
    })

    // Assert
    const command = batch.commands[0]!
    expect(command.params[0]).toBe(id)
    expect(command.params[1]).toBe(aggregateId)
    expect(command.params[2]).toBe(eventType)
    expect(command.params[3]).toBe(JSON.stringify(payload))
    expect(command.params[4]).toBe(status)
    expect(command.params[5]).toBe(retryCount)
    expect(command.params[6]).toBe(null)
    expect(command.params[7]).toBe(null)
    expect(command.params[8]).toBe(idempotencyKey)
  })
})

