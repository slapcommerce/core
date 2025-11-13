import { describe, test, expect } from 'bun:test'
import { CollectionAggregate } from '../../../src/domain/collection/aggregate'
import { CollectionCreatedEvent, CollectionArchivedEvent, CollectionMetadataUpdatedEvent, CollectionPublishedEvent } from '../../../src/domain/collection/events'
import type { DomainEvent } from '../../../src/domain/_base/domainEvent'

function createValidCollectionParams() {
  return {
    id: 'collection-123',
    correlationId: 'correlation-123',
    name: 'Test Collection',
    description: 'A test collection' as string | null,
    slug: 'test-collection',
  }
}

describe('CollectionAggregate', () => {
  describe('create', () => {
    test('should create a new collection aggregate with draft status', () => {
      // Arrange
      const params = createValidCollectionParams()

      // Act
      const collection = CollectionAggregate.create(params)

      // Assert
      const snapshot = collection.toSnapshot()
      expect(collection.id).toBe(params.id)
      expect(snapshot.name).toBe(params.name)
      expect(snapshot.description).toBe(params.description)
      expect(snapshot.slug).toBe(params.slug)
      expect(snapshot.status).toBe('draft')
      expect(collection.version).toBe(0)
      expect(collection.events).toEqual([])
      expect(collection.uncommittedEvents).toHaveLength(1)
      const event = collection.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(CollectionCreatedEvent)
      expect(event.eventName).toBe('collection.created')
      expect(event.aggregateId).toBe(params.id)
      expect(event.correlationId).toBe(params.correlationId)
      expect(event.version).toBe(0)
    })

    test('should set createdAt and updatedAt to current time', () => {
      // Arrange
      const params = createValidCollectionParams()
      const beforeCreate = new Date()

      // Act
      const collection = CollectionAggregate.create(params)
      const afterCreate = new Date()

      // Assert
      const snapshot = collection.toSnapshot()
      expect(snapshot.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime())
      expect(snapshot.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime())
      expect(snapshot.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime())
      expect(snapshot.updatedAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime())
      expect(snapshot.createdAt.getTime()).toBe(snapshot.updatedAt.getTime())
    })

    test('should include all collection data in created event payload', () => {
      // Arrange
      const params = createValidCollectionParams()

      // Act
      const collection = CollectionAggregate.create(params)
      const event = collection.uncommittedEvents[0] as CollectionCreatedEvent

      // Assert
      expect(event.payload.priorState).toEqual({} as any)
      expect(event.payload.newState.name).toBe(params.name)
      expect(event.payload.newState.description).toBe(params.description)
      expect(event.payload.newState.slug).toBe(params.slug)
      expect(event.payload.newState.status).toBe('draft')
    })

    test('should create with null description', () => {
      // Arrange
      const params = createValidCollectionParams()
      params.description = null

      // Act
      const collection = CollectionAggregate.create(params)

      // Assert
      expect(collection.toSnapshot().description).toBeNull()
    })

    test('should create with description', () => {
      // Arrange
      const params = createValidCollectionParams()
      params.description = 'A detailed description'

      // Act
      const collection = CollectionAggregate.create(params)

      // Assert
      expect(collection.toSnapshot().description).toBe('A detailed description')
    })

    test('should verify priorState is empty object', () => {
      // Arrange
      const params = createValidCollectionParams()

      // Act
      const collection = CollectionAggregate.create(params)
      const event = collection.uncommittedEvents[0] as CollectionCreatedEvent

      // Assert
      expect(event.payload.priorState).toEqual({} as any)
    })

    test('should verify uncommittedEvents contains one event', () => {
      // Arrange
      const params = createValidCollectionParams()

      // Act
      const collection = CollectionAggregate.create(params)

      // Assert
      expect(collection.uncommittedEvents).toHaveLength(1)
      expect(collection.uncommittedEvents[0]).toBeInstanceOf(CollectionCreatedEvent)
    })
  })

  describe('archive', () => {
    test('should archive draft collection', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = [] // Clear creation event for this test

      // Act
      collection.archive()

      // Assert
      expect(collection.toSnapshot().status).toBe('archived')
      expect(collection.version).toBe(1)
      expect(collection.uncommittedEvents).toHaveLength(1)
      const event = collection.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(CollectionArchivedEvent)
      expect(event.eventName).toBe('collection.archived')
      expect(event.version).toBe(1)
    })

    test('should throw error when collection already archived', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []
      collection.archive()
      collection.uncommittedEvents = [] // Clear archive event

      // Act & Assert
      expect(() => collection.archive()).toThrow('Collection is already archived')
    })

    test('should update updatedAt when archiving', async () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []
      const snapshot = collection.toSnapshot()
      const originalUpdatedAt = snapshot.updatedAt
      
      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10))

      // Act
      collection.archive()

      // Assert
      expect(collection.toSnapshot().updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should include current state in archived event payload', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []

      // Act
      collection.archive()
      const event = collection.uncommittedEvents[0] as CollectionArchivedEvent

      // Assert
      expect(event.payload.newState.status).toBe('archived')
      const snapshot = collection.toSnapshot()
      expect(event.payload.newState.name).toBe(snapshot.name)
      expect(event.payload.newState.slug).toBe(snapshot.slug)
      expect(event.payload.priorState.status).toBe('draft')
    })

    test('should increment version when archiving', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []
      const initialVersion = collection.version

      // Act
      collection.archive()

      // Assert
      expect(collection.version).toBe(initialVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []

      // Act
      const result = collection.archive()

      // Assert
      expect(result).toBe(collection)
    })
  })

  describe('publish', () => {
    test('should publish draft collection', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = [] // Clear creation event for this test

      // Act
      collection.publish()

      // Assert
      expect(collection.toSnapshot().status).toBe('active')
      expect(collection.version).toBe(1)
      expect(collection.uncommittedEvents).toHaveLength(1)
      const event = collection.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(CollectionPublishedEvent)
      expect(event.eventName).toBe('collection.published')
      expect(event.version).toBe(1)
    })

    test('should throw error when trying to publish an archived collection', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []
      collection.archive()
      collection.uncommittedEvents = [] // Clear archive event

      // Act & Assert
      expect(() => collection.publish()).toThrow('Cannot publish an archived collection')
    })

    test('should throw error when collection already published', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []
      collection.publish()
      collection.uncommittedEvents = [] // Clear publish event

      // Act & Assert
      expect(() => collection.publish()).toThrow('Collection is already published')
    })

    test('should update updatedAt when publishing', async () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []
      const snapshot = collection.toSnapshot()
      const originalUpdatedAt = snapshot.updatedAt
      
      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10))

      // Act
      collection.publish()

      // Assert
      expect(collection.toSnapshot().updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should include current state in published event payload', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []

      // Act
      collection.publish()
      const event = collection.uncommittedEvents[0] as CollectionPublishedEvent

      // Assert
      expect(event.payload.newState.status).toBe('active')
      const snapshot = collection.toSnapshot()
      expect(event.payload.newState.name).toBe(snapshot.name)
      expect(event.payload.newState.slug).toBe(snapshot.slug)
      expect(event.payload.priorState.status).toBe('draft')
    })

    test('should increment version when publishing', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []
      const initialVersion = collection.version

      // Act
      collection.publish()

      // Assert
      expect(collection.version).toBe(initialVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []

      // Act
      const result = collection.publish()

      // Assert
      expect(result).toBe(collection)
    })
  })

  describe('updateMetadata', () => {
    test('should update name, description, and slug', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []
      const oldName = collection.toSnapshot().name
      const oldDescription = collection.toSnapshot().description
      const oldSlug = collection.toSnapshot().slug

      // Act
      collection.updateMetadata('New Name', 'New Description', 'new-slug')

      // Assert
      const snapshot = collection.toSnapshot()
      expect(snapshot.name).toBe('New Name')
      expect(snapshot.description).toBe('New Description')
      expect(snapshot.slug).toBe('new-slug')
      expect(collection.uncommittedEvents).toHaveLength(1)
      const event = collection.uncommittedEvents[0]!
      expect(event.eventName).toBe('collection.metadata_updated')
      if (event.eventName === 'collection.metadata_updated') {
        const metadataUpdatedEvent = event as CollectionMetadataUpdatedEvent
        expect(metadataUpdatedEvent.payload.priorState.name).toBe(oldName)
        expect(metadataUpdatedEvent.payload.newState.name).toBe('New Name')
        expect(metadataUpdatedEvent.payload.newState.description).toBe('New Description')
        expect(metadataUpdatedEvent.payload.newState.slug).toBe('new-slug')
      }
    })

    test('should update with null description', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []

      // Act
      collection.updateMetadata('New Name', null, 'new-slug')

      // Assert
      expect(collection.toSnapshot().description).toBeNull()
    })

    test('should update with description', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []

      // Act
      collection.updateMetadata('New Name', 'New Description', 'new-slug')

      // Assert
      expect(collection.toSnapshot().description).toBe('New Description')
    })

    test('should update updatedAt when updating metadata', async () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []
      const originalUpdatedAt = collection.toSnapshot().updatedAt
      
      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10))

      // Act
      collection.updateMetadata('New Name', 'New Description', 'new-slug')

      // Assert
      const newUpdatedAt = collection.toSnapshot().updatedAt
      expect(newUpdatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should increment version when updating metadata', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []
      const originalVersion = collection.version

      // Act
      collection.updateMetadata('New Name', 'New Description', 'new-slug')

      // Assert
      expect(collection.version).toBe(originalVersion + 1)
    })

    test('should include current state in metadata updated event', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []

      // Act
      collection.updateMetadata('New Name', 'New Description', 'new-slug')

      // Assert
      const event = collection.uncommittedEvents[0]!
      expect(event.version).toBe(1)
      expect(event.aggregateId).toBe(collection.id)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []

      // Act
      const result = collection.updateMetadata('New Name', 'New Description', 'new-slug')

      // Assert
      expect(result).toBe(collection)
    })
  })

  describe('apply', () => {
    test('should apply CollectionCreatedEvent and update state', () => {
      // Arrange
      const collectionId = 'collection-123'
      const correlationId = 'correlation-123'
      const occurredAt = new Date()
      const createdAt = occurredAt
      const createdEvent = new CollectionCreatedEvent({
        occurredAt,
        correlationId,
        aggregateId: collectionId,
        version: 0,
        priorState: {} as any,
        newState: {
          name: 'Created Collection',
          description: 'Created Description',
          slug: 'created-slug',
          status: 'active' as const,
          createdAt,
          updatedAt: createdAt,
        },
      })

      const collection = new CollectionAggregate({
        id: collectionId,
        correlationId,
        createdAt: new Date(),
        updatedAt: new Date(),
        name: '',
        description: null,
        slug: '',
        version: 0,
        events: [],
        status: 'active',
      })

      // Act
      collection.apply(createdEvent)

      // Assert
      expect(collection.toSnapshot().name).toBe('Created Collection')
      expect(collection.toSnapshot().description).toBe('Created Description')
      expect(collection.toSnapshot().slug).toBe('created-slug')
      expect(collection.toSnapshot().status).toBe('active')
      expect(collection.version).toBe(1)
      expect(collection.events).toHaveLength(1)
      expect(collection.events[0]).toBe(createdEvent)
    })

    test('should apply CollectionArchivedEvent and update state', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []
      const initialVersion = collection.version
      const occurredAt = new Date()
      const snapshot = collection.toSnapshot()
      const { id, version, ...priorState } = snapshot
      
      const archivedEvent = new CollectionArchivedEvent({
        occurredAt,
        correlationId: createValidCollectionParams().correlationId,
        aggregateId: collection.id,
        version: initialVersion + 1,
        priorState: priorState as any,
        newState: {
          ...priorState,
          status: 'archived' as const,
          updatedAt: occurredAt,
        } as any,
      })

      // Act
      collection.apply(archivedEvent)

      // Assert
      expect(collection.toSnapshot().status).toBe('archived')
      expect(collection.toSnapshot().updatedAt).toBe(occurredAt)
      expect(collection.version).toBe(initialVersion + 1)
      expect(collection.events).toHaveLength(1)
      expect(collection.events[0]).toBe(archivedEvent)
    })

    test('should apply CollectionMetadataUpdatedEvent and update metadata', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []
      const initialVersion = collection.version
      const occurredAt = new Date()
      const snapshot = collection.toSnapshot()
      const { id, version, ...priorState } = snapshot
      
      const metadataUpdatedEvent = new CollectionMetadataUpdatedEvent({
        occurredAt,
        correlationId: createValidCollectionParams().correlationId,
        aggregateId: collection.id,
        version: initialVersion + 1,
        priorState: priorState as any,
        newState: {
          ...priorState,
          name: 'Updated Name',
          description: 'Updated Description',
          slug: 'updated-slug',
          updatedAt: occurredAt,
        } as any,
      })

      // Act
      collection.apply(metadataUpdatedEvent)

      // Assert
      expect(collection.toSnapshot().name).toBe('Updated Name')
      expect(collection.toSnapshot().description).toBe('Updated Description')
      expect(collection.toSnapshot().slug).toBe('updated-slug')
      expect(collection.toSnapshot().updatedAt).toBe(occurredAt)
      expect(collection.version).toBe(initialVersion + 1)
      expect(collection.events).toHaveLength(1)
      expect(collection.events[0]).toBe(metadataUpdatedEvent)
    })

    test('should apply multiple events in sequence', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []
      const snapshot1 = collection.toSnapshot()
      const { id, version, ...priorState1 } = snapshot1
      
      const metadataUpdatedEvent = new CollectionMetadataUpdatedEvent({
        occurredAt: new Date(),
        correlationId: createValidCollectionParams().correlationId,
        aggregateId: collection.id,
        version: 1,
        priorState: priorState1 as any,
        newState: {
          ...priorState1,
          name: 'Updated Name',
          updatedAt: new Date(),
        } as any,
      })

      // Apply first event to get updated state
      collection.apply(metadataUpdatedEvent)
      const snapshot2 = collection.toSnapshot()
      const { id: id2, version: version2, ...priorState2 } = snapshot2

      const archivedEvent = new CollectionArchivedEvent({
        occurredAt: new Date(),
        correlationId: createValidCollectionParams().correlationId,
        aggregateId: collection.id,
        version: 2,
        priorState: priorState2 as any,
        newState: {
          ...priorState2,
          status: 'archived' as const,
          updatedAt: new Date(),
        } as any,
      })

      // Act
      collection.apply(archivedEvent)

      // Assert
      expect(collection.toSnapshot().status).toBe('archived')
      expect(collection.toSnapshot().name).toBe('Updated Name')
      expect(collection.version).toBe(2)
      expect(collection.events).toHaveLength(2)
      expect(collection.events[0]).toBe(metadataUpdatedEvent)
      expect(collection.events[1]).toBe(archivedEvent)
    })

    test('should throw error for unknown event type', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      const unknownEvent: DomainEvent<string, Record<string, unknown>> = {
        eventName: 'unknown.event',
        occurredAt: new Date(),
        correlationId: 'test',
        aggregateId: 'test',
        version: 1,
        payload: {},
      }

      // Act & Assert
      expect(() => collection.apply(unknownEvent)).toThrow('Unknown event type: unknown.event')
    })

    test('should increment version when applying event', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []
      const initialVersion = collection.version
      const snapshot = collection.toSnapshot()
      const { id, version, ...priorState } = snapshot
      
      const archivedEvent = new CollectionArchivedEvent({
        occurredAt: new Date(),
        correlationId: createValidCollectionParams().correlationId,
        aggregateId: collection.id,
        version: initialVersion + 1,
        priorState: priorState as any,
        newState: {
          ...priorState,
          status: 'archived' as const,
          updatedAt: new Date(),
        } as any,
      })

      // Act
      collection.apply(archivedEvent)

      // Assert
      expect(collection.version).toBe(initialVersion + 1)
    })

    test('should add event to events array when applying', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []
      expect(collection.events).toHaveLength(0)
      const snapshot = collection.toSnapshot()
      const { id, version, ...priorState } = snapshot
      
      const archivedEvent = new CollectionArchivedEvent({
        occurredAt: new Date(),
        correlationId: createValidCollectionParams().correlationId,
        aggregateId: collection.id,
        version: 1,
        priorState: priorState as any,
        newState: {
          ...priorState,
          status: 'archived' as const,
          updatedAt: new Date(),
        } as any,
      })

      // Act
      collection.apply(archivedEvent)

      // Assert
      expect(collection.events).toHaveLength(1)
      expect(collection.events[0]).toBe(archivedEvent)
    })
  })

  describe('loadFromSnapshot', () => {
    test('should load collection from snapshot', () => {
      // Arrange
      const snapshot = {
        aggregate_id: 'collection-123',
        correlation_id: 'correlation-123',
        version: 5,
        payload: JSON.stringify({
          name: 'Snapshot Collection',
          description: 'A collection from snapshot',
          slug: 'snapshot-collection',
          status: 'active',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        }),
      }

      // Act
      const collection = CollectionAggregate.loadFromSnapshot(snapshot)

      // Assert
      const collectionSnapshot = collection.toSnapshot()
      expect(collection.id).toBe('collection-123')
      expect(collectionSnapshot.name).toBe('Snapshot Collection')
      expect(collectionSnapshot.description).toBe('A collection from snapshot')
      expect(collectionSnapshot.slug).toBe('snapshot-collection')
      expect(collectionSnapshot.status).toBe('active')
      expect(collection.version).toBe(5)
      expect(collection.events).toEqual([])
    })

    test('should handle null description in snapshot', () => {
      // Arrange
      const snapshot = {
        aggregate_id: 'collection-123',
        correlation_id: 'correlation-123',
        version: 0,
        payload: JSON.stringify({
          name: 'Test Collection',
          description: null,
          slug: 'test-collection',
          status: 'active',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        }),
      }

      // Act
      const collection = CollectionAggregate.loadFromSnapshot(snapshot)

      // Assert
      expect(collection.toSnapshot().description).toBeNull()
    })

    test('should parse dates correctly from snapshot', () => {
      // Arrange
      const createdAt = '2024-01-01T12:00:00.000Z'
      const updatedAt = '2024-01-02T12:00:00.000Z'
      
      const snapshot = {
        aggregate_id: 'collection-123',
        correlation_id: 'correlation-123',
        version: 1,
        payload: JSON.stringify({
          name: 'Test',
          description: 'Test',
          slug: 'test',
          status: 'active',
          createdAt,
          updatedAt,
        }),
      }

      // Act
      const collection = CollectionAggregate.loadFromSnapshot(snapshot)

      // Assert
      const collectionSnapshot = collection.toSnapshot()
      expect(collectionSnapshot.createdAt).toEqual(new Date(createdAt))
      expect(collectionSnapshot.updatedAt).toEqual(new Date(updatedAt))
    })

    test('should load archived collection', () => {
      // Arrange
      const snapshot = {
        aggregate_id: 'collection-123',
        correlation_id: 'correlation-123',
        version: 1,
        payload: JSON.stringify({
          name: 'Archived Collection',
          description: 'An archived collection',
          slug: 'archived-collection',
          status: 'archived',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        }),
      }

      // Act
      const collection = CollectionAggregate.loadFromSnapshot(snapshot)

      // Assert
      expect(collection.toSnapshot().status).toBe('archived')
    })

    test('should load active collection', () => {
      // Arrange
      const snapshot = {
        aggregate_id: 'collection-123',
        correlation_id: 'correlation-123',
        version: 0,
        payload: JSON.stringify({
          name: 'Active Collection',
          description: 'An active collection',
          slug: 'active-collection',
          status: 'active',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        }),
      }

      // Act
      const collection = CollectionAggregate.loadFromSnapshot(snapshot)

      // Assert
      expect(collection.toSnapshot().status).toBe('active')
    })

    test('should initialize events array as empty', () => {
      // Arrange
      const snapshot = {
        aggregate_id: 'collection-123',
        correlation_id: 'correlation-123',
        version: 10,
        payload: JSON.stringify({
          name: 'Test',
          description: 'Test',
          slug: 'test',
          status: 'active',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        }),
      }

      // Act
      const collection = CollectionAggregate.loadFromSnapshot(snapshot)

      // Assert
      expect(collection.events).toEqual([])
    })
  })

  describe('toSnapshot', () => {
    test('should return complete snapshot of collection state', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())

      // Act
      const snapshot = collection.toSnapshot()

      // Assert
      const params = createValidCollectionParams()
      expect(snapshot.id).toBe(collection.id)
      expect(snapshot.name).toBe(params.name)
      expect(snapshot.description).toBe(params.description)
      expect(snapshot.slug).toBe(params.slug)
      expect(snapshot.status).toBe('draft')
      expect(snapshot.version).toBe(collection.version)
    })

    test('should handle null description in snapshot', () => {
      // Arrange
      const params = createValidCollectionParams()
      params.description = null
      const collection = CollectionAggregate.create(params)

      // Act
      const snapshot = collection.toSnapshot()

      // Assert
      expect(snapshot.description).toBeNull()
    })

    test('should include current version in snapshot', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []
      collection.archive()

      // Act
      const snapshot = collection.toSnapshot()

      // Assert
      expect(snapshot.version).toBe(1)
    })

    test('should include all fields in snapshot', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())

      // Act
      const snapshot = collection.toSnapshot()

      // Assert
      expect(snapshot).toHaveProperty('id')
      expect(snapshot).toHaveProperty('name')
      expect(snapshot).toHaveProperty('description')
      expect(snapshot).toHaveProperty('slug')
      expect(snapshot).toHaveProperty('status')
      expect(snapshot).toHaveProperty('createdAt')
      expect(snapshot).toHaveProperty('updatedAt')
      expect(snapshot).toHaveProperty('version')
    })
  })

  describe('state transitions', () => {
    test('should transition from draft to archived via archive', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []

      // Act
      collection.archive()

      // Assert
      expect(collection.toSnapshot().status).toBe('archived')
    })

    test('should not allow transition from archived to archived', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []
      collection.archive()
      collection.uncommittedEvents = []

      // Act & Assert
      expect(() => collection.archive()).toThrow('Collection is already archived')
    })
  })

  describe('version management', () => {
    test('should start with version 0', () => {
      // Arrange & Act
      const collection = CollectionAggregate.create(createValidCollectionParams())

      // Assert
      expect(collection.version).toBe(0)
    })

    test('should increment version on archive', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []

      // Act
      collection.archive()

      // Assert
      expect(collection.version).toBe(1)
    })

    test('should increment version on updateMetadata', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []

      // Act
      collection.updateMetadata('New Name', 'New Description', 'new-slug')

      // Assert
      expect(collection.version).toBe(1)
    })

    test('should increment version on apply', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []
      const snapshot = collection.toSnapshot()
      const { id, version, ...priorState } = snapshot
      
      const archivedEvent = new CollectionArchivedEvent({
        occurredAt: new Date(),
        correlationId: createValidCollectionParams().correlationId,
        aggregateId: collection.id,
        version: 1,
        priorState: priorState as any,
        newState: {
          ...priorState,
          status: 'archived' as const,
          updatedAt: new Date(),
        } as any,
      })

      // Act
      collection.apply(archivedEvent)

      // Assert
      expect(collection.version).toBe(1)
    })

    test('should track version correctly through multiple operations', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []

      // Act
      collection.updateMetadata('New Name', 'New Description', 'new-slug')
      collection.uncommittedEvents = []
      collection.archive()

      // Assert
      expect(collection.version).toBe(2)
    })
  })

  describe('uncommittedEvents', () => {
    test('should accumulate uncommitted events', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []

      // Act
      collection.updateMetadata('New Name', 'New Description', 'new-slug')
      collection.archive()

      // Assert
      expect(collection.uncommittedEvents).toHaveLength(2)
      expect(collection.uncommittedEvents[0]).toBeInstanceOf(CollectionMetadataUpdatedEvent)
      expect(collection.uncommittedEvents[1]).toBeInstanceOf(CollectionArchivedEvent)
    })

    test('should not add events to uncommittedEvents when applying', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []
      const snapshot = collection.toSnapshot()
      const { id, version, ...priorState } = snapshot
      
      const archivedEvent = new CollectionArchivedEvent({
        occurredAt: new Date(),
        correlationId: createValidCollectionParams().correlationId,
        aggregateId: collection.id,
        version: 1,
        priorState: priorState as any,
        newState: {
          ...priorState,
          status: 'archived' as const,
          updatedAt: new Date(),
        } as any,
      })

      // Act
      collection.apply(archivedEvent)

      // Assert
      expect(collection.uncommittedEvents).toHaveLength(0)
      expect(collection.events).toHaveLength(1)
    })

    test('should preserve event order', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []

      // Act
      collection.updateMetadata('New Name', 'New Description', 'new-slug')
      collection.archive()

      // Assert
      expect(collection.uncommittedEvents).toHaveLength(2)
      const metadataEvent = collection.uncommittedEvents[0]!
      const archiveEvent = collection.uncommittedEvents[1]!
      expect(metadataEvent.eventName).toBe('collection.metadata_updated')
      expect(archiveEvent.eventName).toBe('collection.archived')
      expect(metadataEvent.version).toBe(1)
      expect(archiveEvent.version).toBe(2)
    })
  })
})

