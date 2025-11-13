import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { TransactionBatcher } from '../../src/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../src/infrastructure/unitOfWork'
import type { DomainEvent } from '../../src/domain/_base/domainEvent'
import { createTestDatabase, closeTestDatabase } from '../helpers/database'

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

describe('TransactionBatcher', () => {
  test('should batch and flush multiple concurrent transactions', async () => {
    // Arrange
    const db = createTestDatabase()
    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    try {
      const unitOfWork = new UnitOfWork(db, batcher)

      // Act - Create multiple concurrent transactions
      const promises = []
      for (let i = 0; i < 5; i++) {
        const promise = unitOfWork.withTransaction(async ({ eventRepository }) => {
          eventRepository.addEvent(createTestEvent({
            aggregateId: `aggregate-${i}`,
            correlationId: crypto.randomUUID()
          }))
        })
        promises.push(promise)
      }

      await Promise.all(promises)

      // Assert - Verify all events were inserted
      const result = db.query('SELECT COUNT(*) as count FROM events').get() as { count: number }
      expect(result.count).toBe(5)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should flush when size threshold is reached', async () => {
    // Arrange
    const db = createTestDatabase()
    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 10000, // Very long interval - should NOT trigger
      batchSizeThreshold: 3,  // Small threshold - should trigger
      maxQueueDepth: 100
    })
    batcher.start()

    try {
      const unitOfWork = new UnitOfWork(db, batcher)

      // Act - Create exactly 3 transactions to trigger size-based flush
      const startTime = Date.now()
      const promises = []
      for (let i = 0; i < 3; i++) {
        const promise = unitOfWork.withTransaction(async ({ eventRepository }) => {
          eventRepository.addEvent(createTestEvent({
            aggregateId: `size-test-${i}`,
            correlationId: crypto.randomUUID()
          }))
        })
        promises.push(promise)
      }

      await Promise.all(promises)
      const endTime = Date.now()
      const elapsedTime = endTime - startTime

      // Assert - Should flush immediately due to size threshold, NOT after time interval
      expect(elapsedTime).toBeLessThan(100) // Should be very fast, not 10 seconds

      const result = db.query('SELECT COUNT(*) as count FROM events').get() as { count: number }
      expect(result.count).toBe(3)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should isolate failing transactions', async () => {
    // Arrange
    const db = createTestDatabase()
    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    try {
      const unitOfWork = new UnitOfWork(db, batcher)

      // Act - Create transactions, including one that will fail due to duplicate key
      const aggregateId = `duplicate-test-${Date.now()}`

      const successPromise1 = unitOfWork.withTransaction(async ({ eventRepository }) => {
        eventRepository.addEvent(createTestEvent({
          aggregateId: `success-1-${Date.now()}`,
          correlationId: crypto.randomUUID()
        }))
      })

      const failPromise = unitOfWork.withTransaction(async ({ eventRepository }) => {
        // Add the same event twice - will fail on duplicate primary key
        eventRepository.addEvent(createTestEvent({
          aggregateId: aggregateId,
          correlationId: crypto.randomUUID()
        }))
        eventRepository.addEvent(createTestEvent({
          version: 1, // Same version and aggregate_id - will fail
          aggregateId: aggregateId,
          correlationId: crypto.randomUUID()
        }))
      })

      const successPromise2 = unitOfWork.withTransaction(async ({ eventRepository }) => {
        eventRepository.addEvent(createTestEvent({
          aggregateId: `success-2-${Date.now()}`,
          correlationId: crypto.randomUUID()
        }))
      })

      // Assert - Failing transaction should be isolated
      const results = await Promise.allSettled([failPromise, successPromise1, successPromise2])

      expect(results[0].status).toBe('rejected') // failPromise should reject
      expect(results[1].status).toBe('fulfilled') // successPromise1 should resolve
      expect(results[2].status).toBe('fulfilled') // successPromise2 should resolve

      // Verify successful transactions were committed
      const result = db.query('SELECT COUNT(*) as count FROM events').get() as { count: number }
      expect(result.count).toBe(2) // Only the 2 successful transactions
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should respect max queue depth', async () => {
    // Arrange
    const db = createTestDatabase()
    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 100, // Reasonable interval
      batchSizeThreshold: 1000, // High threshold
      maxQueueDepth: 2 // Small queue
    })
    batcher.start()

    try {
      const unitOfWork = new UnitOfWork(db, batcher)

      // Act - Try to enqueue more transactions than max depth
      const promises = []
      for (let i = 0; i < 5; i++) {
        const promise = unitOfWork.withTransaction(async ({ eventRepository }) => {
          eventRepository.addEvent(createTestEvent({
            aggregateId: `queue-test-${i}`,
            correlationId: crypto.randomUUID()
          }))
        })
        promises.push(promise)
      }

      // Assert - Some transactions should fail due to queue depth
      const results = await Promise.allSettled(promises)
      const rejected = results.filter(r => r.status === 'rejected')
      expect(rejected.length).toBeGreaterThan(0)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should block withTransaction until flush completes', async () => {
    // Arrange
    const db = createTestDatabase()
    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 100, // Will flush after 100ms
      batchSizeThreshold: 1000,
      maxQueueDepth: 100
    })
    batcher.start()

    try {
      const unitOfWork = new UnitOfWork(db, batcher)
      const timeline: string[] = []

      // Act - Start a transaction and track when it completes
      const startTime = Date.now()
      timeline.push('start-transaction')

      const transactionPromise = unitOfWork.withTransaction(async ({ eventRepository }) => {
        timeline.push('inside-callback')
        eventRepository.addEvent(createTestEvent({
          aggregateId: `blocking-test-${Date.now()}`,
          correlationId: crypto.randomUUID()
        }))
        timeline.push('callback-done')
      })

      // withTransaction should not resolve immediately
      timeline.push('transaction-enqueued')

      await transactionPromise
      const endTime = Date.now()
      timeline.push('transaction-completed')

      // Assert - Transaction should not complete until after flush interval
      expect(endTime - startTime).toBeGreaterThanOrEqual(50) // Should wait for flush

      // Verify the event was actually written to the database
      const result = db.query('SELECT COUNT(*) as count FROM events').get() as { count: number }
      expect(result.count).toBe(1)

      // Verify execution order
      expect(timeline).toEqual([
        'start-transaction',
        'inside-callback',
        'callback-done',
        'transaction-enqueued',
        'transaction-completed'
      ])
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should not return from withTransaction until data is in database', async () => {
    // Arrange
    const db = createTestDatabase()
    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    try {
      const unitOfWork = new UnitOfWork(db, batcher)
      const aggregateId = `durability-test-${Date.now()}`

      // Act - Write data via withTransaction
      await unitOfWork.withTransaction(async ({ eventRepository }) => {
        eventRepository.addEvent(createTestEvent({
          aggregateId: aggregateId,
          correlationId: crypto.randomUUID()
        }))
      })

      // Assert - Data should be immediately readable from database after withTransaction returns
      const result = db.query('SELECT * FROM events WHERE aggregate_id = ?').get(aggregateId) as any
      expect(result).toBeDefined()
      expect(result.aggregate_id).toBe(aggregateId)
      expect(result.event_type).toBe('TestEvent')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should flush multiple transactions together when within time window', async () => {
    // Arrange - This test needs a custom schema with id column
    const db = new Database(':memory:')
    db.run(`
      CREATE TABLE events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        version INTEGER NOT NULL,
        aggregate_id TEXT NOT NULL,
        correlation_id TEXT NOT NULL,
        occurred_at INTEGER NOT NULL,
        payload TEXT NOT NULL
      )
    `)

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 100, // Longer interval to batch more
      batchSizeThreshold: 1000,
      maxQueueDepth: 100
    })
    batcher.start()

    try {
      const unitOfWork = new UnitOfWork(db, batcher)
      const flushCounts: number[] = []
      let lastCount = 0

      // Act - Start multiple transactions rapidly (within flush interval)
      const promises = []
      for (let i = 0; i < 5; i++) {
        const promise = unitOfWork.withTransaction(async ({ eventRepository }) => {
          eventRepository.addEvent(createTestEvent({
            aggregateId: `batch-timing-${i}-${Date.now()}`,
            correlationId: crypto.randomUUID(),
            payload: { index: i }
          }))
        }).then(() => {
          // After each transaction completes, check how many are in the DB
          const result = db.query('SELECT COUNT(*) as count FROM events').get() as { count: number }
          flushCounts.push(result.count)
        })
        promises.push(promise)

        // Small delay to ensure they're queued separately but within flush window
        await new Promise(resolve => setTimeout(resolve, 5))
      }

      await Promise.all(promises)

      // Assert - All transactions should have flushed together (or in very few batches)
      // If they flushed individually, we'd see counts like [1, 2, 3, 4, 5]
      // If they flushed together, we'd see all [5, 5, 5, 5, 5] or similar
      const uniqueCounts = [...new Set(flushCounts)]
      expect(uniqueCounts.length).toBeLessThanOrEqual(2) // Should be 1-2 flush cycles max
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should maintain FIFO order for events', async () => {
    // Arrange - This test needs a custom schema with id column
    const db = new Database(':memory:')
    db.run(`
      CREATE TABLE events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        version INTEGER NOT NULL,
        aggregate_id TEXT NOT NULL,
        correlation_id TEXT NOT NULL,
        occurred_at INTEGER NOT NULL,
        payload TEXT NOT NULL
      )
    `)

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    try {
      const unitOfWork = new UnitOfWork(db, batcher)
      const order: number[] = []

      // Act - Create transactions in sequence
      for (let i = 0; i < 5; i++) {
        await unitOfWork.withTransaction(async ({ eventRepository }) => {
          order.push(i)
          eventRepository.addEvent(createTestEvent({
            eventName: 'OrderTest',
            aggregateId: `order-${Date.now()}`,
            correlationId: crypto.randomUUID(),
            version: i,
            payload: { order: i }
          }))
        })
      }

      // Assert - Events should be inserted in FIFO order
      const events = db.query('SELECT payload FROM events ORDER BY id').all() as { payload: string }[]
      const insertedOrder = events.map(e => JSON.parse(e.payload).order)
      expect(insertedOrder).toEqual([0, 1, 2, 3, 4])
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
