import { describe, test, expect } from 'bun:test'
import { CollectionAggregate } from '../../../src/domain/collection/aggregate'
import { CollectionCreatedEvent, CollectionArchivedEvent, CollectionMetadataUpdatedEvent, CollectionPublishedEvent, CollectionSeoMetadataUpdatedEvent, CollectionUnpublishedEvent, CollectionImagesUpdatedEvent } from '../../../src/domain/collection/events'
import { ImageCollection } from '../../../src/domain/_base/imageCollection'
import type { ImageUploadResult } from '../../../src/infrastructure/adapters/imageStorageAdapter'
import type { DomainEvent } from '../../../src/domain/_base/domainEvent'

function createMockImageUploadResult(imageId: string): ImageUploadResult {
  return {
    imageId,
    urls: {
      original: { original: `https://example.com/${imageId}/original.jpg`, webp: "", avif: "" },
      thumbnail: { original: `https://example.com/${imageId}/thumbnail.jpg`, webp: "", avif: "" },
      small: { original: `https://example.com/${imageId}/small.jpg`, webp: "", avif: "" },
      medium: { original: `https://example.com/${imageId}/medium.jpg`, webp: "", avif: "" },
      large: { original: `https://example.com/${imageId}/large.jpg`, webp: "", avif: "" },
    },
  }
}

