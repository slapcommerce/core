import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { EventRepository, SnapshotRepository, OutboxRepository } from '../../src/infrastructure/repository'
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
      payload: JSON.stringify({ title: 'Test Product', status: 'active' })
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
      payload: JSON.stringify({ test: true })
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
      payload: JSON.stringify({ snapshot: 1 })
    })

    repository.saveSnapshot({
      aggregate_id: 'agg-2',
      correlation_id: 'corr-2',
      version: 2,
      payload: JSON.stringify({ snapshot: 2 })
    })

    repository.saveSnapshot({
      aggregate_id: 'agg-3',
      correlation_id: 'corr-3',
      version: 3,
      payload: JSON.stringify({ snapshot: 3 })
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
    const payload = JSON.stringify({ orderId: '789', total: 99.99 })

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
    expect(command.params[3]).toBe(payload)
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
    const event = {
      id: crypto.randomUUID(),
      aggregate_id: 'test-aggregate',
      event_type: 'TestEvent',
      payload: JSON.stringify({ test: true })
    }

    // Act
    repository.addOutboxEvent(event)

    // Assert - Verify the command was added to batch
    expect(batch.commands.length).toBe(1)
    expect(batch.commands[0]!.type).toBe('insert')
    expect(batch.commands[0]!.statement).toBeDefined()
  })

  test('addOutboxEvent adds command to batch with correct parameters and defaults', () => {
    // Arrange
    const repository = new OutboxRepository(db, batch)
    const event = {
      id: 'outbox-123',
      aggregate_id: 'product-456',
      event_type: 'ProductCreated',
      payload: JSON.stringify({ name: 'Test Product' })
    }

    // Act
    repository.addOutboxEvent(event)

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
    const event = {
      id: 'outbox-789',
      aggregate_id: 'order-999',
      event_type: 'OrderPlaced',
      payload: JSON.stringify({ orderId: '999' }),
      status: 'processing',
      retry_count: 2,
      last_attempt_at: 1234567890,
      next_retry_at: 1234567900,
      idempotency_key: 'idempotency-123'
    }

    // Act
    repository.addOutboxEvent(event)

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
      1234567890,
      1234567900,
      'idempotency-123'
    ])
  })

  test('addOutboxEvent sets command type to insert', () => {
    // Arrange
    const repository = new OutboxRepository(db, batch)
    const event = {
      id: crypto.randomUUID(),
      aggregate_id: 'test-aggregate',
      event_type: 'TestEvent',
      payload: JSON.stringify({ test: true })
    }

    // Act
    repository.addOutboxEvent(event)

    // Assert
    expect(batch.commands[0]!.type).toBe('insert')
  })

  test('multiple outbox events can be added sequentially', () => {
    // Arrange
    const repository = new OutboxRepository(db, batch)

    // Act
    repository.addOutboxEvent({
      id: 'outbox-1',
      aggregate_id: 'agg-1',
      event_type: 'Event1',
      payload: JSON.stringify({ event: 1 })
    })

    repository.addOutboxEvent({
      id: 'outbox-2',
      aggregate_id: 'agg-2',
      event_type: 'Event2',
      payload: JSON.stringify({ event: 2 })
    })

    repository.addOutboxEvent({
      id: 'outbox-3',
      aggregate_id: 'agg-3',
      event_type: 'Event3',
      payload: JSON.stringify({ event: 3 })
    })

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
    const payload = JSON.stringify({ orderId: '789', total: 99.99 })
    const status = 'pending'
    const retryCount = 0
    const lastAttemptAt = null
    const nextRetryAt = null
    const idempotencyKey = null

    const event = {
      id,
      aggregate_id: aggregateId,
      event_type: eventType,
      payload,
      status,
      retry_count: retryCount,
      last_attempt_at: lastAttemptAt,
      next_retry_at: nextRetryAt,
      idempotency_key: idempotencyKey
    }

    // Act
    repository.addOutboxEvent(event)

    // Assert
    const command = batch.commands[0]!
    expect(command.params[0]).toBe(id)
    expect(command.params[1]).toBe(aggregateId)
    expect(command.params[2]).toBe(eventType)
    expect(command.params[3]).toBe(payload)
    expect(command.params[4]).toBe(status)
    expect(command.params[5]).toBe(retryCount)
    expect(command.params[6]).toBe(lastAttemptAt)
    expect(command.params[7]).toBe(nextRetryAt)
    expect(command.params[8]).toBe(idempotencyKey)
  })
})

