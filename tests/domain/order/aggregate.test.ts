import { describe, test, expect } from 'bun:test'
import { randomUUIDv7 } from 'bun'
import { OrderAggregate } from '../../../src/domain/order/aggregate'
import { OrderCreatedEvent } from '../../../src/domain/order/events'

function createValidOrderParams() {
  return {
    id: randomUUIDv7(),
    correlationId: randomUUIDv7(),
    userId: randomUUIDv7(),
  }
}

describe('OrderAggregate', () => {
  describe('create', () => {
    test('should create a new order aggregate', () => {
      // Arrange
      const params = createValidOrderParams()

      // Act
      const order = OrderAggregate.create(params)

      // Assert
      const snapshot = order.toSnapshot()
      expect(order.id).toBe(params.id)

      expect(snapshot.status).toBe('draft')
      expect(order.version).toBe(0)
      expect(order.events).toEqual([])
      expect(order.uncommittedEvents).toHaveLength(1)

      const event = order.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(OrderCreatedEvent)
      expect(event.eventName).toBe('order.created')
      expect(event.aggregateId).toBe(params.id)
      expect(event.correlationId).toBe(params.correlationId)
      expect(event.version).toBe(0)
    })

    test('should set createdAt and updatedAt to current time', () => {
      // Arrange
      const params = createValidOrderParams()
      const beforeCreate = new Date()

      // Act
      const order = OrderAggregate.create(params)
      const afterCreate = new Date()

      // Assert
      const snapshot = order.toSnapshot()
      expect(snapshot.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime())
      expect(snapshot.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime())
      expect(snapshot.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime())
      expect(snapshot.updatedAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime())
      expect(snapshot.createdAt.getTime()).toBe(snapshot.updatedAt.getTime())
    })

    test('should include all order data in created event payload', () => {
      // Arrange
      const params = createValidOrderParams()

      // Act
      const order = OrderAggregate.create(params)

      // Assert
      const event = order.uncommittedEvents[0] as OrderCreatedEvent
      expect(event.payload.priorState).toEqual({})
      expect(event.payload.newState.id).toBe(params.id)
      expect(event.payload.newState.correlationId).toBe(params.correlationId)

    })
  })

  describe('loadFromSnapshot', () => {
    test('should load aggregate from snapshot', () => {
      // Arrange
      const params = createValidOrderParams()
      const originalOrder = OrderAggregate.create(params)
      const snapshot = {
        aggregate_id: originalOrder.id,
        correlation_id: params.correlationId,
        version: 0,
        payload: JSON.stringify(originalOrder.toSnapshot()),
      }

      // Act
      const loadedOrder = OrderAggregate.loadFromSnapshot(snapshot)

      // Assert
      const loadedSnapshot = loadedOrder.toSnapshot()
      const originalSnapshot = originalOrder.toSnapshot()
      expect(loadedSnapshot.id).toBe(originalSnapshot.id)
      expect(loadedSnapshot.correlationId).toBe(originalSnapshot.correlationId)

    })
  })
})
