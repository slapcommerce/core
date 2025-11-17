import { describe, test, expect } from 'bun:test'
import { VariantAggregate } from '../../../src/domain/variant/aggregate'
import { VariantCreatedEvent, VariantArchivedEvent, VariantDetailsUpdatedEvent, VariantPriceUpdatedEvent, VariantInventoryUpdatedEvent, VariantPublishedEvent } from '../../../src/domain/variant/events'
import type { DomainEvent } from '../../../src/domain/_base/domainEvent'

function createValidVariantParams() {
  return {
    id: 'variant-123',
    correlationId: 'correlation-123',
    userId: 'user-123',
    productId: 'product-123',
    sku: 'SKU-123',
    title: 'Test Variant',
    price: 29.99,
    inventory: 100,
    options: { size: 'Large', color: 'Red' },
    barcode: '123456789' as string | null,
    weight: 1.5 as number | null,
  }
}

describe('VariantAggregate', () => {
  describe('create', () => {
    test('should create a new variant aggregate with draft status', () => {
      // Arrange
      const params = createValidVariantParams()

      // Act
      const variant = VariantAggregate.create(params)

      // Assert
      const snapshot = variant.toSnapshot()
      expect(variant.id).toBe(params.id)
      expect(snapshot.productId).toBe(params.productId)
      expect(snapshot.sku).toBe(params.sku)
      expect(snapshot.title).toBe(params.title)
      expect(snapshot.price).toBe(params.price)
      expect(snapshot.inventory).toBe(params.inventory)
      expect(snapshot.options).toEqual(params.options)
      expect(snapshot.barcode).toBe(params.barcode)
      expect(snapshot.weight).toBe(params.weight)
      expect(snapshot.status).toBe('draft')
      expect(snapshot.publishedAt).toBeNull()
      expect(variant.version).toBe(0)
      expect(variant.events).toEqual([])
      expect(variant.uncommittedEvents).toHaveLength(1)
      const event = variant.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(VariantCreatedEvent)
      expect(event.eventName).toBe('variant.created')
      expect(event.aggregateId).toBe(params.id)
      expect(event.correlationId).toBe(params.correlationId)
      expect(event.version).toBe(0)
    })

    test('should create with null barcode and weight', () => {
      // Arrange
      const params = createValidVariantParams()
      params.barcode = null
      params.weight = null

      // Act
      const variant = VariantAggregate.create(params)

      // Assert
      expect(variant.toSnapshot().barcode).toBeNull()
      expect(variant.toSnapshot().weight).toBeNull()
    })
  })

  describe('publish', () => {
    test('should publish draft variant', () => {
      // Arrange
      const variant = VariantAggregate.create(createValidVariantParams())
      variant.uncommittedEvents = []

      // Act
      variant.publish('user-123')

      // Assert
      const snapshot = variant.toSnapshot()
      expect(snapshot.status).toBe('active')
      expect(snapshot.publishedAt).not.toBeNull()
      expect(variant.version).toBe(1)
      expect(variant.uncommittedEvents).toHaveLength(1)
      const event = variant.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(VariantPublishedEvent)
      expect(event.eventName).toBe('variant.published')
      expect(event.version).toBe(1)
    })

    test('should throw error when variant already published', () => {
      // Arrange
      const variant = VariantAggregate.create(createValidVariantParams())
      variant.uncommittedEvents = []
      variant.publish('user-123')
      variant.uncommittedEvents = []

      // Act & Assert
      expect(() => variant.publish('user-123')).toThrow('Variant is already published')
    })

    test('should throw error when variant is archived', () => {
      // Arrange
      const variant = VariantAggregate.create(createValidVariantParams())
      variant.uncommittedEvents = []
      variant.archive('user-123')
      variant.uncommittedEvents = []

      // Act & Assert
      expect(() => variant.publish('user-123')).toThrow('Cannot publish an archived variant')
    })
  })

  describe('archive', () => {
    test('should archive draft variant', () => {
      // Arrange
      const variant = VariantAggregate.create(createValidVariantParams())
      variant.uncommittedEvents = []

      // Act
      variant.archive('user-123')

      // Assert
      expect(variant.toSnapshot().status).toBe('archived')
      expect(variant.version).toBe(1)
      expect(variant.uncommittedEvents).toHaveLength(1)
      const event = variant.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(VariantArchivedEvent)
      expect(event.eventName).toBe('variant.archived')
      expect(event.version).toBe(1)
    })

    test('should throw error when variant already archived', () => {
      // Arrange
      const variant = VariantAggregate.create(createValidVariantParams())
      variant.uncommittedEvents = []
      variant.archive('user-123')
      variant.uncommittedEvents = []

      // Act & Assert
      expect(() => variant.archive('user-123')).toThrow('Variant is already archived')
    })
  })

  describe('updateDetails', () => {
    test('should update title, options, barcode, and weight', () => {
      // Arrange
      const variant = VariantAggregate.create(createValidVariantParams())
      variant.uncommittedEvents = []

      // Act
      variant.updateDetails('New Title', { size: 'Small', color: 'Blue' }, '987654321', 2.0, 'user-123')

      // Assert
      const snapshot = variant.toSnapshot()
      expect(snapshot.title).toBe('New Title')
      expect(snapshot.options).toEqual({ size: 'Small', color: 'Blue' })
      expect(snapshot.barcode).toBe('987654321')
      expect(snapshot.weight).toBe(2.0)
      expect(variant.uncommittedEvents).toHaveLength(1)
      const event = variant.uncommittedEvents[0]!
      expect(event.eventName).toBe('variant.details_updated')
    })
  })

  describe('updatePrice', () => {
    test('should update price', () => {
      // Arrange
      const variant = VariantAggregate.create(createValidVariantParams())
      variant.uncommittedEvents = []

      // Act
      variant.updatePrice(39.99, 'user-123')

      // Assert
      expect(variant.toSnapshot().price).toBe(39.99)
      expect(variant.uncommittedEvents).toHaveLength(1)
      const event = variant.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(VariantPriceUpdatedEvent)
      expect(event.eventName).toBe('variant.price_updated')
    })
  })

  describe('updateInventory', () => {
    test('should update inventory', () => {
      // Arrange
      const variant = VariantAggregate.create(createValidVariantParams())
      variant.uncommittedEvents = []

      // Act
      variant.updateInventory(200, 'user-123')

      // Assert
      expect(variant.toSnapshot().inventory).toBe(200)
      expect(variant.uncommittedEvents).toHaveLength(1)
      const event = variant.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(VariantInventoryUpdatedEvent)
      expect(event.eventName).toBe('variant.inventory_updated')
    })
  })

  describe('apply', () => {
    test('should apply VariantCreatedEvent and update state', () => {
      // Arrange
      const variantId = 'variant-123'
      const correlationId = 'correlation-123'
      const occurredAt = new Date()
      const createdAt = occurredAt
      const createdEvent = new VariantCreatedEvent({
        occurredAt,
        correlationId,
        aggregateId: variantId,
        version: 0,
        userId: 'user-123',
        priorState: {} as any,
        newState: {
          productId: 'product-123',
          sku: 'SKU-123',
          title: 'Created Variant',
          price: 29.99,
          inventory: 100,
          options: { size: 'Large' },
          barcode: '123',
          weight: 1.5,
          status: 'draft' as const,
          createdAt,
          updatedAt: createdAt,
          publishedAt: null,
        },
      })

      const variant = new VariantAggregate({
        id: variantId,
        correlationId,
        createdAt: new Date(),
        updatedAt: new Date(),
        productId: '',
        sku: '',
        title: '',
        price: 0,
        inventory: 0,
        options: {},
        barcode: null,
        weight: null,
        version: 0,
        events: [],
        status: 'draft',
        publishedAt: null,
      })

      // Act
      variant.apply(createdEvent)

      // Assert
      expect(variant.toSnapshot().title).toBe('Created Variant')
      expect(variant.toSnapshot().price).toBe(29.99)
      expect(variant.version).toBe(1)
      expect(variant.events).toHaveLength(1)
    })

    test('should apply VariantArchivedEvent and update state', () => {
      // Arrange
      const variant = VariantAggregate.create(createValidVariantParams())
      variant.uncommittedEvents = []
      const snapshot = variant.toSnapshot()
      const { id, version, ...priorState } = snapshot
      
      const archivedEvent = new VariantArchivedEvent({
        occurredAt: new Date(),
        correlationId: createValidVariantParams().correlationId,
        aggregateId: variant.id,
        version: 1,
        userId: 'user-123',
        priorState: priorState as any,
        newState: {
          ...priorState,
          status: 'archived' as const,
          updatedAt: new Date(),
          publishedAt: null,
        } as any,
      })

      // Act
      variant.apply(archivedEvent)

      // Assert
      expect(variant.toSnapshot().status).toBe('archived')
      expect(variant.version).toBe(1)
    })
  })

  describe('loadFromSnapshot', () => {
    test('should load variant from snapshot', () => {
      // Arrange
      const snapshot = {
        aggregate_id: 'variant-123',
        correlation_id: 'correlation-123',
        version: 5,
        payload: JSON.stringify({
          productId: 'product-123',
          sku: 'SKU-123',
          title: 'Snapshot Variant',
          price: 29.99,
          inventory: 100,
          options: { size: 'Large' },
          barcode: '123',
          weight: 1.5,
          status: 'draft',
          publishedAt: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        }),
      }

      // Act
      const variant = VariantAggregate.loadFromSnapshot(snapshot)

      // Assert
      const variantSnapshot = variant.toSnapshot()
      expect(variant.id).toBe('variant-123')
      expect(variantSnapshot.title).toBe('Snapshot Variant')
      expect(variantSnapshot.price).toBe(29.99)
      expect(variantSnapshot.publishedAt).toBeNull()
      expect(variant.version).toBe(5)
      expect(variant.events).toEqual([])
    })

    test('should load variant from snapshot with publishedAt', () => {
      // Arrange
      const snapshot = {
        aggregate_id: 'variant-123',
        correlation_id: 'correlation-123',
        version: 5,
        payload: JSON.stringify({
          productId: 'product-123',
          sku: 'SKU-123',
          title: 'Snapshot Variant',
          price: 29.99,
          inventory: 100,
          options: { size: 'Large' },
          barcode: '123',
          weight: 1.5,
          status: 'active',
          publishedAt: '2024-01-03T00:00:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        }),
      }

      // Act
      const variant = VariantAggregate.loadFromSnapshot(snapshot)

      // Assert
      const variantSnapshot = variant.toSnapshot()
      expect(variant.id).toBe('variant-123')
      expect(variantSnapshot.title).toBe('Snapshot Variant')
      expect(variantSnapshot.status).toBe('active')
      expect(variantSnapshot.publishedAt).not.toBeNull()
      expect(variantSnapshot.publishedAt).toBeInstanceOf(Date)
      expect(variant.version).toBe(5)
      expect(variant.events).toEqual([])
    })
  })

  describe('apply variant.published', () => {
    test('should apply VariantPublishedEvent and update state', () => {
      // Arrange
      const variant = VariantAggregate.create(createValidVariantParams())
      variant.uncommittedEvents = []
      const snapshot = variant.toSnapshot()
      const { id, version, ...priorState } = snapshot
      
      const publishedAt = new Date()
      const publishedEvent = new VariantPublishedEvent({
        occurredAt: publishedAt,
        correlationId: createValidVariantParams().correlationId,
        aggregateId: variant.id,
        version: 1,
        userId: 'user-123',
        priorState: priorState as any,
        newState: {
          ...priorState,
          status: 'active' as const,
          publishedAt,
          updatedAt: publishedAt,
        } as any,
      })

      // Act
      variant.apply(publishedEvent)

      // Assert
      const updatedSnapshot = variant.toSnapshot()
      expect(updatedSnapshot.status).toBe('active')
      expect(updatedSnapshot.publishedAt).not.toBeNull()
      expect(updatedSnapshot.publishedAt).toEqual(publishedAt)
      expect(variant.version).toBe(1)
    })
  })
})

