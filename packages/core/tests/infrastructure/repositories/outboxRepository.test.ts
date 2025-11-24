import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { OutboxRepository } from '../../../src/infrastructure/repositories/outboxRepository'
import { TransactionBatch } from '../../../src/infrastructure/transactionBatch'
import type { DomainEvent } from '../../../src/domain/_base/domainEvent'
import { SkuReleasedEvent } from '../../../src/domain/sku/skuEvents'
import { createTestDatabase, closeTestDatabase } from '../../helpers/database'

// Helper to create test domain events
function createTestEvent(overrides?: {
  version?: number;
  aggregateId?: string;
  correlationId?: string;
  occurredAt?: Date;
  userId?: string;
}): DomainEvent {
  return new SkuReleasedEvent({
    occurredAt: overrides?.occurredAt ?? new Date(),
    aggregateId: overrides?.aggregateId ?? 'test-aggregate',
    correlationId: overrides?.correlationId ?? 'test-correlation',
    version: overrides?.version ?? 1,
    userId: overrides?.userId ?? 'user-123',
    priorState: { sku: 'test-sku', variantId: 'test-variant', status: 'released' },
    newState: { sku: 'test-sku', variantId: 'test-variant', status: 'active' },
  })
}

describe('OutboxRepository', () => {
  test('constructor properly initializes with Database and TransactionBatch dependencies', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      // Act
      const repository = new OutboxRepository(db, batch)

      // Assert - Repository should be created without errors
      expect(repository).toBeDefined()
      expect(repository).toBeInstanceOf(OutboxRepository)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('addOutboxEvent creates a prepared SQL statement with correct INSERT query', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new OutboxRepository(db, batch)
    const event = createTestEvent()

    // Act
    repository.addOutboxEvent(event, { id: crypto.randomUUID() })

      // Assert - Verify the command was added to batch
      expect(batch.commands.length).toBe(1)
      expect(batch.commands[0]!.type).toBe('insert')
      expect(batch.commands[0]!.statement).toBeDefined()
    } finally {
      closeTestDatabase(db)
    }
  })

  test('addOutboxEvent adds command to batch with correct parameters and defaults', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new OutboxRepository(db, batch)
      const event = createTestEvent({
        aggregateId: 'product-456',
      })

      // Act
      repository.addOutboxEvent(event, { id: 'outbox-123' })

    // Assert
    expect(batch.commands.length).toBe(1)
    const command = batch.commands[0]!
    expect(command.params).toEqual([
      'outbox-123',
      'product-456',
      'sku.released',
      JSON.stringify({
        priorState: { sku: 'test-sku', variantId: 'test-variant', status: 'released' },
        newState: { sku: 'test-sku', variantId: 'test-variant', status: 'active' }
      }),
      'pending', // default status
      0, // default retry_count
      null, // default last_attempt_at
      null, // default next_retry_at
      null // default idempotency_key
    ])
    } finally {
      closeTestDatabase(db)
    }
  })

  test('addOutboxEvent uses provided optional parameters when provided', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new OutboxRepository(db, batch)
      const lastAttemptAt = new Date(1234567890)
      const nextRetryAt = new Date(1234567900)
      const event = createTestEvent({
        aggregateId: 'order-999',
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
      'sku.released',
      JSON.stringify({
        priorState: { sku: 'test-sku', variantId: 'test-variant', status: 'released' },
        newState: { sku: 'test-sku', variantId: 'test-variant', status: 'active' }
      }),
      'processing',
      2,
      lastAttemptAt.toISOString(),
      nextRetryAt.toISOString(),
      'idempotency-123'
    ])
    } finally {
      closeTestDatabase(db)
    }
  })

  test('addOutboxEvent sets command type to insert', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new OutboxRepository(db, batch)
    const event = createTestEvent()

    // Act
    repository.addOutboxEvent(event, { id: crypto.randomUUID() })

      // Assert
      expect(batch.commands[0]!.type).toBe('insert')
    } finally {
      closeTestDatabase(db)
    }
  })

  test('multiple outbox events can be added sequentially', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new OutboxRepository(db, batch)

      // Act
      repository.addOutboxEvent(createTestEvent({
        aggregateId: 'agg-1',
      }), { id: 'outbox-1' })

      repository.addOutboxEvent(createTestEvent({
        aggregateId: 'agg-2',
      }), { id: 'outbox-2' })

      repository.addOutboxEvent(createTestEvent({
        aggregateId: 'agg-3',
      }), { id: 'outbox-3' })

    // Assert
    expect(batch.commands.length).toBe(3)
      expect(batch.commands[0]!.params[2]).toBe('sku.released')
      expect(batch.commands[1]!.params[2]).toBe('sku.released')
      expect(batch.commands[2]!.params[2]).toBe('sku.released')
    } finally {
      closeTestDatabase(db)
    }
  })

  test('all outbox event fields are correctly passed to the batch', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new OutboxRepository(db, batch)
      const id = 'outbox-999'
      const aggregateId = 'order-789'
      const eventType = 'sku.released'
      const payload = {
        priorState: { sku: 'test-sku', variantId: 'test-variant', status: 'released' },
        newState: { sku: 'test-sku', variantId: 'test-variant', status: 'active' }
      }
      const status = 'pending'
      const retryCount = 0
      const lastAttemptAt: Date | null = null
      const nextRetryAt: Date | null = null
      const idempotencyKey = null

      const event = createTestEvent({
        aggregateId,
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
    } finally {
      closeTestDatabase(db)
    }
  })
})

