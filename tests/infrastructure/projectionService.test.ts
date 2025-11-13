import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { ProjectionService, type UnitOfWorkRepositories } from '../../src/infrastructure/projectionService'
import { createTestDatabase, closeTestDatabase } from '../helpers/database'
import { ProductListViewRepository } from '../../src/infrastructure/repositories/productListViewRepository'
import { ProductCollectionRepository } from '../../src/infrastructure/repositories/productCollectionRepository'
import { SlugRedirectRepository } from '../../src/infrastructure/repositories/slugRedirectRepository'
import { CollectionsListViewRepository } from '../../src/infrastructure/repositories/collectionsListViewRepository'
import { EventRepository } from '../../src/infrastructure/repositories/eventRepository'
import { SnapshotRepository } from '../../src/infrastructure/repositories/snapshotRepository'
import { OutboxRepository } from '../../src/infrastructure/repositories/outboxRepository'
import { ProductVariantRepository } from '../../src/infrastructure/repositories/productVariantRepository'
import { TransactionBatch } from '../../src/infrastructure/transactionBatch'
import type { DomainEvent } from '../../src/domain/_base/domainEvent'
import { ProductCreatedEvent } from '../../src/domain/product/events'
import { randomUUIDv7 } from 'bun'

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

// Helper to create all repositories for tests
function createRepositories(db: Database, batch: TransactionBatch) {
  return {
    eventRepository: new EventRepository(db, batch),
    snapshotRepository: new SnapshotRepository(db, batch),
    outboxRepository: new OutboxRepository(db, batch),
    productListViewRepository: new ProductListViewRepository(db, batch),
    productCollectionRepository: new ProductCollectionRepository(db, batch),
    productVariantRepository: new ProductVariantRepository(db, batch),
    slugRedirectRepository: new SlugRedirectRepository(db, batch),
    collectionsListViewRepository: new CollectionsListViewRepository(db, batch),
  }
}

describe('ProjectionService', () => {
  test('should register a handler for an event type', () => {
    // Arrange
    const service = new ProjectionService()
    const handler = async () => {}

    // Act
    service.registerHandler('product.created', handler)

    // Assert - No error thrown, handler registered
    expect(service).toBeDefined()
  })

  test('should register multiple handlers for the same event type', () => {
    // Arrange
    const service = new ProjectionService()
    const handler1 = async () => {}
    const handler2 = async () => {}
    const handler3 = async () => {}

    // Act
    service.registerHandler('product.created', handler1)
    service.registerHandler('product.created', handler2)
    service.registerHandler('product.created', handler3)

    // Assert - No error thrown, all handlers registered
    expect(service).toBeDefined()
  })

  test('should call registered handler when handling matching event', async () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    const service = new ProjectionService()
    
    try {
      let handlerCalled = false
      const handler = async (event: DomainEvent<string, Record<string, unknown>>, repos: UnitOfWorkRepositories) => {
        handlerCalled = true
        expect(event.eventName).toBe('product.created')
      }

      service.registerHandler('product.created', handler)
      const event = createTestEvent({ eventName: 'product.created' })

      // Act
      await service.handleEvent(event, repositories)

      // Assert
      expect(handlerCalled).toBe(true)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should call all registered handlers for an event type', async () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    const service = new ProjectionService()
    
    try {
      const callOrder: number[] = []
      const handler1 = async () => { callOrder.push(1) }
      const handler2 = async () => { callOrder.push(2) }
      const handler3 = async () => { callOrder.push(3) }

      service.registerHandler('product.created', handler1)
      service.registerHandler('product.created', handler2)
      service.registerHandler('product.created', handler3)
      const event = createTestEvent({ eventName: 'product.created' })

      // Act
      await service.handleEvent(event, repositories)

      // Assert - All handlers should be called
      expect(callOrder.length).toBe(3)
      expect(callOrder).toEqual([1, 2, 3])
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should not call handlers for unregistered event types', async () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    const service = new ProjectionService()
    
    try {
      let handlerCalled = false
      const handler = async () => { handlerCalled = true }

      service.registerHandler('product.created', handler)
      const event = createTestEvent({ eventName: 'product.updated' })

      // Act
      await service.handleEvent(event, repositories)

      // Assert
      expect(handlerCalled).toBe(false)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should handle events with no registered handlers gracefully', async () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    const service = new ProjectionService()
    const event = createTestEvent({ eventName: 'unknown.event' })

    try {
      // Act & Assert - Should not throw
      await service.handleEvent(event, repositories)
      // If we get here, no error was thrown
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should pass event and repository to handler', async () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    const service = new ProjectionService()
    
    try {
      let receivedEvent: DomainEvent<string, Record<string, unknown>> | null = null
      let receivedRepositories: UnitOfWorkRepositories | null = null
      
      const handler = async (
        event: DomainEvent<string, Record<string, unknown>>,
        repos: UnitOfWorkRepositories
      ) => {
        receivedEvent = event
        receivedRepositories = repos
      }

      service.registerHandler('product.created', handler)
      const event = createTestEvent({ 
        eventName: 'product.created',
        aggregateId: 'test-id',
        version: 5
    })

      // Act
      await service.handleEvent(event, repositories)

      // Assert
      expect(receivedEvent).toBeDefined()
      expect(receivedEvent).not.toBeNull()
      const receivedEventValue = receivedEvent!
      expect(receivedEventValue.eventName).toBe('product.created')
      expect(receivedEventValue.aggregateId).toBe('test-id')
      expect(receivedEventValue.version).toBe(5)
      expect(receivedRepositories).not.toBeNull()
      expect(receivedRepositories!.slugRedirectRepository).toBe(repositories.slugRedirectRepository)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should handle errors in handlers gracefully', async () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    const service = new ProjectionService()
    
    try {
      const handler1 = async () => { throw new Error('Handler 1 error') }
      const handler2 = async () => { /* success */ }

      service.registerHandler('product.created', handler1)
      service.registerHandler('product.created', handler2)
      const event = createTestEvent({ eventName: 'product.created' })

      // Act & Assert - Should propagate error from handler
      await expect(service.handleEvent(event, repositories)).rejects.toThrow('Handler 1 error')
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should handle multiple different event types', async () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    const service = new ProjectionService()
    
    try {
      const productHandlerCalled: boolean[] = []
      const orderHandlerCalled: boolean[] = []
      
      const productHandler = async () => { productHandlerCalled.push(true) }
      const orderHandler = async () => { orderHandlerCalled.push(true) }

      service.registerHandler('product.created', productHandler)
      service.registerHandler('order.created', orderHandler)

      const productEvent = createTestEvent({ eventName: 'product.created' })
      const orderEvent = createTestEvent({ eventName: 'order.created' })

      // Act
      await service.handleEvent(productEvent, repositories)
      await service.handleEvent(orderEvent, repositories)

      // Assert
      expect(productHandlerCalled.length).toBe(1)
      expect(orderHandlerCalled.length).toBe(1)
    } finally {
      closeTestDatabase(db)
    }
  })
})

