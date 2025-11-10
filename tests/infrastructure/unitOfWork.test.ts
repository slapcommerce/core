import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { UnitOfWork } from '../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../src/infrastructure/transactionBatcher'
import { TransactionBatch } from '../../src/infrastructure/transactionBatch'
import { EventRepository } from '../../src/infrastructure/repository'

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

  test('withTransaction creates EventRepository with the batch and database', async () => {
    // Arrange
    const unitOfWork = new UnitOfWork(db, batcher)
    let receivedRepository: EventRepository | null = null

    // Act
    await unitOfWork.withTransaction(async ({ eventRepository }) => {
      receivedRepository = eventRepository
      expect(eventRepository).toBeInstanceOf(EventRepository)
    })

    // Assert
    expect(receivedRepository).not.toBeNull()
  })

  test('withTransaction executes the work callback with the repository', async () => {
    // Arrange
    const unitOfWork = new UnitOfWork(db, batcher)
    let callbackExecuted = false
    let receivedRepository: EventRepository | null = null

    // Act
    await unitOfWork.withTransaction(async ({ eventRepository }) => {
      callbackExecuted = true
      receivedRepository = eventRepository
    })

    // Assert
    expect(callbackExecuted).toBe(true)
    expect(receivedRepository).not.toBeNull()
    expect(receivedRepository).toBeInstanceOf(EventRepository)
  })

  test('withTransaction enqueues the batch via batcher.enqueueBatch', async () => {
    // Arrange
    const unitOfWork = new UnitOfWork(db, batcher)

    // Act
    await unitOfWork.withTransaction(async ({ eventRepository }) => {
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
    await unitOfWork.withTransaction(async ({ eventRepository }) => {
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
      unitOfWork.withTransaction(async ({ eventRepository }) => {
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
      unitOfWork.withTransaction(async () => {
        throw 'String error'
      })
    ).rejects.toThrow()

    // Act & Assert - Number exception
    await expect(
      unitOfWork.withTransaction(async () => {
        throw 123
      })
    ).rejects.toThrow()

    // Act & Assert - Object exception
    await expect(
      unitOfWork.withTransaction(async () => {
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
      const promise = unitOfWork.withTransaction(async ({ eventRepository }) => {
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
    await unitOfWork.withTransaction(async ({ eventRepository }) => {
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
})

