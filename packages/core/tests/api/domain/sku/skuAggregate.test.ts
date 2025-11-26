import { describe, test, expect } from 'bun:test'
import { SkuAggregate } from '../../../../src/api/domain/sku/skuAggregate'
import { SkuReservedEvent, SkuReleasedEvent } from '../../../../src/api/domain/sku/skuEvents'

function createValidSkuParams() {
  return {
    sku: 'SKU-123',
    correlationId: 'correlation-123',
  }
}

describe('SkuAggregate', () => {
  describe('create', () => {
    test('should create a new SKU aggregate with active status and null variantId', () => {
      // Arrange
      const params = createValidSkuParams()

      // Act
      const skuAggregate = SkuAggregate.create(params)

      // Assert
      expect(skuAggregate.id).toBe(params.sku)
      expect(skuAggregate.version).toBe(0)
      expect(skuAggregate.events).toEqual([])
      expect(skuAggregate.uncommittedEvents).toEqual([])

      const snapshot = skuAggregate.toSnapshot()
      expect(snapshot.sku).toBe(params.sku)
      expect(snapshot.variantId).toBeNull()
      expect(snapshot.status).toBe('active')
    })
  })

  describe('isSkuAvailable', () => {
    test('should return true when variantId is null', () => {
      // Arrange
      const skuAggregate = SkuAggregate.create(createValidSkuParams())

      // Act
      const isAvailable = skuAggregate.isSkuAvailable()

      // Assert
      expect(isAvailable).toBe(true)
    })

    test('should return false when variantId is not null', () => {
      // Arrange
      const skuAggregate = SkuAggregate.create(createValidSkuParams())
      skuAggregate.reserveSku('variant-123', 'user-123')
      skuAggregate.uncommittedEvents = []

      // Act
      const isAvailable = skuAggregate.isSkuAvailable()

      // Assert
      expect(isAvailable).toBe(false)
    })
  })

  describe('reserveSku', () => {
    test('should reserve SKU for a variant', () => {
      // Arrange
      const skuAggregate = SkuAggregate.create(createValidSkuParams())
      const variantId = 'variant-123'

      // Act
      skuAggregate.reserveSku(variantId, 'user-123')

      // Assert
      const snapshot = skuAggregate.toSnapshot()
      expect(snapshot.variantId).toBe(variantId)
      expect(snapshot.status).toBe('active')
      expect(skuAggregate.version).toBe(1)
      expect(skuAggregate.uncommittedEvents).toHaveLength(1)

      const event = skuAggregate.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(SkuReservedEvent)
      const reservedEvent = event as SkuReservedEvent
      expect(event.eventName).toBe('sku.reserved')
      expect(event.aggregateId).toBe(skuAggregate.id)
      expect(event.correlationId).toBe(createValidSkuParams().correlationId)
      expect(event.version).toBe(1)
      expect(reservedEvent.payload.newState.variantId).toBe(variantId)
      expect(reservedEvent.payload.newState.status).toBe('active')
      expect(reservedEvent.payload.priorState.variantId).toBeNull()
      expect(reservedEvent.payload.priorState.status).toBe('active')
    })

    test('should throw error when SKU is already reserved', () => {
      // Arrange
      const skuAggregate = SkuAggregate.create(createValidSkuParams())
      skuAggregate.reserveSku('variant-123', 'user-123')
      skuAggregate.uncommittedEvents = []

      // Act & Assert
      expect(() => skuAggregate.reserveSku('variant-456', 'user-123')).toThrow('SKU "SKU-123" is already in use')
    })

    test('should allow reserving a released SKU', () => {
      // Arrange
      const skuAggregate = SkuAggregate.create(createValidSkuParams())
      skuAggregate.reserveSku('variant-123', 'user-123')
      skuAggregate.uncommittedEvents = []
      skuAggregate.releaseSku('user-123')
      skuAggregate.uncommittedEvents = []

      // Act
      skuAggregate.reserveSku('variant-456', 'user-123')

      // Assert
      const snapshot = skuAggregate.toSnapshot()
      expect(snapshot.variantId).toBe('variant-456')
      expect(snapshot.status).toBe('active')
      expect(skuAggregate.uncommittedEvents).toHaveLength(1)
      const event = skuAggregate.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(SkuReservedEvent)
      const reservedEvent = event as SkuReservedEvent
      expect(reservedEvent.payload.newState.variantId).toBe('variant-456')
    })
  })

  describe('releaseSku', () => {
    test('should release SKU and set variantId to null', () => {
      // Arrange
      const skuAggregate = SkuAggregate.create(createValidSkuParams())
      skuAggregate.reserveSku('variant-123', 'user-123')
      skuAggregate.uncommittedEvents = []

      // Act
      skuAggregate.releaseSku('user-123')

      // Assert
      const snapshot = skuAggregate.toSnapshot()
      expect(snapshot.variantId).toBeNull()
      expect(snapshot.status).toBe('released')
      expect(skuAggregate.version).toBe(2)
      expect(skuAggregate.uncommittedEvents).toHaveLength(1)
      
      const event = skuAggregate.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(SkuReleasedEvent)
      const releasedEvent = event as SkuReleasedEvent
      expect(event.eventName).toBe('sku.released')
      expect(event.aggregateId).toBe(skuAggregate.id)
      expect(event.correlationId).toBe(createValidSkuParams().correlationId)
      expect(event.version).toBe(2)
      expect(releasedEvent.payload.newState.variantId).toBeNull()
      expect(releasedEvent.payload.newState.status).toBe('released')
      expect(releasedEvent.payload.priorState.variantId).toBe('variant-123')
      expect(releasedEvent.payload.priorState.status).toBe('active')
    })

    test('should be idempotent when already released', () => {
      // Arrange
      const skuAggregate = SkuAggregate.create(createValidSkuParams())
      skuAggregate.reserveSku('variant-123', 'user-123')
      skuAggregate.uncommittedEvents = []
      skuAggregate.releaseSku('user-123')
      skuAggregate.uncommittedEvents = []
      const versionBefore = skuAggregate.version

      // Act
      skuAggregate.releaseSku('user-123')

      // Assert
      expect(skuAggregate.version).toBe(versionBefore)
      expect(skuAggregate.uncommittedEvents).toHaveLength(0)
      const snapshot = skuAggregate.toSnapshot()
      expect(snapshot.status).toBe('released')
      expect(snapshot.variantId).toBeNull()
    })

    test('should release SKU that was never reserved', () => {
      // Arrange
      const skuAggregate = SkuAggregate.create(createValidSkuParams())

      // Act
      skuAggregate.releaseSku('user-123')

      // Assert
      const snapshot = skuAggregate.toSnapshot()
      expect(snapshot.variantId).toBeNull()
      expect(snapshot.status).toBe('released')
      expect(skuAggregate.version).toBe(1)
      expect(skuAggregate.uncommittedEvents).toHaveLength(1)
    })
  })

  describe('loadFromSnapshot', () => {
    test('should load SKU aggregate from snapshot', () => {
      // Arrange
      const snapshot = {
        aggregateId: 'SKU-123',
        correlationId: 'correlation-123',
        version: 5,
        payload: JSON.stringify({
          sku: 'SKU-123',
          variantId: 'variant-123',
          status: 'active',
        }),
      }

      // Act
      const skuAggregate = SkuAggregate.loadFromSnapshot(snapshot)

      // Assert
      expect(skuAggregate.id).toBe('SKU-123')
      expect(skuAggregate.version).toBe(5)
      expect(skuAggregate.events).toEqual([])
      
      const aggregateSnapshot = skuAggregate.toSnapshot()
      expect(aggregateSnapshot.sku).toBe('SKU-123')
      expect(aggregateSnapshot.variantId).toBe('variant-123')
      expect(aggregateSnapshot.status).toBe('active')
    })

    test('should load SKU aggregate from snapshot with null variantId', () => {
      // Arrange
      const snapshot = {
        aggregateId: 'SKU-123',
        correlationId: 'correlation-123',
        version: 0,
        payload: JSON.stringify({
          sku: 'SKU-123',
          variantId: null,
          status: 'active',
        }),
      }

      // Act
      const skuAggregate = SkuAggregate.loadFromSnapshot(snapshot)

      // Assert
      const aggregateSnapshot = skuAggregate.toSnapshot()
      expect(aggregateSnapshot.variantId).toBeNull()
      expect(aggregateSnapshot.status).toBe('active')
    })

    test('should load SKU aggregate from snapshot with released status', () => {
      // Arrange
      const snapshot = {
        aggregateId: 'SKU-123',
        correlationId: 'correlation-123',
        version: 3,
        payload: JSON.stringify({
          sku: 'SKU-123',
          variantId: null,
          status: 'released',
        }),
      }

      // Act
      const skuAggregate = SkuAggregate.loadFromSnapshot(snapshot)

      // Assert
      const aggregateSnapshot = skuAggregate.toSnapshot()
      expect(aggregateSnapshot.status).toBe('released')
      expect(aggregateSnapshot.variantId).toBeNull()
    })

    test('should default status to active when not provided', () => {
      // Arrange
      const snapshot = {
        aggregateId: 'SKU-123',
        correlationId: 'correlation-123',
        version: 1,
        payload: JSON.stringify({
          sku: 'SKU-123',
          variantId: null,
        }),
      }

      // Act
      const skuAggregate = SkuAggregate.loadFromSnapshot(snapshot)

      // Assert
      const aggregateSnapshot = skuAggregate.toSnapshot()
      expect(aggregateSnapshot.status).toBe('active')
    })

    test('should default variantId to null when not provided', () => {
      // Arrange
      const snapshot = {
        aggregateId: 'SKU-123',
        correlationId: 'correlation-123',
        version: 1,
        payload: JSON.stringify({
          sku: 'SKU-123',
          status: 'active',
        }),
      }

      // Act
      const skuAggregate = SkuAggregate.loadFromSnapshot(snapshot)

      // Assert
      const aggregateSnapshot = skuAggregate.toSnapshot()
      expect(aggregateSnapshot.variantId).toBeNull()
    })
  })

  describe('toSnapshot', () => {
    test('should return correct snapshot for active SKU', () => {
      // Arrange
      const skuAggregate = SkuAggregate.create(createValidSkuParams())
      skuAggregate.reserveSku('variant-123', 'user-123')
      skuAggregate.uncommittedEvents = []

      // Act
      const snapshot = skuAggregate.toSnapshot()

      // Assert
      expect(snapshot.sku).toBe('SKU-123')
      expect(snapshot.variantId).toBe('variant-123')
      expect(snapshot.status).toBe('active')
    })

    test('should return correct snapshot for released SKU', () => {
      // Arrange
      const skuAggregate = SkuAggregate.create(createValidSkuParams())
      skuAggregate.releaseSku('user-123')
      skuAggregate.uncommittedEvents = []

      // Act
      const snapshot = skuAggregate.toSnapshot()

      // Assert
      expect(snapshot.sku).toBe('SKU-123')
      expect(snapshot.variantId).toBeNull()
      expect(snapshot.status).toBe('released')
    })

    test('should return correct snapshot for newly created SKU', () => {
      // Arrange
      const skuAggregate = SkuAggregate.create(createValidSkuParams())

      // Act
      const snapshot = skuAggregate.toSnapshot()

      // Assert
      expect(snapshot.sku).toBe('SKU-123')
      expect(snapshot.variantId).toBeNull()
      expect(snapshot.status).toBe('active')
    })
  })
})

