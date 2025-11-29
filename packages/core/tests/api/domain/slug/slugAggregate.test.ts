import { describe, test, expect } from 'bun:test'
import { SlugAggregate } from '../../../../src/api/domain/slug/slugAggregate'
import { SlugReservedEvent, SlugRedirectedEvent, SlugReleasedEvent } from '../../../../src/api/domain/slug/slugEvents'

function createValidSlugParams() {
  return {
    slug: 'test-product-slug',
    correlationId: 'correlation-123',
  }
}

describe('SlugAggregate', () => {
  describe('create', () => {
    test('should create a new slug aggregate with active status and null entityId', () => {
      // Arrange
      const params = createValidSlugParams()

      // Act
      const slugAggregate = SlugAggregate.create(params)

      // Assert
      expect(slugAggregate.id).toBe(params.slug)
      expect(slugAggregate.version).toBe(0)
      expect(slugAggregate.events).toEqual([])
      expect(slugAggregate.uncommittedEvents).toEqual([])

      const snapshot = slugAggregate.toSnapshot()
      expect(snapshot.slug).toBe(params.slug)
      expect(snapshot.entityId).toBeNull()
      expect(snapshot.entityType).toBeNull()
      expect(snapshot.status).toBe('active')
    })
  })

  describe('isSlugAvailable', () => {
    test('should return true when entityId is null', () => {
      // Arrange
      const slugAggregate = SlugAggregate.create(createValidSlugParams())

      // Act
      const isAvailable = slugAggregate.isSlugAvailable()

      // Assert
      expect(isAvailable).toBe(true)
    })

    test('should return false when entityId is not null', () => {
      // Arrange
      const slugAggregate = SlugAggregate.create(createValidSlugParams())
      slugAggregate.reserveSlug('product-123', 'product', 'user-123')
      slugAggregate.uncommittedEvents = []

      // Act
      const isAvailable = slugAggregate.isSlugAvailable()

      // Assert
      expect(isAvailable).toBe(false)
    })
  })

  describe('reserveSlug', () => {
    test('should reserve slug for a product', () => {
      // Arrange
      const slugAggregate = SlugAggregate.create(createValidSlugParams())
      const entityId = 'product-123'

      // Act
      slugAggregate.reserveSlug(entityId, 'product', 'user-123')

      // Assert
      const snapshot = slugAggregate.toSnapshot()
      expect(snapshot.entityId).toBe(entityId)
      expect(snapshot.entityType).toBe('product')
      expect(snapshot.status).toBe('active')
      expect(slugAggregate.version).toBe(1)
      expect(slugAggregate.uncommittedEvents).toHaveLength(1)

      const event = slugAggregate.uncommittedEvents[0]! as SlugReservedEvent
      expect(event).toBeInstanceOf(SlugReservedEvent)
      expect(event.eventName).toBe('slug.reserved')
      expect(event.aggregateId).toBe(slugAggregate.id)
      expect(event.correlationId).toBe(createValidSlugParams().correlationId)
      expect(event.version).toBe(1)
      expect(event.payload.newState.entityId).toBe(entityId)
      expect(event.payload.newState.entityType).toBe('product')
      expect(event.payload.newState.status).toBe('active')
      expect(event.payload.priorState.entityId).toBeNull()
      expect(event.payload.priorState.status).toBe('active')
    })

    test('should reserve slug for a bundle', () => {
      // Arrange
      const slugAggregate = SlugAggregate.create(createValidSlugParams())
      const entityId = 'bundle-123'

      // Act
      slugAggregate.reserveSlug(entityId, 'bundle', 'user-123')

      // Assert
      const snapshot = slugAggregate.toSnapshot()
      expect(snapshot.entityId).toBe(entityId)
      expect(snapshot.entityType).toBe('bundle')
      expect(snapshot.status).toBe('active')
    })

    test('should reserve slug for a collection', () => {
      // Arrange
      const slugAggregate = SlugAggregate.create(createValidSlugParams())
      const entityId = 'collection-123'

      // Act
      slugAggregate.reserveSlug(entityId, 'collection', 'user-123')

      // Assert
      const snapshot = slugAggregate.toSnapshot()
      expect(snapshot.entityId).toBe(entityId)
      expect(snapshot.entityType).toBe('collection')
      expect(snapshot.status).toBe('active')
    })

    test('should throw error when slug is already reserved', () => {
      // Arrange
      const slugAggregate = SlugAggregate.create(createValidSlugParams())
      slugAggregate.reserveSlug('product-123', 'product', 'user-123')
      slugAggregate.uncommittedEvents = []

      // Act & Assert
      expect(() => slugAggregate.reserveSlug('product-456', 'product', 'user-123')).toThrow('Slug "test-product-slug" is already in use')
    })

    test('should throw error when slug is redirected', () => {
      // Arrange
      const slugAggregate = SlugAggregate.create(createValidSlugParams())
      slugAggregate.reserveSlug('product-123', 'product', 'user-123')
      slugAggregate.uncommittedEvents = []
      slugAggregate.markAsRedirect('new-slug', 'user-123')
      slugAggregate.uncommittedEvents = []

      // Act & Assert
      expect(() => slugAggregate.reserveSlug('product-456', 'product', 'user-123')).toThrow('Slug "test-product-slug" is already in use')
    })
  })

  describe('markAsRedirect', () => {
    test('should mark slug as redirect', () => {
      // Arrange
      const slugAggregate = SlugAggregate.create(createValidSlugParams())
      slugAggregate.reserveSlug('product-123', 'product', 'user-123')
      slugAggregate.uncommittedEvents = []

      // Act
      slugAggregate.markAsRedirect('new-slug', 'user-123')

      // Assert
      const snapshot = slugAggregate.toSnapshot()
      expect(snapshot.status).toBe('redirect')
      expect(snapshot.entityId).toBe('product-123') // entityId should remain unchanged
      expect(slugAggregate.version).toBe(2)
      expect(slugAggregate.uncommittedEvents).toHaveLength(1)

      const event = slugAggregate.uncommittedEvents[0]! as SlugRedirectedEvent
      expect(event).toBeInstanceOf(SlugRedirectedEvent)
      expect(event.eventName).toBe('slug.redirected')
      expect(event.aggregateId).toBe(slugAggregate.id)
      expect(event.correlationId).toBe(createValidSlugParams().correlationId)
      expect(event.version).toBe(2)
      expect(event.payload.newState.status).toBe('redirect')
      expect(event.payload.priorState.status).toBe('active')
    })

    test('should be idempotent when already redirected', () => {
      // Arrange
      const slugAggregate = SlugAggregate.create(createValidSlugParams())
      slugAggregate.reserveSlug('product-123', 'product', 'user-123')
      slugAggregate.uncommittedEvents = []
      slugAggregate.markAsRedirect('new-slug', 'user-123')
      slugAggregate.uncommittedEvents = []
      const versionBefore = slugAggregate.version

      // Act
      slugAggregate.markAsRedirect('another-slug', 'user-123')

      // Assert
      expect(slugAggregate.version).toBe(versionBefore)
      expect(slugAggregate.uncommittedEvents).toHaveLength(0)
      const snapshot = slugAggregate.toSnapshot()
      expect(snapshot.status).toBe('redirect')
    })

    test('should mark unreserved slug as redirect', () => {
      // Arrange
      const slugAggregate = SlugAggregate.create(createValidSlugParams())

      // Act
      slugAggregate.markAsRedirect('new-slug', 'user-123')

      // Assert
      const snapshot = slugAggregate.toSnapshot()
      expect(snapshot.status).toBe('redirect')
      expect(snapshot.entityId).toBeNull()
      expect(slugAggregate.version).toBe(1)
      expect(slugAggregate.uncommittedEvents).toHaveLength(1)
    })
  })

  describe('releaseSlug', () => {
    test('should release slug and set entityId to null', () => {
      // Arrange
      const slugAggregate = SlugAggregate.create(createValidSlugParams())
      const entityId = 'product-123'
      slugAggregate.reserveSlug(entityId, 'product', 'user-123')
      slugAggregate.uncommittedEvents = []

      // Act
      slugAggregate.releaseSlug('user-123')

      // Assert
      const snapshot = slugAggregate.toSnapshot()
      expect(snapshot.entityId).toBeNull()
      expect(snapshot.entityType).toBeNull()
      expect(snapshot.status).toBe('active')
      expect(slugAggregate.version).toBe(2)
      expect(slugAggregate.uncommittedEvents).toHaveLength(1)

      const event = slugAggregate.uncommittedEvents[0]! as SlugReleasedEvent
      expect(event).toBeInstanceOf(SlugReleasedEvent)
      expect(event.eventName).toBe('slug.released')
      expect(event.aggregateId).toBe(slugAggregate.id)
      expect(event.correlationId).toBe(createValidSlugParams().correlationId)
      expect(event.version).toBe(2)
      expect(event.payload.newState.entityId).toBeNull()
      expect(event.payload.newState.status).toBe('active')
      expect(event.payload.priorState.entityId).toBe(entityId)
      expect(event.payload.priorState.status).toBe('active')
    })

    test('should be idempotent when slug is already released', () => {
      // Arrange
      const slugAggregate = SlugAggregate.create(createValidSlugParams())
      const versionBefore = slugAggregate.version

      // Act
      slugAggregate.releaseSlug('user-123')

      // Assert
      expect(slugAggregate.version).toBe(versionBefore)
      expect(slugAggregate.uncommittedEvents).toHaveLength(0)
      const snapshot = slugAggregate.toSnapshot()
      expect(snapshot.entityId).toBeNull()
      expect(snapshot.status).toBe('active')
    })
  })

  describe('loadFromSnapshot', () => {
    test('should load slug aggregate from snapshot', () => {
      // Arrange
      const snapshot = {
        aggregateId: 'test-product-slug',
        correlationId: 'correlation-123',
        version: 5,
        payload: JSON.stringify({
          slug: 'test-product-slug',
          entityId: 'product-123',
          entityType: 'product',
          status: 'active',
        }),
      }

      // Act
      const slugAggregate = SlugAggregate.loadFromSnapshot(snapshot)

      // Assert
      expect(slugAggregate.id).toBe('test-product-slug')
      expect(slugAggregate.version).toBe(5)
      expect(slugAggregate.events).toEqual([])

      const aggregateSnapshot = slugAggregate.toSnapshot()
      expect(aggregateSnapshot.slug).toBe('test-product-slug')
      expect(aggregateSnapshot.entityId).toBe('product-123')
      expect(aggregateSnapshot.entityType).toBe('product')
      expect(aggregateSnapshot.status).toBe('active')
    })

    test('should load slug aggregate from snapshot with null entityId', () => {
      // Arrange
      const snapshot = {
        aggregateId: 'test-product-slug',
        correlationId: 'correlation-123',
        version: 0,
        payload: JSON.stringify({
          slug: 'test-product-slug',
          entityId: null,
          entityType: null,
          status: 'active',
        }),
      }

      // Act
      const slugAggregate = SlugAggregate.loadFromSnapshot(snapshot)

      // Assert
      const aggregateSnapshot = slugAggregate.toSnapshot()
      expect(aggregateSnapshot.entityId).toBeNull()
      expect(aggregateSnapshot.status).toBe('active')
    })

    test('should load slug aggregate from snapshot with redirect status', () => {
      // Arrange
      const snapshot = {
        aggregateId: 'test-product-slug',
        correlationId: 'correlation-123',
        version: 3,
        payload: JSON.stringify({
          slug: 'test-product-slug',
          entityId: 'product-123',
          entityType: 'product',
          status: 'redirect',
        }),
      }

      // Act
      const slugAggregate = SlugAggregate.loadFromSnapshot(snapshot)

      // Assert
      const aggregateSnapshot = slugAggregate.toSnapshot()
      expect(aggregateSnapshot.status).toBe('redirect')
      expect(aggregateSnapshot.entityId).toBe('product-123')
    })

    test('should default status to active when not provided', () => {
      // Arrange
      const snapshot = {
        aggregateId: 'test-product-slug',
        correlationId: 'correlation-123',
        version: 1,
        payload: JSON.stringify({
          slug: 'test-product-slug',
          entityId: null,
        }),
      }

      // Act
      const slugAggregate = SlugAggregate.loadFromSnapshot(snapshot)

      // Assert
      const aggregateSnapshot = slugAggregate.toSnapshot()
      expect(aggregateSnapshot.status).toBe('active')
    })

    test('should default entityId to null when not provided', () => {
      // Arrange
      const snapshot = {
        aggregateId: 'test-product-slug',
        correlationId: 'correlation-123',
        version: 1,
        payload: JSON.stringify({
          slug: 'test-product-slug',
          status: 'active',
        }),
      }

      // Act
      const slugAggregate = SlugAggregate.loadFromSnapshot(snapshot)

      // Assert
      const aggregateSnapshot = slugAggregate.toSnapshot()
      expect(aggregateSnapshot.entityId).toBeNull()
    })

    test('should handle backwards compatibility with productId', () => {
      // Arrange - old snapshot format with productId
      const snapshot = {
        aggregateId: 'test-product-slug',
        correlationId: 'correlation-123',
        version: 5,
        payload: JSON.stringify({
          slug: 'test-product-slug',
          productId: 'product-123',
          status: 'active',
        }),
      }

      // Act
      const slugAggregate = SlugAggregate.loadFromSnapshot(snapshot)

      // Assert - should migrate productId to entityId
      const aggregateSnapshot = slugAggregate.toSnapshot()
      expect(aggregateSnapshot.entityId).toBe('product-123')
      expect(aggregateSnapshot.entityType).toBe('product')
    })
  })

  describe('toSnapshot', () => {
    test('should return correct snapshot for active slug', () => {
      // Arrange
      const slugAggregate = SlugAggregate.create(createValidSlugParams())
      slugAggregate.reserveSlug('product-123', 'product', 'user-123')
      slugAggregate.uncommittedEvents = []

      // Act
      const snapshot = slugAggregate.toSnapshot()

      // Assert
      expect(snapshot.slug).toBe('test-product-slug')
      expect(snapshot.entityId).toBe('product-123')
      expect(snapshot.entityType).toBe('product')
      expect(snapshot.status).toBe('active')
    })

    test('should return correct snapshot for redirected slug', () => {
      // Arrange
      const slugAggregate = SlugAggregate.create(createValidSlugParams())
      slugAggregate.reserveSlug('product-123', 'product', 'user-123')
      slugAggregate.uncommittedEvents = []
      slugAggregate.markAsRedirect('new-slug', 'user-123')
      slugAggregate.uncommittedEvents = []

      // Act
      const snapshot = slugAggregate.toSnapshot()

      // Assert
      expect(snapshot.slug).toBe('test-product-slug')
      expect(snapshot.entityId).toBe('product-123')
      expect(snapshot.status).toBe('redirect')
    })

    test('should return correct snapshot for newly created slug', () => {
      // Arrange
      const slugAggregate = SlugAggregate.create(createValidSlugParams())

      // Act
      const snapshot = slugAggregate.toSnapshot()

      // Assert
      expect(snapshot.slug).toBe('test-product-slug')
      expect(snapshot.entityId).toBeNull()
      expect(snapshot.status).toBe('active')
    })
  })
})
