import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { UnitOfWork } from '../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../src/infrastructure/transactionBatcher'
import { TransactionBatch } from '../../src/infrastructure/transactionBatch'
import { EventRepository, SnapshotRepository, OutboxRepository } from '../../src/infrastructure/repository'

describe('UnitOfWork', () => {
  let db: Database
  let batcher: TransactionBatcher

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
    db.run(`
      CREATE TABLE snapshots (
        aggregate_id TEXT PRIMARY KEY,
        correlation_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        payload TEXT NOT NULL
      )
    `)
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
    batcher = new TransactionBatcher(db, {
      flushIntervalMs: 10,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()
  })

  afterEach(() => {
    batcher.stop()
    db.close()
  })

  test('constructor properly initializes with Database and TransactionBatcher dependencies', () => {
    // Act
    const unitOfWork = new UnitOfWork(db, batcher)

    // Assert
    expect(unitOfWork).toBeDefined()
    expect(unitOfWork).toBeInstanceOf(UnitOfWork)
  })

  test('withTransaction creates a new TransactionBatch for each call', async () => {
    // Arrange
    const unitOfWork = new UnitOfWork(db, batcher)

    // Act - Create multiple transactions
    await unitOfWork.withTransaction(async ({ eventRepository }) => {
      // Access the batch through the repository's internal batch
      // We can verify uniqueness by checking that each transaction completes independently
      eventRepository.addEvent({
        event_type: 'TestEvent',
        version: 1,
        aggregate_id: `batch-test-${Date.now()}-${Math.random()}`,
        correlation_id: crypto.randomUUID(),
        occurred_at: Date.now(),
        payload: JSON.stringify({ test: true })
      })
    })

    await unitOfWork.withTransaction(async ({ eventRepository }) => {
      eventRepository.addEvent({
        event_type: 'TestEvent',
        version: 1,
        aggregate_id: `batch-test-${Date.now()}-${Math.random()}`,
        correlation_id: crypto.randomUUID(),
        occurred_at: Date.now(),
        payload: JSON.stringify({ test: true })
      })
    })

    // Assert - Both transactions should complete successfully
    const result = db.query('SELECT COUNT(*) as count FROM events').get() as { count: number }
    expect(result.count).toBe(2)
  })

  test('withTransaction creates EventRepository, SnapshotRepository, and OutboxRepository with the batch and database', async () => {
    // Arrange
    const unitOfWork = new UnitOfWork(db, batcher)
    let receivedEventRepository: EventRepository | null = null
    let receivedSnapshotRepository: SnapshotRepository | null = null
    let receivedOutboxRepository: OutboxRepository | null = null

    // Act
    await unitOfWork.withTransaction(async ({ eventRepository, snapshotRepository, outboxRepository }) => {
      receivedEventRepository = eventRepository
      receivedSnapshotRepository = snapshotRepository
      receivedOutboxRepository = outboxRepository
      expect(eventRepository).toBeInstanceOf(EventRepository)
      expect(snapshotRepository).toBeInstanceOf(SnapshotRepository)
      expect(outboxRepository).toBeInstanceOf(OutboxRepository)
    })

    // Assert
    expect(receivedEventRepository).not.toBeNull()
    expect(receivedSnapshotRepository).not.toBeNull()
    expect(receivedOutboxRepository).not.toBeNull()
  })

  test('withTransaction executes the work callback with all repositories', async () => {
    // Arrange
    const unitOfWork = new UnitOfWork(db, batcher)
    let callbackExecuted = false
    let receivedEventRepository: EventRepository | null = null
    let receivedSnapshotRepository: SnapshotRepository | null = null
    let receivedOutboxRepository: OutboxRepository | null = null

    // Act
    await unitOfWork.withTransaction(async ({ eventRepository, snapshotRepository, outboxRepository }) => {
      callbackExecuted = true
      receivedEventRepository = eventRepository
      receivedSnapshotRepository = snapshotRepository
      receivedOutboxRepository = outboxRepository
    })

    // Assert
    expect(callbackExecuted).toBe(true)
    expect(receivedEventRepository).not.toBeNull()
    expect(receivedEventRepository).toBeInstanceOf(EventRepository)
    expect(receivedSnapshotRepository).not.toBeNull()
    expect(receivedSnapshotRepository).toBeInstanceOf(SnapshotRepository)
    expect(receivedOutboxRepository).not.toBeNull()
    expect(receivedOutboxRepository).toBeInstanceOf(OutboxRepository)
  })

  test('withTransaction enqueues the batch via batcher.enqueueBatch', async () => {
    // Arrange
    const unitOfWork = new UnitOfWork(db, batcher)

    // Act
    await unitOfWork.withTransaction(async ({ eventRepository, snapshotRepository, outboxRepository }) => {
      eventRepository.addEvent({
        event_type: 'TestEvent',
        version: 1,
        aggregate_id: 'enqueue-test',
        correlation_id: crypto.randomUUID(),
        occurred_at: Date.now(),
        payload: JSON.stringify({ test: true })
      })
    })

    // Assert - Batch should have been enqueued and flushed
    // Since we're using a real batcher, we verify by checking the database
    const result = db.query('SELECT COUNT(*) as count FROM events').get() as { count: number }
    expect(result.count).toBe(1)
  })

  test('withTransaction waits for batch.promise to resolve before returning', async () => {
    // Arrange
    const unitOfWork = new UnitOfWork(db, batcher)
    const timeline: string[] = []

    // Act
    timeline.push('before-transaction')
    await unitOfWork.withTransaction(async ({ eventRepository, snapshotRepository, outboxRepository }) => {
      timeline.push('inside-callback')
      eventRepository.addEvent({
        event_type: 'TestEvent',
        version: 1,
        aggregate_id: 'wait-test',
        correlation_id: crypto.randomUUID(),
        occurred_at: Date.now(),
        payload: JSON.stringify({ test: true })
      })
      timeline.push('callback-complete')
    })
    timeline.push('after-transaction')

    // Assert - Transaction should wait for batch to flush
    expect(timeline).toEqual([
      'before-transaction',
      'inside-callback',
      'callback-complete',
      'after-transaction'
    ])

    // Verify data is actually in database (proving batch was flushed)
    const result = db.query('SELECT COUNT(*) as count FROM events').get() as { count: number }
    expect(result.count).toBe(1)
  })

  test('withTransaction rejects the batch and rethrows error when work callback throws', async () => {
    // Arrange
    const unitOfWork = new UnitOfWork(db, batcher)
    const testError = new Error('Test error')

    // Act & Assert
    await expect(
      unitOfWork.withTransaction(async ({ eventRepository, snapshotRepository, outboxRepository }) => {
        eventRepository.addEvent({
          event_type: 'TestEvent',
          version: 1,
          aggregate_id: 'error-test',
          correlation_id: crypto.randomUUID(),
          occurred_at: Date.now(),
          payload: JSON.stringify({ test: true })
        })
        throw testError
      })
    ).rejects.toThrow('Test error')

    // Assert - No events should be committed due to error
    const result = db.query('SELECT COUNT(*) as count FROM events').get() as { count: number }
    expect(result.count).toBe(0)
  })

  test('withTransaction handles non-Error exceptions by converting to Error', async () => {
    // Arrange
    const unitOfWork = new UnitOfWork(db, batcher)

    // Act & Assert - String exception
    await expect(
      unitOfWork.withTransaction(async ({ eventRepository, snapshotRepository, outboxRepository }) => {
        throw 'String error'
      })
    ).rejects.toThrow()

    // Act & Assert - Number exception
    await expect(
      unitOfWork.withTransaction(async ({ eventRepository, snapshotRepository, outboxRepository }) => {
        throw 123
      })
    ).rejects.toThrow()

    // Act & Assert - Object exception
    await expect(
      unitOfWork.withTransaction(async ({ eventRepository, snapshotRepository, outboxRepository }) => {
        throw { message: 'Object error' }
      })
    ).rejects.toThrow()
  })

  test('multiple concurrent withTransaction calls create separate batches', async () => {
    // Arrange
    const unitOfWork = new UnitOfWork(db, batcher)

    // Act - Create multiple concurrent transactions
    const promises = []
    for (let i = 0; i < 5; i++) {
      const promise = unitOfWork.withTransaction(async ({ eventRepository, snapshotRepository, outboxRepository }) => {
        eventRepository.addEvent({
          event_type: 'TestEvent',
          version: 1,
          aggregate_id: `concurrent-${i}`,
          correlation_id: crypto.randomUUID(),
          occurred_at: Date.now(),
          payload: JSON.stringify({ index: i })
        })
      })
      promises.push(promise)
    }

    await Promise.all(promises)

    // Assert - All transactions should complete successfully
    const result = db.query('SELECT COUNT(*) as count FROM events').get() as { count: number }
    expect(result.count).toBe(5)

    // Verify all events have unique aggregate_ids
    const events = db.query('SELECT aggregate_id FROM events').all() as { aggregate_id: string }[]
    const aggregateIds = events.map(e => e.aggregate_id)
    const uniqueIds = new Set(aggregateIds)
    expect(uniqueIds.size).toBe(5)
  })

  test('withTransaction properly handles repository operations', async () => {
    // Arrange
    const unitOfWork = new UnitOfWork(db, batcher)

    // Act
    await unitOfWork.withTransaction(async ({ eventRepository, snapshotRepository, outboxRepository }) => {
      eventRepository.addEvent({
        event_type: 'ProductCreated',
        version: 1,
        aggregate_id: 'product-1',
        correlation_id: 'corr-1',
        occurred_at: Date.now(),
        payload: JSON.stringify({ name: 'Product 1' })
      })

      eventRepository.addEvent({
        event_type: 'ProductUpdated',
        version: 2,
        aggregate_id: 'product-1',
        correlation_id: 'corr-2',
        occurred_at: Date.now(),
        payload: JSON.stringify({ name: 'Product 1 Updated' })
      })
    })

    // Assert - Both events should be committed
    const result = db.query('SELECT COUNT(*) as count FROM events').get() as { count: number }
    expect(result.count).toBe(2)

    const events = db.query('SELECT event_type, version FROM events ORDER BY version').all() as {
      event_type: string
      version: number
    }[]
    expect(events[0]!.event_type).toBe('ProductCreated')
    expect(events[0]!.version).toBe(1)
    expect(events[1]!.event_type).toBe('ProductUpdated')
    expect(events[1]!.version).toBe(2)
  })

  test('withTransaction allows using all repositories together in atomic transaction', async () => {
    // Arrange
    const unitOfWork = new UnitOfWork(db, batcher)
    const aggregateId = 'product-123'
    const correlationId = 'corr-456'
    const outboxId = crypto.randomUUID()

    // Act
    await unitOfWork.withTransaction(async ({ eventRepository, snapshotRepository, outboxRepository }) => {
      // Add an event
      eventRepository.addEvent({
        event_type: 'ProductCreated',
        version: 1,
        aggregate_id: aggregateId,
        correlation_id: correlationId,
        occurred_at: Date.now(),
        payload: JSON.stringify({ name: 'Test Product' })
      })

      // Save a snapshot
      snapshotRepository.saveSnapshot({
        aggregate_id: aggregateId,
        correlation_id: correlationId,
        version: 1,
        payload: JSON.stringify({ state: 'created' })
      })

      // Add an outbox event
      outboxRepository.addOutboxEvent({
        id: outboxId,
        aggregate_id: aggregateId,
        event_type: 'ProductCreated',
        payload: JSON.stringify({ name: 'Test Product' })
      })
    })

    // Assert - All operations should be committed atomically
    const eventResult = db.query('SELECT COUNT(*) as count FROM events').get() as { count: number }
    expect(eventResult.count).toBe(1)

    const snapshotResult = db.query('SELECT COUNT(*) as count FROM snapshots').get() as { count: number }
    expect(snapshotResult.count).toBe(1)

    const outboxResult = db.query('SELECT COUNT(*) as count FROM outbox').get() as { count: number }
    expect(outboxResult.count).toBe(1)

    // Verify snapshot data
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(aggregateId) as any
    expect(snapshot).toBeDefined()
    expect(snapshot.aggregate_id).toBe(aggregateId)
    expect(snapshot.version).toBe(1)

    // Verify outbox data
    const outbox = db.query('SELECT * FROM outbox WHERE id = ?').get(outboxId) as any
    expect(outbox).toBeDefined()
    expect(outbox.id).toBe(outboxId)
    expect(outbox.aggregate_id).toBe(aggregateId)
    expect(outbox.status).toBe('pending')
  })

  test('withTransaction rolls back all repository operations when error occurs', async () => {
    // Arrange
    const unitOfWork = new UnitOfWork(db, batcher)
    const aggregateId = 'product-456'
    const correlationId = 'corr-789'
    const outboxId = crypto.randomUUID()

    // Act & Assert
    await expect(
      unitOfWork.withTransaction(async ({ eventRepository, snapshotRepository, outboxRepository }) => {
        // Add an event
        eventRepository.addEvent({
          event_type: 'ProductCreated',
          version: 1,
          aggregate_id: aggregateId,
          correlation_id: correlationId,
          occurred_at: Date.now(),
          payload: JSON.stringify({ name: 'Test Product' })
        })

        // Save a snapshot
        snapshotRepository.saveSnapshot({
          aggregate_id: aggregateId,
          correlation_id: correlationId,
          version: 1,
          payload: JSON.stringify({ state: 'created' })
        })

        // Add an outbox event
        outboxRepository.addOutboxEvent({
          id: outboxId,
          aggregate_id: aggregateId,
          event_type: 'ProductCreated',
          payload: JSON.stringify({ name: 'Test Product' })
        })

        // Throw error - should rollback everything
        throw new Error('Transaction failed')
      })
    ).rejects.toThrow('Transaction failed')

    // Assert - Nothing should be committed due to error
    const eventResult = db.query('SELECT COUNT(*) as count FROM events').get() as { count: number }
    expect(eventResult.count).toBe(0)

    const snapshotResult = db.query('SELECT COUNT(*) as count FROM snapshots').get() as { count: number }
    expect(snapshotResult.count).toBe(0)

    const outboxResult = db.query('SELECT COUNT(*) as count FROM outbox').get() as { count: number }
    expect(outboxResult.count).toBe(0)
  })
})

