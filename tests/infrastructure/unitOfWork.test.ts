import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { UnitOfWork } from '../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../src/infrastructure/transactionBatcher'
import { TransactionBatch } from '../../src/infrastructure/transactionBatch'
import { EventRepository } from '../../src/infrastructure/repositories/eventRepository'
import { SnapshotRepository } from '../../src/infrastructure/repositories/snapshotRepository'
import { OutboxRepository } from '../../src/infrastructure/repositories/outboxRepository'
import { ProductListViewRepository } from '../../src/infrastructure/repositories/productListViewRepository'
import { ProductCollectionRepository } from '../../src/infrastructure/repositories/productCollectionRepository'
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

describe('UnitOfWork', () => {
  test('constructor properly initializes with Database and TransactionBatcher dependencies', () => {
    // Arrange
    const db = createTestDatabase()
    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 10,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    try {
      // Act
      const unitOfWork = new UnitOfWork(db, batcher)

      // Assert
      expect(unitOfWork).toBeDefined()
      expect(unitOfWork).toBeInstanceOf(UnitOfWork)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('withTransaction creates a new TransactionBatch for each call', async () => {
    // Arrange
    const db = createTestDatabase()
    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 10,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    try {
      const unitOfWork = new UnitOfWork(db, batcher)

      // Act - Create multiple transactions
      await unitOfWork.withTransaction(async ({ eventRepository }) => {
        // Access the batch through the repository's internal batch
        // We can verify uniqueness by checking that each transaction completes independently
        eventRepository.addEvent(createTestEvent({
          aggregateId: `batch-test-${Date.now()}-${Math.random()}`,
          correlationId: crypto.randomUUID()
        }))
      })

      await unitOfWork.withTransaction(async ({ eventRepository }) => {
        eventRepository.addEvent(createTestEvent({
          aggregateId: `batch-test-${Date.now()}-${Math.random()}`,
          correlationId: crypto.randomUUID()
        }))
      })

      // Assert - Both transactions should complete successfully
      const result = db.query('SELECT COUNT(*) as count FROM events').get() as { count: number }
      expect(result.count).toBe(2)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('withTransaction creates EventRepository, SnapshotRepository, OutboxRepository, ProductListViewRepository, and ProductCollectionRepository with the batch and database', async () => {
    // Arrange
    const db = createTestDatabase()
    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 10,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    try {
      const unitOfWork = new UnitOfWork(db, batcher)
      let receivedEventRepository: EventRepository | null = null
      let receivedSnapshotRepository: SnapshotRepository | null = null
      let receivedOutboxRepository: OutboxRepository | null = null
      let receivedProductListViewRepository: ProductListViewRepository | null = null
      let receivedProductCollectionRepository: ProductCollectionRepository | null = null

      // Act
      await unitOfWork.withTransaction(async ({ eventRepository, snapshotRepository, outboxRepository, productListViewRepository, productCollectionRepository }) => {
        receivedEventRepository = eventRepository
        receivedSnapshotRepository = snapshotRepository
        receivedOutboxRepository = outboxRepository
        receivedProductListViewRepository = productListViewRepository
        receivedProductCollectionRepository = productCollectionRepository
        expect(eventRepository).toBeInstanceOf(EventRepository)
        expect(snapshotRepository).toBeInstanceOf(SnapshotRepository)
        expect(outboxRepository).toBeInstanceOf(OutboxRepository)
        expect(productListViewRepository).toBeInstanceOf(ProductListViewRepository)
        expect(productCollectionRepository).toBeInstanceOf(ProductCollectionRepository)
      })

      // Assert
      expect(receivedEventRepository).not.toBeNull()
      expect(receivedSnapshotRepository).not.toBeNull()
      expect(receivedOutboxRepository).not.toBeNull()
      expect(receivedProductListViewRepository).not.toBeNull()
      expect(receivedProductCollectionRepository).not.toBeNull()
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('withTransaction executes the work callback with all repositories', async () => {
    // Arrange
    const db = createTestDatabase()
    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 10,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    try {
      const unitOfWork = new UnitOfWork(db, batcher)
      let callbackExecuted = false
      let receivedEventRepository: EventRepository | null = null
      let receivedSnapshotRepository: SnapshotRepository | null = null
      let receivedOutboxRepository: OutboxRepository | null = null
      let receivedProductListViewRepository: ProductListViewRepository | null = null
      let receivedProductCollectionRepository: ProductCollectionRepository | null = null

      // Act
      await unitOfWork.withTransaction(async ({ eventRepository, snapshotRepository, outboxRepository, productListViewRepository, productCollectionRepository }) => {
        callbackExecuted = true
        receivedEventRepository = eventRepository
        receivedSnapshotRepository = snapshotRepository
        receivedOutboxRepository = outboxRepository
        receivedProductListViewRepository = productListViewRepository
        receivedProductCollectionRepository = productCollectionRepository
      })

      // Assert
      expect(callbackExecuted).toBe(true)
      expect(receivedEventRepository).not.toBeNull()
      expect(receivedEventRepository).toBeInstanceOf(EventRepository)
      expect(receivedSnapshotRepository).not.toBeNull()
      expect(receivedSnapshotRepository).toBeInstanceOf(SnapshotRepository)
      expect(receivedOutboxRepository).not.toBeNull()
      expect(receivedOutboxRepository).toBeInstanceOf(OutboxRepository)
      expect(receivedProductListViewRepository).not.toBeNull()
      expect(receivedProductListViewRepository).toBeInstanceOf(ProductListViewRepository)
      expect(receivedProductCollectionRepository).not.toBeNull()
      expect(receivedProductCollectionRepository).toBeInstanceOf(ProductCollectionRepository)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('withTransaction enqueues the batch via batcher.enqueueBatch', async () => {
    // Arrange
    const db = createTestDatabase()
    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 10,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    try {
      const unitOfWork = new UnitOfWork(db, batcher)

      // Act
      await unitOfWork.withTransaction(async ({ eventRepository, snapshotRepository, outboxRepository }) => {
        eventRepository.addEvent(createTestEvent({
          aggregateId: 'enqueue-test',
          correlationId: crypto.randomUUID()
        }))
      })

      // Assert - Batch should have been enqueued and flushed
      // Since we're using a real batcher, we verify by checking the database
      const result = db.query('SELECT COUNT(*) as count FROM events').get() as { count: number }
      expect(result.count).toBe(1)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('withTransaction waits for batch.promise to resolve before returning', async () => {
    // Arrange
    const db = createTestDatabase()
    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 10,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    try {
      const unitOfWork = new UnitOfWork(db, batcher)
      const timeline: string[] = []

      // Act
      timeline.push('before-transaction')
      await unitOfWork.withTransaction(async ({ eventRepository, snapshotRepository, outboxRepository }) => {
        timeline.push('inside-callback')
        eventRepository.addEvent(createTestEvent({
          aggregateId: 'wait-test',
          correlationId: crypto.randomUUID()
        }))
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
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('withTransaction rejects the batch and rethrows error when work callback throws', async () => {
    // Arrange
    const db = createTestDatabase()
    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 10,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    try {
      const unitOfWork = new UnitOfWork(db, batcher)
      const testError = new Error('Test error')

      // Act & Assert
      await expect(
        unitOfWork.withTransaction(async ({ eventRepository, snapshotRepository, outboxRepository }) => {
          eventRepository.addEvent(createTestEvent({
            aggregateId: 'error-test',
            correlationId: crypto.randomUUID()
          }))
          throw testError
        })
      ).rejects.toThrow('Test error')

      // Assert - No events should be committed due to error
      const result = db.query('SELECT COUNT(*) as count FROM events').get() as { count: number }
      expect(result.count).toBe(0)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('withTransaction handles non-Error exceptions by converting to Error', async () => {
    // Arrange
    const db = createTestDatabase()
    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 10,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    try {
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
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('multiple concurrent withTransaction calls create separate batches', async () => {
    // Arrange
    const db = createTestDatabase()
    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 10,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    try {
      const unitOfWork = new UnitOfWork(db, batcher)

      // Act - Create multiple concurrent transactions
      const promises = []
      for (let i = 0; i < 5; i++) {
        const promise = unitOfWork.withTransaction(async ({ eventRepository, snapshotRepository, outboxRepository }) => {
          eventRepository.addEvent(createTestEvent({
            aggregateId: `concurrent-${i}`,
            correlationId: crypto.randomUUID(),
            payload: { index: i }
          }))
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
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('withTransaction properly handles repository operations', async () => {
    // Arrange
    const db = createTestDatabase()
    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 10,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    try {
      const unitOfWork = new UnitOfWork(db, batcher)

      // Act
      await unitOfWork.withTransaction(async ({ eventRepository, snapshotRepository, outboxRepository }) => {
        eventRepository.addEvent(createTestEvent({
          eventName: 'ProductCreated',
          aggregateId: 'product-1',
          correlationId: 'corr-1',
          payload: { name: 'Product 1' }
        }))

        eventRepository.addEvent(createTestEvent({
          eventName: 'ProductUpdated',
          version: 2,
          aggregateId: 'product-1',
          correlationId: 'corr-2',
          payload: { name: 'Product 1 Updated' }
        }))
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
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('withTransaction allows using all repositories together in atomic transaction', async () => {
    // Arrange
    const db = createTestDatabase()
    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 10,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    try {
      const unitOfWork = new UnitOfWork(db, batcher)
      const aggregateId = 'product-123'
      const correlationId = 'corr-456'
      const outboxId = crypto.randomUUID()

      // Act
      await unitOfWork.withTransaction(async ({ eventRepository, snapshotRepository, outboxRepository }) => {
        // Add an event
        eventRepository.addEvent(createTestEvent({
          eventName: 'ProductCreated',
          aggregateId: aggregateId,
          correlationId: correlationId,
          payload: { name: 'Test Product' }
        }))

        // Save a snapshot
        snapshotRepository.saveSnapshot({
          aggregate_id: aggregateId,
          correlation_id: correlationId,
          version: 1,
          payload: { state: 'created' }
        })

        // Add an outbox event
        outboxRepository.addOutboxEvent(createTestEvent({
          eventName: 'ProductCreated',
          aggregateId: aggregateId,
          correlationId: correlationId,
          payload: { name: 'Test Product' }
        }), { id: outboxId })
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
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('withTransaction rolls back all repository operations when error occurs', async () => {
    // Arrange
    const db = createTestDatabase()
    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 10,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    try {
      const unitOfWork = new UnitOfWork(db, batcher)
      const aggregateId = 'product-456'
      const correlationId = 'corr-789'
      const outboxId = crypto.randomUUID()

      // Act & Assert
      await expect(
        unitOfWork.withTransaction(async ({ eventRepository, snapshotRepository, outboxRepository }) => {
          // Add an event
          eventRepository.addEvent(createTestEvent({
            eventName: 'ProductCreated',
            aggregateId: aggregateId,
            correlationId: correlationId,
            payload: { name: 'Test Product' }
          }))

          // Save a snapshot
          snapshotRepository.saveSnapshot({
            aggregate_id: aggregateId,
            correlation_id: correlationId,
            version: 1,
            payload: { state: 'created' }
          })

          // Add an outbox event
          outboxRepository.addOutboxEvent(createTestEvent({
            eventName: 'ProductCreated',
            aggregateId: aggregateId,
            correlationId: correlationId,
            payload: { name: 'Test Product' }
          }), { id: outboxId })

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
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})