function createValidCollectionParams() {
  return {
    id: 'collection-123',
    correlationId: 'correlation-123',
    userId: 'user-123',
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
      expect(event.payload.newState.metaTitle).toBe('')
      expect(event.payload.newState.metaDescription).toBe('')
      expect(event.payload.newState.publishedAt).toBeNull()
      expect(event.payload.newState.images.isEmpty()).toBe(true)
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
      collection.archive('user-123')

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
      collection.archive('user-123')
      collection.uncommittedEvents = [] // Clear archive event

      // Act & Assert
      expect(() => collection.archive('user-123')).toThrow('Collection is already archived')
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
      collection.archive('user-123')

      // Assert
      expect(collection.toSnapshot().updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should include current state in archived event payload', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []

      // Act
      collection.archive('user-123')
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
      collection.archive('user-123')

      // Assert
      expect(collection.version).toBe(initialVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []

      // Act
      const result = collection.archive('user-123')

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
      collection.publish('user-123')

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
      collection.archive('user-123')
      collection.uncommittedEvents = [] // Clear archive event

      // Act & Assert
      expect(() => collection.publish('user-123')).toThrow('Cannot publish an archived collection')
    })

    test('should throw error when collection already published', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []
      collection.publish('user-123')
      collection.uncommittedEvents = [] // Clear publish event

      // Act & Assert
      expect(() => collection.publish('user-123')).toThrow('Collection is already published')
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
      collection.publish('user-123')

      // Assert
      expect(collection.toSnapshot().updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should set publishedAt when publishing', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []
      expect(collection.toSnapshot().publishedAt).toBeNull()

      // Act
      collection.publish('user-123')

      // Assert
      const snapshot = collection.toSnapshot()
      expect(snapshot.publishedAt).not.toBeNull()
      expect(snapshot.publishedAt).toBeInstanceOf(Date)
      const event = collection.uncommittedEvents[0] as CollectionPublishedEvent
      expect(event.payload.newState.publishedAt).not.toBeNull()
    })

    test('should include current state in published event payload', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []

      // Act
      collection.publish('user-123')
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
      collection.publish('user-123')

      // Assert
      expect(collection.version).toBe(initialVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []

      // Act
      const result = collection.publish('user-123')

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
      collection.updateMetadata('New Name', 'New Description', 'new-slug', 'user-123')

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
      collection.updateMetadata('New Name', null, 'new-slug', 'user-123')

      // Assert
      expect(collection.toSnapshot().description).toBeNull()
    })

    test('should update with description', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []

      // Act
      collection.updateMetadata('New Name', 'New Description', 'new-slug', 'user-123')

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
      collection.updateMetadata('New Name', 'New Description', 'new-slug', 'user-123')

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
      collection.updateMetadata('New Name', 'New Description', 'new-slug', 'user-123')

      // Assert
      expect(collection.version).toBe(originalVersion + 1)
    })

    test('should include current state in metadata updated event', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []

      // Act
      collection.updateMetadata('New Name', 'New Description', 'new-slug', 'user-123')

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
      const result = collection.updateMetadata('New Name', 'New Description', 'new-slug', 'user-123')

      // Assert
      expect(result).toBe(collection)
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
          metaTitle: '',
          metaDescription: '',
          publishedAt: null,
          imageUrls: null,
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
          metaTitle: '',
          metaDescription: '',
          publishedAt: null,
          imageUrls: null,
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
          metaTitle: '',
          metaDescription: '',
          publishedAt: null,
          imageUrls: null,
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
          metaTitle: '',
          metaDescription: '',
          publishedAt: null,
          imageUrls: null,
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
          metaTitle: '',
          metaDescription: '',
          publishedAt: null,
          imageUrls: null,
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
          metaTitle: '',
          metaDescription: '',
          publishedAt: null,
          imageUrls: null,
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
      collection.archive('user-123')

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
      expect(snapshot).toHaveProperty('metaTitle')
      expect(snapshot).toHaveProperty('metaDescription')
      expect(snapshot).toHaveProperty('publishedAt')
      expect(snapshot).toHaveProperty('images')
      expect(Array.isArray(snapshot.images)).toBe(true)
    })
  })

  describe('unpublish', () => {
    test('should unpublish active collection (active → draft)', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []
      collection.publish('user-123')
      collection.uncommittedEvents = []
      expect(collection.toSnapshot().status).toBe('active')
      expect(collection.toSnapshot().publishedAt).not.toBeNull()

      // Act
      collection.unpublish('user-123')

      // Assert
      const snapshot = collection.toSnapshot()
      expect(snapshot.status).toBe('draft')
      expect(snapshot.publishedAt).toBeNull()
      expect(collection.version).toBe(2)
      expect(collection.uncommittedEvents).toHaveLength(1)
      const event = collection.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(CollectionUnpublishedEvent)
      expect(event.eventName).toBe('collection.unpublished')
      expect(event.version).toBe(2)
    })

    test('should throw error when trying to unpublish an archived collection', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []
      collection.archive('user-123')
      collection.uncommittedEvents = []

      // Act & Assert
      expect(() => collection.unpublish('user-123')).toThrow('Cannot unpublish an archived collection')
    })

    test('should throw error when collection already unpublished', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []

      // Act & Assert
      expect(() => collection.unpublish('user-123')).toThrow('Collection is already unpublished')
    })

    test('should update updatedAt when unpublishing', async () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []
      collection.publish('user-123')
      collection.uncommittedEvents = []
      const snapshot = collection.toSnapshot()
      const originalUpdatedAt = snapshot.updatedAt

      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10))

      // Act
      collection.unpublish('user-123')

      // Assert
      expect(collection.toSnapshot().updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should return self for method chaining', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []
      collection.publish('user-123')
      collection.uncommittedEvents = []

      // Act
      const result = collection.unpublish('user-123')

      // Assert
      expect(result).toBe(collection)
    })
  })

  describe('updateSeoMetadata', () => {
    test('should update SEO metadata', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []
      expect(collection.toSnapshot().metaTitle).toBe('')
      expect(collection.toSnapshot().metaDescription).toBe('')

      // Act
      collection.updateSeoMetadata('New Meta Title', 'New Meta Description', 'user-123')

      // Assert
      const snapshot = collection.toSnapshot()
      expect(snapshot.metaTitle).toBe('New Meta Title')
      expect(snapshot.metaDescription).toBe('New Meta Description')
      expect(collection.version).toBe(1)
      expect(collection.uncommittedEvents).toHaveLength(1)
      const event = collection.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(CollectionSeoMetadataUpdatedEvent)
      expect(event.eventName).toBe('collection.seo_metadata_updated')
    })

    test('should update updatedAt when updating SEO metadata', async () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []
      const originalUpdatedAt = collection.toSnapshot().updatedAt
      
      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10))

      // Act
      collection.updateSeoMetadata('Title', 'Description', 'user-123')

      // Assert
      expect(collection.toSnapshot().updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should return self for method chaining', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []

      // Act
      const result = collection.updateSeoMetadata('Title', 'Description', 'user-123')

      // Assert
      expect(result).toBe(collection)
    })
  })

  describe('updateImages', () => {
    test('should update images with new collection', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []
      expect(collection.toSnapshot().images).toHaveLength(0)

      // Act
      const uploadResult = createMockImageUploadResult('img-1')
      const images = ImageCollection.empty().addImage(uploadResult, 'Test image')
      collection.updateImages(images, 'user-123')

      // Assert
      const snapshot = collection.toSnapshot()
      expect(snapshot.images).toHaveLength(1)
      expect(snapshot.images[0]?.imageId).toBe('img-1')
      expect(snapshot.images[0]?.altText).toBe('Test image')
      expect(collection.version).toBe(1)
      expect(collection.uncommittedEvents).toHaveLength(1)
      const event = collection.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(CollectionImagesUpdatedEvent)
      expect(event.eventName).toBe('collection.images_updated')
    })

    test('should update images with multiple images', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []
      let images = ImageCollection.empty()
      images = images.addImage(createMockImageUploadResult('img-1'), 'First')
      images = images.addImage(createMockImageUploadResult('img-2'), 'Second')

      // Act
      collection.updateImages(images, 'user-123')

      // Assert
      const snapshot = collection.toSnapshot()
      expect(snapshot.images).toHaveLength(2)
      expect(snapshot.images[0]?.imageId).toBe('img-1')
      expect(snapshot.images[1]?.imageId).toBe('img-2')
    })

    test('should set images to empty collection', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []
      let images = ImageCollection.empty().addImage(createMockImageUploadResult('img-1'), 'Test')
      collection.updateImages(images, 'user-123')
      collection.uncommittedEvents = []

      // Act
      collection.updateImages(ImageCollection.empty(), 'user-123')

      // Assert
      expect(collection.toSnapshot().images).toHaveLength(0)
    })

    test('should update updatedAt when updating images', async () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []
      const originalUpdatedAt = collection.toSnapshot().updatedAt

      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10))

      // Act
      const uploadResult = createMockImageUploadResult('img-1')
      const images = ImageCollection.empty().addImage(uploadResult, 'Test image')
      collection.updateImages(images, 'user-123')

      // Assert
      expect(collection.toSnapshot().updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should return self for method chaining', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []

      // Act
      const uploadResult = createMockImageUploadResult('img-1')
      const images = ImageCollection.empty().addImage(uploadResult, 'Test image')
      const result = collection.updateImages(images, 'user-123')

      // Assert
      expect(result).toBe(collection)
    })
  })

  describe('state transitions', () => {
    test('should transition from draft to archived via archive', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []

      // Act
      collection.archive('user-123')

      // Assert
      expect(collection.toSnapshot().status).toBe('archived')
    })

    test('should not allow transition from archived to archived', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []
      collection.archive('user-123')
      collection.uncommittedEvents = []

      // Act & Assert
      expect(() => collection.archive('user-123')).toThrow('Collection is already archived')
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
      collection.archive('user-123')

      // Assert
      expect(collection.version).toBe(1)
    })

    test('should increment version on updateMetadata', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []

      // Act
      collection.updateMetadata('New Name', 'New Description', 'new-slug', 'user-123')

      // Assert
      expect(collection.version).toBe(1)
    })

    test('should track version correctly through multiple operations', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []

      // Act
      collection.updateMetadata('New Name', 'New Description', 'new-slug', 'user-123')
      collection.uncommittedEvents = []
      collection.archive('user-123')

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
      collection.updateMetadata('New Name', 'New Description', 'new-slug', 'user-123')
      collection.archive('user-123')

      // Assert
      expect(collection.uncommittedEvents).toHaveLength(2)
      expect(collection.uncommittedEvents[0]).toBeInstanceOf(CollectionMetadataUpdatedEvent)
      expect(collection.uncommittedEvents[1]).toBeInstanceOf(CollectionArchivedEvent)
    })

    test('should preserve event order', () => {
      // Arrange
      const collection = CollectionAggregate.create(createValidCollectionParams())
      collection.uncommittedEvents = []

      // Act
      collection.updateMetadata('New Name', 'New Description', 'new-slug', 'user-123')
      collection.archive('user-123')

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

  describe('migration from legacy imageUrls to images', () => {
    test('should migrate from imageUrls to images array', () => {
      // Arrange - old format with imageUrls
      const snapshot = {
        aggregate_id: 'collection-123',
        correlation_id: 'correlation-123',
        version: 5,
        payload: JSON.stringify({
          name: 'Legacy Collection',
          description: 'A collection with old imageUrls',
          slug: 'legacy-collection',
          status: 'active',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
          metaTitle: '',
          metaDescription: '',
          publishedAt: null,
          imageUrls: {
            thumbnail: { original: 'https://example.com/thumb.jpg', webp: null },
            small: { original: 'https://example.com/small.jpg', webp: null },
            medium: { original: 'https://example.com/medium.jpg', webp: null },
            large: { original: 'https://example.com/large.jpg', webp: null },
          },
        }),
      }

      // Act
      const collection = CollectionAggregate.loadFromSnapshot(snapshot)

      // Assert
      const collectionSnapshot = collection.toSnapshot()
      expect(collectionSnapshot.images).toHaveLength(1)
      expect(collectionSnapshot.images[0]?.imageId).toBe('legacy-collection-123')
      expect(collectionSnapshot.images[0]?.urls.medium?.original).toBe('https://example.com/medium.jpg')
      expect(collectionSnapshot.images[0]?.altText).toBe('')
    })

    test('should handle legacy snapshot with null imageUrls', () => {
      // Arrange - old format with null imageUrls
      const snapshot = {
        aggregate_id: 'collection-123',
        correlation_id: 'correlation-123',
        version: 5,
        payload: JSON.stringify({
          name: 'Legacy Collection',
          description: 'A collection with null imageUrls',
          slug: 'legacy-collection',
          status: 'active',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
          metaTitle: '',
          metaDescription: '',
          publishedAt: null,
          imageUrls: null,
        }),
      }

      // Act
      const collection = CollectionAggregate.loadFromSnapshot(snapshot)

      // Assert
      const collectionSnapshot = collection.toSnapshot()
      expect(collectionSnapshot.images).toHaveLength(0)
    })

    test('should load new format with images array', () => {
      // Arrange - new format with images array
      const snapshot = {
        aggregate_id: 'collection-123',
        correlation_id: 'correlation-123',
        version: 5,
        payload: JSON.stringify({
          name: 'New Collection',
          description: 'A collection with new images array',
          slug: 'new-collection',
          status: 'active',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
          metaTitle: '',
          metaDescription: '',
          publishedAt: null,
          images: [
            {
              imageId: 'img-1',
              urls: {
                thumbnail: { original: 'https://example.com/img-1/thumb.jpg', webp: null },
                small: { original: 'https://example.com/img-1/small.jpg', webp: null },
                medium: { original: 'https://example.com/img-1/medium.jpg', webp: null },
                large: { original: 'https://example.com/img-1/large.jpg', webp: null },
              },
              uploadedAt: '2024-01-01T00:00:00.000Z',
              altText: 'Test image',
            },
            {
              imageId: 'img-2',
              urls: {
                thumbnail: { original: 'https://example.com/img-2/thumb.jpg', webp: null },
                small: { original: 'https://example.com/img-2/small.jpg', webp: null },
                medium: { original: 'https://example.com/img-2/medium.jpg', webp: null },
                large: { original: 'https://example.com/img-2/large.jpg', webp: null },
              },
              uploadedAt: '2024-01-01T00:00:00.000Z',
              altText: 'Second image',
            },
          ],
        }),
      }

      // Act
      const collection = CollectionAggregate.loadFromSnapshot(snapshot)

      // Assert
      const collectionSnapshot = collection.toSnapshot()
      expect(collectionSnapshot.images).toHaveLength(2)
      expect(collectionSnapshot.images[0]?.imageId).toBe('img-1')
      expect(collectionSnapshot.images[0]?.altText).toBe('Test image')
      expect(collectionSnapshot.images[1]?.imageId).toBe('img-2')
      expect(collectionSnapshot.images[1]?.altText).toBe('Second image')
    })

    test('should handle snapshot without either imageUrls or images', () => {
      // Arrange - very old format without any image fields
      const snapshot = {
        aggregate_id: 'collection-123',
        correlation_id: 'correlation-123',
        version: 5,
        payload: JSON.stringify({
          name: 'Very Old Collection',
          description: 'A collection without any image fields',
          slug: 'very-old-collection',
          status: 'active',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
          metaTitle: '',
          metaDescription: '',
          publishedAt: null,
          // No imageUrls or images field
        }),
      }

      // Act
      const collection = CollectionAggregate.loadFromSnapshot(snapshot)

      // Assert
      const collectionSnapshot = collection.toSnapshot()
      expect(collectionSnapshot.images).toHaveLength(0)
    })
  })
})

