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
})

