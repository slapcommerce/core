import { describe, test, expect } from 'bun:test'
import { BundleAggregate } from '../../../../src/api/domain/bundle/aggregate'
import {
  BundleCreatedEvent,
  BundleArchivedEvent,
  BundlePublishedEvent,
  BundleUnpublishedEvent,
  BundleItemsUpdatedEvent,
  BundleDetailsUpdatedEvent,
  BundleMetadataUpdatedEvent,
  BundlePriceUpdatedEvent,
  BundleCollectionsUpdatedEvent,
  BundleImagesUpdatedEvent,
  BundleSlugChangedEvent,
  BundleTaxDetailsUpdatedEvent,
} from '../../../../src/api/domain/bundle/events'
import type { ImageUploadResult } from '../../../../src/api/infrastructure/adapters/imageStorageAdapter'

function createValidBundleParams() {
  return {
    id: 'bundle-123',
    correlationId: 'correlation-123',
    userId: 'user-123',
    name: 'Test Bundle',
    description: 'A test bundle',
    slug: 'test-bundle',
    items: [
      { variantId: 'variant-1', quantity: 2 },
      { variantId: 'variant-2', quantity: 1 },
    ],
    price: 99.99,
    compareAtPrice: 129.99,
    metaTitle: 'Test Bundle Meta',
    metaDescription: 'Test bundle description',
    richDescriptionUrl: 'https://example.com/description',
    tags: ['tag1', 'tag2'],
    collections: ['collection-1'],
    taxable: true,
    taxId: 'TAX123',
  }
}

function createMockImageUploadResult(): ImageUploadResult {
  const createUrlSet = (size: string) => ({
    original: `https://example.com/image-${size}.jpg`,
    webp: `https://example.com/image-${size}.webp`,
    avif: `https://example.com/image-${size}.avif`,
  })
  return {
    imageId: 'image-123',
    urls: {
      thumbnail: createUrlSet('thumbnail'),
      small: createUrlSet('small'),
      medium: createUrlSet('medium'),
      large: createUrlSet('large'),
      original: createUrlSet('original'),
    },
  }
}

describe('BundleAggregate', () => {
  describe('create', () => {
    test('should create a new bundle aggregate with draft status', () => {
      // Arrange
      const params = createValidBundleParams()

      // Act
      const bundle = BundleAggregate.create(params)

      // Assert
      const snapshot = bundle.toSnapshot()
      expect(bundle.id).toBe(params.id)
      expect(snapshot.name).toBe(params.name)
      expect(snapshot.description).toBe(params.description)
      expect(snapshot.slug).toBe(params.slug)
      expect(snapshot.items).toEqual(params.items)
      expect(snapshot.price).toBe(params.price)
      expect(snapshot.compareAtPrice).toBe(params.compareAtPrice)
      expect(snapshot.metaTitle).toBe(params.metaTitle)
      expect(snapshot.metaDescription).toBe(params.metaDescription)
      expect(snapshot.richDescriptionUrl).toBe(params.richDescriptionUrl)
      expect(snapshot.tags).toEqual(params.tags)
      expect(snapshot.collections).toEqual(params.collections)
      expect(snapshot.taxable).toBe(params.taxable)
      expect(snapshot.taxId).toBe(params.taxId)
      expect(snapshot.status).toBe('draft')
      expect(bundle.version).toBe(0)
      expect(snapshot.publishedAt).toBeNull()
      expect(bundle.events).toEqual([])
      expect(bundle.uncommittedEvents).toHaveLength(1)
      const event = bundle.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(BundleCreatedEvent)
      expect(event.eventName).toBe('bundle.created')
      expect(event.aggregateId).toBe(params.id)
      expect(event.correlationId).toBe(params.correlationId)
      expect(event.version).toBe(0)
    })

    test('should set createdAt and updatedAt to current time', () => {
      // Arrange
      const params = createValidBundleParams()
      const beforeCreate = new Date()

      // Act
      const bundle = BundleAggregate.create(params)
      const afterCreate = new Date()

      // Assert
      const snapshot = bundle.toSnapshot()
      expect(snapshot.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime())
      expect(snapshot.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime())
      expect(snapshot.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime())
      expect(snapshot.updatedAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime())
      expect(snapshot.createdAt.getTime()).toBe(snapshot.updatedAt.getTime())
    })

    test('should include all bundle data in created event payload', () => {
      // Arrange
      const params = createValidBundleParams()

      // Act
      const bundle = BundleAggregate.create(params)
      const event = bundle.uncommittedEvents[0] as BundleCreatedEvent

      // Assert
      expect(event.payload.priorState).toEqual({} as any)
      expect(event.payload.newState.name).toBe(params.name)
      expect(event.payload.newState.description).toBe(params.description)
      expect(event.payload.newState.slug).toBe(params.slug)
      expect(event.payload.newState.items).toEqual(params.items)
      expect(event.payload.newState.price).toBe(params.price)
      expect(event.payload.newState.compareAtPrice).toBe(params.compareAtPrice)
      expect(event.payload.newState.metaTitle).toBe(params.metaTitle)
      expect(event.payload.newState.metaDescription).toBe(params.metaDescription)
      expect(event.payload.newState.richDescriptionUrl).toBe(params.richDescriptionUrl)
      expect(event.payload.newState.tags).toEqual(params.tags)
      expect(event.payload.newState.collections).toEqual(params.collections)
      expect(event.payload.newState.taxable).toBe(params.taxable)
      expect(event.payload.newState.taxId).toBe(params.taxId)
      expect(event.payload.newState.status).toBe('draft')
      expect(event.payload.newState.publishedAt).toBeNull()
    })

    test('should create bundle with default values when optional params not provided', () => {
      // Arrange
      const params = {
        id: 'bundle-123',
        correlationId: 'correlation-123',
        userId: 'user-123',
        name: 'Test Bundle',
        description: 'A test bundle',
        slug: 'test-bundle',
        items: [{ variantId: 'variant-1', quantity: 1 }],
        price: 50,
      }

      // Act
      const bundle = BundleAggregate.create(params)

      // Assert
      const snapshot = bundle.toSnapshot()
      expect(snapshot.compareAtPrice).toBeNull()
      expect(snapshot.metaTitle).toBe('')
      expect(snapshot.metaDescription).toBe('')
      expect(snapshot.richDescriptionUrl).toBe('')
      expect(snapshot.tags).toEqual([])
      expect(snapshot.collections).toEqual([])
      expect(snapshot.taxable).toBe(true)
      expect(snapshot.taxId).toBe('')
    })

    test('should allow multiple collections', () => {
      // Arrange
      const params = createValidBundleParams()
      params.collections = ['collection-1', 'collection-2', 'collection-3']

      // Act
      const bundle = BundleAggregate.create(params)

      // Assert
      expect(bundle.toSnapshot().collections).toEqual(['collection-1', 'collection-2', 'collection-3'])
    })

    test('should allow empty tags array', () => {
      // Arrange
      const params = createValidBundleParams()
      params.tags = []

      // Act
      const bundle = BundleAggregate.create(params)

      // Assert
      expect(bundle.toSnapshot().tags).toEqual([])
    })

    test('should allow empty collections array', () => {
      // Arrange
      const params = createValidBundleParams()
      params.collections = []

      // Act
      const bundle = BundleAggregate.create(params)

      // Assert
      expect(bundle.toSnapshot().collections).toEqual([])
    })

    test('should start with empty images', () => {
      // Arrange
      const params = createValidBundleParams()

      // Act
      const bundle = BundleAggregate.create(params)

      // Assert
      const snapshot = bundle.toSnapshot()
      expect(snapshot.images).toEqual([])
    })
  })

  describe('archive', () => {
    test('should archive a draft bundle', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []

      // Act
      bundle.archive('user-123')

      // Assert
      expect(bundle.toSnapshot().status).toBe('archived')
      expect(bundle.version).toBe(1)
      expect(bundle.uncommittedEvents).toHaveLength(1)
      const event = bundle.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(BundleArchivedEvent)
      expect(event.eventName).toBe('bundle.archived')
      expect(event.version).toBe(1)
    })

    test('should archive an active bundle', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      bundle.publish('user-123')
      bundle.uncommittedEvents = []

      // Act
      bundle.archive('user-123')

      // Assert
      expect(bundle.toSnapshot().status).toBe('archived')
      expect(bundle.version).toBe(2)
      expect(bundle.uncommittedEvents).toHaveLength(1)
      expect(bundle.uncommittedEvents[0]).toBeInstanceOf(BundleArchivedEvent)
    })

    test('should throw error when bundle is already archived', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      bundle.archive('user-123')
      bundle.uncommittedEvents = []

      // Act & Assert
      expect(() => bundle.archive('user-123')).toThrow('Bundle is already archived')
    })

    test('should update updatedAt when archiving', async () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const originalUpdatedAt = bundle.toSnapshot().updatedAt

      await new Promise(resolve => setTimeout(resolve, 10))

      // Act
      bundle.archive('user-123')

      // Assert
      expect(bundle.toSnapshot().updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should include current state in archived event payload', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []

      // Act
      bundle.archive('user-123')
      const event = bundle.uncommittedEvents[0] as BundleArchivedEvent

      // Assert
      expect(event.payload.newState.status).toBe('archived')
      const snapshot = bundle.toSnapshot()
      expect(event.payload.newState.name).toBe(snapshot.name)
      expect(event.payload.newState.slug).toBe(snapshot.slug)
      expect(event.payload.priorState.status).toBe('draft')
    })

    test('should increment version when archiving', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const initialVersion = bundle.version

      // Act
      bundle.archive('user-123')

      // Assert
      expect(bundle.version).toBe(initialVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []

      // Act
      const result = bundle.archive('user-123')

      // Assert
      expect(result).toBe(bundle)
    })
  })

  describe('publish', () => {
    test('should publish a draft bundle', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []

      // Act
      bundle.publish('user-123')

      // Assert
      expect(bundle.toSnapshot().status).toBe('active')
      expect(bundle.toSnapshot().publishedAt).not.toBeNull()
      expect(bundle.version).toBe(1)
      expect(bundle.uncommittedEvents).toHaveLength(1)
      const event = bundle.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(BundlePublishedEvent)
      expect(event.eventName).toBe('bundle.published')
      expect(event.version).toBe(1)
    })

    test('should set publishedAt to current time', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const beforePublish = new Date()

      // Act
      bundle.publish('user-123')
      const afterPublish = new Date()

      // Assert
      const snapshot = bundle.toSnapshot()
      expect(snapshot.publishedAt).not.toBeNull()
      if (snapshot.publishedAt) {
        expect(snapshot.publishedAt.getTime()).toBeGreaterThanOrEqual(beforePublish.getTime())
        expect(snapshot.publishedAt.getTime()).toBeLessThanOrEqual(afterPublish.getTime())
      }
    })

    test('should throw error when bundle is already published', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      bundle.publish('user-123')
      bundle.uncommittedEvents = []

      // Act & Assert
      expect(() => bundle.publish('user-123')).toThrow('Bundle is already published')
    })

    test('should throw error when trying to publish archived bundle', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      bundle.archive('user-123')
      bundle.uncommittedEvents = []

      // Act & Assert
      expect(() => bundle.publish('user-123')).toThrow('Cannot publish an archived bundle')
    })

    test('should update updatedAt when publishing', async () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const originalUpdatedAt = bundle.toSnapshot().updatedAt

      await new Promise(resolve => setTimeout(resolve, 10))

      // Act
      bundle.publish('user-123')

      // Assert
      expect(bundle.toSnapshot().updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should set publishedAt equal to updatedAt when publishing', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []

      // Act
      bundle.publish('user-123')

      // Assert
      const snapshot = bundle.toSnapshot()
      expect(snapshot.publishedAt).not.toBeNull()
      if (snapshot.publishedAt) {
        expect(snapshot.publishedAt.getTime()).toBe(snapshot.updatedAt.getTime())
      }
    })

    test('should include current state in published event payload', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []

      // Act
      bundle.publish('user-123')
      const event = bundle.uncommittedEvents[0] as BundlePublishedEvent

      // Assert
      const snapshot = bundle.toSnapshot()
      expect(event.payload.newState.status).toBe('active')
      expect(event.payload.newState.publishedAt).not.toBeNull()
      expect(event.payload.newState.name).toBe(snapshot.name)
      expect(event.payload.newState.slug).toBe(snapshot.slug)
      expect(event.payload.priorState.status).toBe('draft')
    })

    test('should increment version when publishing', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const initialVersion = bundle.version

      // Act
      bundle.publish('user-123')

      // Assert
      expect(bundle.version).toBe(initialVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []

      // Act
      const result = bundle.publish('user-123')

      // Assert
      expect(result).toBe(bundle)
    })
  })

  describe('unpublish', () => {
    test('should unpublish an active bundle', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      bundle.publish('user-123')
      bundle.uncommittedEvents = []

      // Act
      bundle.unpublish('user-123')

      // Assert
      expect(bundle.toSnapshot().status).toBe('draft')
      expect(bundle.toSnapshot().publishedAt).toBeNull()
      expect(bundle.version).toBe(2)
      expect(bundle.uncommittedEvents).toHaveLength(1)
      const event = bundle.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(BundleUnpublishedEvent)
      expect(event.eventName).toBe('bundle.unpublished')
      expect(event.version).toBe(2)
    })

    test('should throw error when bundle is already unpublished', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []

      // Act & Assert
      expect(() => bundle.unpublish('user-123')).toThrow('Bundle is already unpublished')
    })

    test('should throw error when trying to unpublish archived bundle', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      bundle.archive('user-123')
      bundle.uncommittedEvents = []

      // Act & Assert
      expect(() => bundle.unpublish('user-123')).toThrow('Cannot unpublish an archived bundle')
    })

    test('should update updatedAt when unpublishing', async () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      bundle.publish('user-123')
      bundle.uncommittedEvents = []
      const originalUpdatedAt = bundle.toSnapshot().updatedAt

      await new Promise(resolve => setTimeout(resolve, 10))

      // Act
      bundle.unpublish('user-123')

      // Assert
      expect(bundle.toSnapshot().updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should clear publishedAt when unpublishing', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      bundle.publish('user-123')
      expect(bundle.toSnapshot().publishedAt).not.toBeNull()
      bundle.uncommittedEvents = []

      // Act
      bundle.unpublish('user-123')

      // Assert
      expect(bundle.toSnapshot().publishedAt).toBeNull()
    })

    test('should include current state in unpublished event payload', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      bundle.publish('user-123')
      bundle.uncommittedEvents = []

      // Act
      bundle.unpublish('user-123')
      const event = bundle.uncommittedEvents[0] as BundleUnpublishedEvent

      // Assert
      expect(event.payload.newState.status).toBe('draft')
      expect(event.payload.newState.publishedAt).toBeNull()
      expect(event.payload.priorState.status).toBe('active')
      expect(event.payload.priorState.publishedAt).not.toBeNull()
    })

    test('should increment version when unpublishing', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      bundle.publish('user-123')
      bundle.uncommittedEvents = []
      const initialVersion = bundle.version

      // Act
      bundle.unpublish('user-123')

      // Assert
      expect(bundle.version).toBe(initialVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      bundle.publish('user-123')
      bundle.uncommittedEvents = []

      // Act
      const result = bundle.unpublish('user-123')

      // Assert
      expect(result).toBe(bundle)
    })
  })

  describe('updateItems', () => {
    test('should update bundle items', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const oldItems = bundle.toSnapshot().items
      const newItems = [
        { variantId: 'variant-3', quantity: 5 },
        { variantId: 'variant-4', quantity: 3 },
      ]

      // Act
      bundle.updateItems(newItems, 'user-123')

      // Assert
      expect(bundle.toSnapshot().items).toEqual(newItems)
      expect(bundle.uncommittedEvents).toHaveLength(1)
      const event = bundle.uncommittedEvents[0]!
      expect(event.eventName).toBe('bundle.items_updated')
      if (event.eventName === 'bundle.items_updated') {
        const itemsEvent = event as BundleItemsUpdatedEvent
        expect(itemsEvent.payload.priorState.items).toEqual(oldItems)
        expect(itemsEvent.payload.newState.items).toEqual(newItems)
      }
    })

    test('should update updatedAt when updating items', async () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const originalUpdatedAt = bundle.toSnapshot().updatedAt

      await new Promise(resolve => setTimeout(resolve, 10))

      // Act
      bundle.updateItems([{ variantId: 'variant-new', quantity: 1 }], 'user-123')

      // Assert
      expect(bundle.toSnapshot().updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should increment version when updating items', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const initialVersion = bundle.version

      // Act
      bundle.updateItems([{ variantId: 'variant-new', quantity: 1 }], 'user-123')

      // Assert
      expect(bundle.version).toBe(initialVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []

      // Act
      const result = bundle.updateItems([{ variantId: 'variant-new', quantity: 1 }], 'user-123')

      // Assert
      expect(result).toBe(bundle)
    })

    test('should handle single item', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const newItems = [{ variantId: 'single-variant', quantity: 10 }]

      // Act
      bundle.updateItems(newItems, 'user-123')

      // Assert
      expect(bundle.toSnapshot().items).toEqual(newItems)
    })

    test('should handle many items', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const newItems = Array.from({ length: 50 }, (_, i) => ({
        variantId: `variant-${i}`,
        quantity: i + 1,
      }))

      // Act
      bundle.updateItems(newItems, 'user-123')

      // Assert
      expect(bundle.toSnapshot().items).toEqual(newItems)
      expect(bundle.toSnapshot().items).toHaveLength(50)
    })
  })

  describe('updateDetails', () => {
    test('should update bundle details', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const oldName = bundle.toSnapshot().name
      const oldDescription = bundle.toSnapshot().description

      // Act
      bundle.updateDetails('New Name', 'New Description', 'https://example.com/new-description', 'user-123')

      // Assert
      const snapshot = bundle.toSnapshot()
      expect(snapshot.name).toBe('New Name')
      expect(snapshot.description).toBe('New Description')
      expect(snapshot.richDescriptionUrl).toBe('https://example.com/new-description')
      expect(bundle.uncommittedEvents).toHaveLength(1)
      const event = bundle.uncommittedEvents[0]!
      expect(event.eventName).toBe('bundle.details_updated')
      if (event.eventName === 'bundle.details_updated') {
        const detailsEvent = event as BundleDetailsUpdatedEvent
        expect(detailsEvent.payload.priorState.name).toBe(oldName)
        expect(detailsEvent.payload.priorState.description).toBe(oldDescription)
        expect(detailsEvent.payload.newState.name).toBe('New Name')
        expect(detailsEvent.payload.newState.description).toBe('New Description')
      }
    })

    test('should update updatedAt when updating details', async () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const originalUpdatedAt = bundle.toSnapshot().updatedAt

      await new Promise(resolve => setTimeout(resolve, 10))

      // Act
      bundle.updateDetails('New Name', 'New Description', 'https://example.com/new', 'user-123')

      // Assert
      expect(bundle.toSnapshot().updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should increment version when updating details', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const originalVersion = bundle.version

      // Act
      bundle.updateDetails('New Name', 'New Description', 'https://example.com/new', 'user-123')

      // Assert
      expect(bundle.version).toBe(originalVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []

      // Act
      const result = bundle.updateDetails('New Name', 'New Description', 'https://example.com/new', 'user-123')

      // Assert
      expect(result).toBe(bundle)
    })
  })

  describe('updateMetadata', () => {
    test('should update bundle metadata', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const oldMetaTitle = bundle.toSnapshot().metaTitle
      const oldTags = bundle.toSnapshot().tags

      // Act
      bundle.updateMetadata('New Meta Title', 'New Meta Description', ['new-tag1', 'new-tag2'], 'user-123')

      // Assert
      const snapshot = bundle.toSnapshot()
      expect(snapshot.metaTitle).toBe('New Meta Title')
      expect(snapshot.metaDescription).toBe('New Meta Description')
      expect(snapshot.tags).toEqual(['new-tag1', 'new-tag2'])
      expect(bundle.uncommittedEvents).toHaveLength(1)
      const event = bundle.uncommittedEvents[0]!
      expect(event.eventName).toBe('bundle.metadata_updated')
      if (event.eventName === 'bundle.metadata_updated') {
        const metadataEvent = event as BundleMetadataUpdatedEvent
        expect(metadataEvent.payload.priorState.metaTitle).toBe(oldMetaTitle)
        expect(metadataEvent.payload.priorState.tags).toEqual(oldTags)
        expect(metadataEvent.payload.newState.metaTitle).toBe('New Meta Title')
        expect(metadataEvent.payload.newState.tags).toEqual(['new-tag1', 'new-tag2'])
      }
    })

    test('should allow empty tags array', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []

      // Act
      bundle.updateMetadata('Meta Title', 'Meta Description', [], 'user-123')

      // Assert
      expect(bundle.toSnapshot().tags).toEqual([])
    })

    test('should update updatedAt when updating metadata', async () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const originalUpdatedAt = bundle.toSnapshot().updatedAt

      await new Promise(resolve => setTimeout(resolve, 10))

      // Act
      bundle.updateMetadata('New Meta', 'New Desc', ['tag'], 'user-123')

      // Assert
      expect(bundle.toSnapshot().updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should increment version when updating metadata', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const originalVersion = bundle.version

      // Act
      bundle.updateMetadata('New Meta', 'New Desc', ['tag'], 'user-123')

      // Assert
      expect(bundle.version).toBe(originalVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []

      // Act
      const result = bundle.updateMetadata('New Meta', 'New Desc', ['tag'], 'user-123')

      // Assert
      expect(result).toBe(bundle)
    })
  })

  describe('updatePrice', () => {
    test('should update bundle price', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const oldPrice = bundle.toSnapshot().price
      const oldCompareAtPrice = bundle.toSnapshot().compareAtPrice

      // Act
      bundle.updatePrice(199.99, 249.99, 'user-123')

      // Assert
      const snapshot = bundle.toSnapshot()
      expect(snapshot.price).toBe(199.99)
      expect(snapshot.compareAtPrice).toBe(249.99)
      expect(bundle.uncommittedEvents).toHaveLength(1)
      const event = bundle.uncommittedEvents[0]!
      expect(event.eventName).toBe('bundle.price_updated')
      if (event.eventName === 'bundle.price_updated') {
        const priceEvent = event as BundlePriceUpdatedEvent
        expect(priceEvent.payload.priorState.price).toBe(oldPrice)
        expect(priceEvent.payload.priorState.compareAtPrice).toBe(oldCompareAtPrice)
        expect(priceEvent.payload.newState.price).toBe(199.99)
        expect(priceEvent.payload.newState.compareAtPrice).toBe(249.99)
      }
    })

    test('should allow null compareAtPrice', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []

      // Act
      bundle.updatePrice(99.99, null, 'user-123')

      // Assert
      const snapshot = bundle.toSnapshot()
      expect(snapshot.price).toBe(99.99)
      expect(snapshot.compareAtPrice).toBeNull()
    })

    test('should update updatedAt when updating price', async () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const originalUpdatedAt = bundle.toSnapshot().updatedAt

      await new Promise(resolve => setTimeout(resolve, 10))

      // Act
      bundle.updatePrice(150, 200, 'user-123')

      // Assert
      expect(bundle.toSnapshot().updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should increment version when updating price', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const originalVersion = bundle.version

      // Act
      bundle.updatePrice(150, 200, 'user-123')

      // Assert
      expect(bundle.version).toBe(originalVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []

      // Act
      const result = bundle.updatePrice(150, 200, 'user-123')

      // Assert
      expect(result).toBe(bundle)
    })
  })

  describe('updateCollections', () => {
    test('should update bundle collections', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const oldCollections = bundle.toSnapshot().collections

      // Act
      bundle.updateCollections(['collection-2', 'collection-3'], 'user-123')

      // Assert
      expect(bundle.toSnapshot().collections).toEqual(['collection-2', 'collection-3'])
      expect(bundle.uncommittedEvents).toHaveLength(1)
      const event = bundle.uncommittedEvents[0]!
      expect(event.eventName).toBe('bundle.collections_updated')
      if (event.eventName === 'bundle.collections_updated') {
        const collectionsEvent = event as BundleCollectionsUpdatedEvent
        expect(collectionsEvent.payload.priorState.collections).toEqual(oldCollections)
        expect(collectionsEvent.payload.newState.collections).toEqual(['collection-2', 'collection-3'])
      }
    })

    test('should allow empty collections array', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []

      // Act
      bundle.updateCollections([], 'user-123')

      // Assert
      expect(bundle.toSnapshot().collections).toEqual([])
    })

    test('should allow single collection', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []

      // Act
      bundle.updateCollections(['collection-solo'], 'user-123')

      // Assert
      expect(bundle.toSnapshot().collections).toEqual(['collection-solo'])
    })

    test('should allow many collections', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const manyCollections = Array.from({ length: 50 }, (_, i) => `collection-${i}`)

      // Act
      bundle.updateCollections(manyCollections, 'user-123')

      // Assert
      expect(bundle.toSnapshot().collections).toEqual(manyCollections)
    })

    test('should update updatedAt when updating collections', async () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const originalUpdatedAt = bundle.toSnapshot().updatedAt

      await new Promise(resolve => setTimeout(resolve, 10))

      // Act
      bundle.updateCollections(['new-collection'], 'user-123')

      // Assert
      expect(bundle.toSnapshot().updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should increment version when updating collections', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const originalVersion = bundle.version

      // Act
      bundle.updateCollections(['new-collection'], 'user-123')

      // Assert
      expect(bundle.version).toBe(originalVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []

      // Act
      const result = bundle.updateCollections(['new-collection'], 'user-123')

      // Assert
      expect(result).toBe(bundle)
    })

    test('should use collections getter that returns a copy', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())

      // Act
      const collections1 = bundle.collections
      const collections2 = bundle.collections

      // Assert
      expect(collections1).toEqual(collections2)
      expect(collections1).not.toBe(collections2)
    })
  })

  describe('changeSlug', () => {
    test('should change slug of a bundle', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const oldSlug = bundle.toSnapshot().slug

      // Act
      bundle.changeSlug('new-slug', 'user-123')

      // Assert
      expect(bundle.toSnapshot().slug).toBe('new-slug')
      expect(bundle.slug).toBe('new-slug')
      expect(bundle.uncommittedEvents).toHaveLength(1)
      const event = bundle.uncommittedEvents[0]!
      expect(event.eventName).toBe('bundle.slug_changed')
      if (event.eventName === 'bundle.slug_changed') {
        const slugEvent = event as BundleSlugChangedEvent
        expect(slugEvent.payload.priorState.slug).toBe(oldSlug)
        expect(slugEvent.payload.newState.slug).toBe('new-slug')
      }
    })

    test('should update updatedAt when changing slug', async () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const originalUpdatedAt = bundle.toSnapshot().updatedAt

      await new Promise(resolve => setTimeout(resolve, 10))

      // Act
      bundle.changeSlug('new-slug', 'user-123')

      // Assert
      expect(bundle.toSnapshot().updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should increment version when changing slug', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const originalVersion = bundle.version

      // Act
      bundle.changeSlug('new-slug', 'user-123')

      // Assert
      expect(bundle.version).toBe(originalVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []

      // Act
      const result = bundle.changeSlug('new-slug', 'user-123')

      // Assert
      expect(result).toBe(bundle)
    })

    test('should include complete state in event payload', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []

      // Act
      bundle.changeSlug('new-slug', 'user-123')
      const event = bundle.uncommittedEvents[0]!

      // Assert
      expect(event.version).toBe(1)
      expect(event.aggregateId).toBe(bundle.id)
      if (event.eventName === 'bundle.slug_changed') {
        const slugEvent = event as BundleSlugChangedEvent
        expect(slugEvent.payload.newState.name).toBe(bundle.toSnapshot().name)
        expect(slugEvent.payload.newState.status).toBe(bundle.toSnapshot().status)
      }
    })
  })

  describe('updateTaxDetails', () => {
    test('should update bundle tax details', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const oldTaxable = bundle.toSnapshot().taxable
      const oldTaxId = bundle.toSnapshot().taxId

      // Act
      bundle.updateTaxDetails(false, 'NEW-TAX-ID', 'user-123')

      // Assert
      const snapshot = bundle.toSnapshot()
      expect(snapshot.taxable).toBe(false)
      expect(snapshot.taxId).toBe('NEW-TAX-ID')
      expect(bundle.uncommittedEvents).toHaveLength(1)
      const event = bundle.uncommittedEvents[0]!
      expect(event.eventName).toBe('bundle.tax_details_updated')
      if (event.eventName === 'bundle.tax_details_updated') {
        const taxEvent = event as BundleTaxDetailsUpdatedEvent
        expect(taxEvent.payload.priorState.taxable).toBe(oldTaxable)
        expect(taxEvent.payload.priorState.taxId).toBe(oldTaxId)
        expect(taxEvent.payload.newState.taxable).toBe(false)
        expect(taxEvent.payload.newState.taxId).toBe('NEW-TAX-ID')
      }
    })

    test('should update taxable from true to false', () => {
      // Arrange
      const params = createValidBundleParams()
      params.taxable = true
      const bundle = BundleAggregate.create(params)
      bundle.uncommittedEvents = []

      // Act
      bundle.updateTaxDetails(false, 'TAX123', 'user-123')

      // Assert
      expect(bundle.toSnapshot().taxable).toBe(false)
    })

    test('should update taxable from false to true', () => {
      // Arrange
      const params = createValidBundleParams()
      params.taxable = false
      const bundle = BundleAggregate.create(params)
      bundle.uncommittedEvents = []

      // Act
      bundle.updateTaxDetails(true, 'TAX123', 'user-123')

      // Assert
      expect(bundle.toSnapshot().taxable).toBe(true)
    })

    test('should update updatedAt when updating tax details', async () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const originalUpdatedAt = bundle.toSnapshot().updatedAt

      await new Promise(resolve => setTimeout(resolve, 10))

      // Act
      bundle.updateTaxDetails(false, 'NEW-TAX-ID', 'user-123')

      // Assert
      expect(bundle.toSnapshot().updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should increment version when updating tax details', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const originalVersion = bundle.version

      // Act
      bundle.updateTaxDetails(false, 'NEW-TAX-ID', 'user-123')

      // Assert
      expect(bundle.version).toBe(originalVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []

      // Act
      const result = bundle.updateTaxDetails(false, 'NEW-TAX-ID', 'user-123')

      // Assert
      expect(result).toBe(bundle)
    })
  })

  describe('addImage', () => {
    test('should add image to bundle', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const uploadResult = createMockImageUploadResult()

      // Act
      bundle.addImage(uploadResult, 'Alt text for image', 'user-123')

      // Assert
      const snapshot = bundle.toSnapshot()
      expect(snapshot.images).toHaveLength(1)
      expect(snapshot.images[0]!.imageId).toBe(uploadResult.imageId)
      expect(snapshot.images[0]!.altText).toBe('Alt text for image')
      expect(bundle.uncommittedEvents).toHaveLength(1)
      const event = bundle.uncommittedEvents[0]!
      expect(event.eventName).toBe('bundle.images_updated')
    })

    test('should add multiple images', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const uploadResult1 = { ...createMockImageUploadResult(), imageId: 'image-1' }
      const uploadResult2 = { ...createMockImageUploadResult(), imageId: 'image-2' }

      // Act
      bundle.addImage(uploadResult1, 'Alt 1', 'user-123')
      bundle.addImage(uploadResult2, 'Alt 2', 'user-123')

      // Assert
      const snapshot = bundle.toSnapshot()
      expect(snapshot.images).toHaveLength(2)
    })

    test('should update updatedAt when adding image', async () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const originalUpdatedAt = bundle.toSnapshot().updatedAt

      await new Promise(resolve => setTimeout(resolve, 10))

      // Act
      bundle.addImage(createMockImageUploadResult(), 'Alt', 'user-123')

      // Assert
      expect(bundle.toSnapshot().updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should increment version when adding image', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const originalVersion = bundle.version

      // Act
      bundle.addImage(createMockImageUploadResult(), 'Alt', 'user-123')

      // Assert
      expect(bundle.version).toBe(originalVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []

      // Act
      const result = bundle.addImage(createMockImageUploadResult(), 'Alt', 'user-123')

      // Assert
      expect(result).toBe(bundle)
    })

    test('should include images state in event payload', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []

      // Act
      bundle.addImage(createMockImageUploadResult(), 'Alt', 'user-123')
      const event = bundle.uncommittedEvents[0] as BundleImagesUpdatedEvent

      // Assert
      expect(event.payload.priorState.images.toArray()).toEqual([])
      expect(event.payload.newState.images.toArray()).toHaveLength(1)
    })
  })

  describe('removeImage', () => {
    test('should remove image from bundle', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const uploadResult = createMockImageUploadResult()
      bundle.addImage(uploadResult, 'Alt', 'user-123')
      bundle.uncommittedEvents = []
      expect(bundle.toSnapshot().images).toHaveLength(1)

      // Act
      bundle.removeImage(uploadResult.imageId, 'user-123')

      // Assert
      expect(bundle.toSnapshot().images).toHaveLength(0)
      expect(bundle.uncommittedEvents).toHaveLength(1)
      const event = bundle.uncommittedEvents[0]!
      expect(event.eventName).toBe('bundle.images_updated')
    })

    test('should update updatedAt when removing image', async () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const uploadResult = createMockImageUploadResult()
      bundle.addImage(uploadResult, 'Alt', 'user-123')
      bundle.uncommittedEvents = []
      const originalUpdatedAt = bundle.toSnapshot().updatedAt

      await new Promise(resolve => setTimeout(resolve, 10))

      // Act
      bundle.removeImage(uploadResult.imageId, 'user-123')

      // Assert
      expect(bundle.toSnapshot().updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should increment version when removing image', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const uploadResult = createMockImageUploadResult()
      bundle.addImage(uploadResult, 'Alt', 'user-123')
      bundle.uncommittedEvents = []
      const originalVersion = bundle.version

      // Act
      bundle.removeImage(uploadResult.imageId, 'user-123')

      // Assert
      expect(bundle.version).toBe(originalVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const uploadResult = createMockImageUploadResult()
      bundle.addImage(uploadResult, 'Alt', 'user-123')
      bundle.uncommittedEvents = []

      // Act
      const result = bundle.removeImage(uploadResult.imageId, 'user-123')

      // Assert
      expect(result).toBe(bundle)
    })
  })

  describe('reorderImages', () => {
    test('should reorder images', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const img1 = { ...createMockImageUploadResult(), imageId: 'img-1' }
      const img2 = { ...createMockImageUploadResult(), imageId: 'img-2' }
      const img3 = { ...createMockImageUploadResult(), imageId: 'img-3' }
      bundle.addImage(img1, 'Alt 1', 'user-123')
      bundle.addImage(img2, 'Alt 2', 'user-123')
      bundle.addImage(img3, 'Alt 3', 'user-123')
      bundle.uncommittedEvents = []

      // Act
      bundle.reorderImages(['img-3', 'img-1', 'img-2'], 'user-123')

      // Assert
      const images = bundle.toSnapshot().images
      expect(images[0]!.imageId).toBe('img-3')
      expect(images[1]!.imageId).toBe('img-1')
      expect(images[2]!.imageId).toBe('img-2')
      expect(bundle.uncommittedEvents).toHaveLength(1)
      const event = bundle.uncommittedEvents[0]!
      expect(event.eventName).toBe('bundle.images_updated')
    })

    test('should update updatedAt when reordering images', async () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      bundle.addImage({ ...createMockImageUploadResult(), imageId: 'img-1' }, 'Alt', 'user-123')
      bundle.addImage({ ...createMockImageUploadResult(), imageId: 'img-2' }, 'Alt', 'user-123')
      bundle.uncommittedEvents = []
      const originalUpdatedAt = bundle.toSnapshot().updatedAt

      await new Promise(resolve => setTimeout(resolve, 10))

      // Act
      bundle.reorderImages(['img-2', 'img-1'], 'user-123')

      // Assert
      expect(bundle.toSnapshot().updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should increment version when reordering images', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      bundle.addImage({ ...createMockImageUploadResult(), imageId: 'img-1' }, 'Alt', 'user-123')
      bundle.addImage({ ...createMockImageUploadResult(), imageId: 'img-2' }, 'Alt', 'user-123')
      bundle.uncommittedEvents = []
      const originalVersion = bundle.version

      // Act
      bundle.reorderImages(['img-2', 'img-1'], 'user-123')

      // Assert
      expect(bundle.version).toBe(originalVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      bundle.addImage({ ...createMockImageUploadResult(), imageId: 'img-1' }, 'Alt', 'user-123')
      bundle.uncommittedEvents = []

      // Act
      const result = bundle.reorderImages(['img-1'], 'user-123')

      // Assert
      expect(result).toBe(bundle)
    })
  })

  describe('updateImageAltText', () => {
    test('should update image alt text', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const uploadResult = createMockImageUploadResult()
      bundle.addImage(uploadResult, 'Old Alt', 'user-123')
      bundle.uncommittedEvents = []

      // Act
      bundle.updateImageAltText(uploadResult.imageId, 'New Alt Text', 'user-123')

      // Assert
      const images = bundle.toSnapshot().images
      expect(images[0]!.altText).toBe('New Alt Text')
      expect(bundle.uncommittedEvents).toHaveLength(1)
      const event = bundle.uncommittedEvents[0]!
      expect(event.eventName).toBe('bundle.images_updated')
    })

    test('should update updatedAt when updating image alt text', async () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const uploadResult = createMockImageUploadResult()
      bundle.addImage(uploadResult, 'Alt', 'user-123')
      bundle.uncommittedEvents = []
      const originalUpdatedAt = bundle.toSnapshot().updatedAt

      await new Promise(resolve => setTimeout(resolve, 10))

      // Act
      bundle.updateImageAltText(uploadResult.imageId, 'New Alt', 'user-123')

      // Assert
      expect(bundle.toSnapshot().updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should increment version when updating image alt text', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const uploadResult = createMockImageUploadResult()
      bundle.addImage(uploadResult, 'Alt', 'user-123')
      bundle.uncommittedEvents = []
      const originalVersion = bundle.version

      // Act
      bundle.updateImageAltText(uploadResult.imageId, 'New Alt', 'user-123')

      // Assert
      expect(bundle.version).toBe(originalVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      const uploadResult = createMockImageUploadResult()
      bundle.addImage(uploadResult, 'Alt', 'user-123')
      bundle.uncommittedEvents = []

      // Act
      const result = bundle.updateImageAltText(uploadResult.imageId, 'New Alt', 'user-123')

      // Assert
      expect(result).toBe(bundle)
    })
  })

  describe('loadFromSnapshot', () => {
    test('should load bundle from snapshot', () => {
      // Arrange
      const snapshot = {
        aggregateId: 'bundle-123',
        correlationId: 'correlation-123',
        version: 5,
        payload: JSON.stringify({
          name: 'Snapshot Bundle',
          description: 'A bundle from snapshot',
          slug: 'snapshot-bundle',
          items: [{ variantId: 'variant-1', quantity: 2 }],
          price: 149.99,
          compareAtPrice: 199.99,
          metaTitle: 'Meta Title',
          metaDescription: 'Meta Description',
          richDescriptionUrl: 'https://example.com/description',
          tags: ['tag1'],
          collections: ['collection-1'],
          images: { images: [] },
          taxable: false,
          taxId: 'TAX456',
          status: 'active',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
          publishedAt: '2024-01-02T00:00:00.000Z',
        }),
      }

      // Act
      const bundle = BundleAggregate.loadFromSnapshot(snapshot)

      // Assert
      const bundleSnapshot = bundle.toSnapshot()
      expect(bundle.id).toBe('bundle-123')
      expect(bundleSnapshot.name).toBe('Snapshot Bundle')
      expect(bundleSnapshot.description).toBe('A bundle from snapshot')
      expect(bundleSnapshot.slug).toBe('snapshot-bundle')
      expect(bundleSnapshot.items).toEqual([{ variantId: 'variant-1', quantity: 2 }])
      expect(bundleSnapshot.price).toBe(149.99)
      expect(bundleSnapshot.compareAtPrice).toBe(199.99)
      expect(bundleSnapshot.metaTitle).toBe('Meta Title')
      expect(bundleSnapshot.metaDescription).toBe('Meta Description')
      expect(bundleSnapshot.richDescriptionUrl).toBe('https://example.com/description')
      expect(bundleSnapshot.tags).toEqual(['tag1'])
      expect(bundleSnapshot.collections).toEqual(['collection-1'])
      expect(bundleSnapshot.taxable).toBe(false)
      expect(bundleSnapshot.taxId).toBe('TAX456')
      expect(bundleSnapshot.status).toBe('active')
      expect(bundle.version).toBe(5)
      expect(bundleSnapshot.publishedAt).not.toBeNull()
      expect(bundle.events).toEqual([])
    })

    test('should handle null publishedAt in snapshot', () => {
      // Arrange
      const snapshot = {
        aggregateId: 'bundle-123',
        correlationId: 'correlation-123',
        version: 0,
        payload: JSON.stringify({
          name: 'Draft Bundle',
          description: 'A draft bundle',
          slug: 'draft-bundle',
          items: [{ variantId: 'variant-1', quantity: 1 }],
          price: 50,
          compareAtPrice: null,
          metaTitle: '',
          metaDescription: '',
          richDescriptionUrl: '',
          tags: [],
          collections: [],
          images: { images: [] },
          taxable: true,
          taxId: '',
          status: 'draft',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          publishedAt: null,
        }),
      }

      // Act
      const bundle = BundleAggregate.loadFromSnapshot(snapshot)

      // Assert
      expect(bundle.toSnapshot().publishedAt).toBeNull()
      expect(bundle.toSnapshot().status).toBe('draft')
    })

    test('should initialize events array as empty', () => {
      // Arrange
      const snapshot = {
        aggregateId: 'bundle-123',
        correlationId: 'correlation-123',
        version: 10,
        payload: JSON.stringify({
          name: 'Test',
          description: 'Test',
          slug: 'test',
          items: [],
          price: 0,
          compareAtPrice: null,
          metaTitle: '',
          metaDescription: '',
          richDescriptionUrl: '',
          tags: [],
          collections: [],
          images: { images: [] },
          taxable: true,
          taxId: '',
          status: 'draft',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          publishedAt: null,
        }),
      }

      // Act
      const bundle = BundleAggregate.loadFromSnapshot(snapshot)

      // Assert
      expect(bundle.events).toEqual([])
    })

    test('should parse dates correctly from snapshot', () => {
      // Arrange
      const createdAt = '2024-01-01T12:00:00.000Z'
      const updatedAt = '2024-01-02T12:00:00.000Z'
      const publishedAt = '2024-01-03T12:00:00.000Z'

      const snapshot = {
        aggregateId: 'bundle-123',
        correlationId: 'correlation-123',
        version: 1,
        payload: JSON.stringify({
          name: 'Test',
          description: 'Test',
          slug: 'test',
          items: [],
          price: 0,
          compareAtPrice: null,
          metaTitle: '',
          metaDescription: '',
          richDescriptionUrl: '',
          tags: [],
          collections: [],
          images: { images: [] },
          taxable: true,
          taxId: '',
          status: 'active',
          createdAt,
          updatedAt,
          publishedAt,
        }),
      }

      // Act
      const bundle = BundleAggregate.loadFromSnapshot(snapshot)

      // Assert
      const bundleSnapshot = bundle.toSnapshot()
      expect(bundleSnapshot.createdAt).toEqual(new Date(createdAt))
      expect(bundleSnapshot.updatedAt).toEqual(new Date(updatedAt))
      expect(bundleSnapshot.publishedAt).toEqual(new Date(publishedAt))
    })

    test('should handle missing optional fields with defaults', () => {
      // Arrange
      const snapshot = {
        aggregateId: 'bundle-123',
        correlationId: 'correlation-123',
        version: 0,
        payload: JSON.stringify({
          name: 'Test',
          description: 'Test',
          slug: 'test',
          price: 0,
          status: 'draft',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        }),
      }

      // Act
      const bundle = BundleAggregate.loadFromSnapshot(snapshot)

      // Assert
      const bundleSnapshot = bundle.toSnapshot()
      expect(bundleSnapshot.items).toEqual([])
      expect(bundleSnapshot.compareAtPrice).toBeNull()
      expect(bundleSnapshot.metaTitle).toBe('')
      expect(bundleSnapshot.metaDescription).toBe('')
      expect(bundleSnapshot.richDescriptionUrl).toBe('')
      expect(bundleSnapshot.tags).toEqual([])
      expect(bundleSnapshot.collections).toEqual([])
      expect(bundleSnapshot.taxable).toBe(true)
      expect(bundleSnapshot.taxId).toBe('')
    })
  })

  describe('toSnapshot', () => {
    test('should return complete snapshot of bundle state', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())

      // Act
      const snapshot = bundle.toSnapshot()

      // Assert
      const params = createValidBundleParams()
      expect(snapshot.id).toBe(bundle.id)
      expect(snapshot.name).toBe(params.name)
      expect(snapshot.description).toBe(params.description)
      expect(snapshot.slug).toBe(params.slug)
      expect(snapshot.items).toEqual(params.items)
      expect(snapshot.price).toBe(params.price)
      expect(snapshot.compareAtPrice).toBe(params.compareAtPrice)
      expect(snapshot.metaTitle).toBe(params.metaTitle)
      expect(snapshot.metaDescription).toBe(params.metaDescription)
      expect(snapshot.richDescriptionUrl).toBe(params.richDescriptionUrl)
      expect(snapshot.tags).toEqual(params.tags)
      expect(snapshot.collections).toEqual(params.collections)
      expect(snapshot.taxable).toBe(params.taxable)
      expect(snapshot.taxId).toBe(params.taxId)
      expect(snapshot.status).toBe('draft')
      expect(snapshot.publishedAt).toBeNull()
      expect(snapshot.version).toBe(bundle.version)
    })

    test('should include null publishedAt in snapshot for draft bundles', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())

      // Act
      const snapshot = bundle.toSnapshot()

      // Assert
      expect(snapshot.publishedAt).toBeNull()
      expect(snapshot.status).toBe('draft')
    })

    test('should include publishedAt in snapshot for published bundles', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      bundle.publish('user-123')

      // Act
      const snapshot = bundle.toSnapshot()

      // Assert
      expect(snapshot.publishedAt).not.toBeNull()
      expect(snapshot.status).toBe('active')
    })

    test('should include current version in snapshot', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      bundle.publish('user-123')
      bundle.uncommittedEvents = []
      bundle.archive('user-123')

      // Act
      const snapshot = bundle.toSnapshot()

      // Assert
      expect(snapshot.version).toBe(2)
    })
  })

  describe('state transitions', () => {
    test('should transition from draft to active via publish', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []

      // Act
      bundle.publish('user-123')

      // Assert
      expect(bundle.toSnapshot().status).toBe('active')
    })

    test('should transition from draft to archived via archive', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []

      // Act
      bundle.archive('user-123')

      // Assert
      expect(bundle.toSnapshot().status).toBe('archived')
    })

    test('should transition from active to archived via archive', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      bundle.publish('user-123')
      bundle.uncommittedEvents = []

      // Act
      bundle.archive('user-123')

      // Assert
      expect(bundle.toSnapshot().status).toBe('archived')
    })

    test('should transition from active to draft via unpublish', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      bundle.publish('user-123')
      bundle.uncommittedEvents = []

      // Act
      bundle.unpublish('user-123')

      // Assert
      expect(bundle.toSnapshot().status).toBe('draft')
    })

    test('should not allow transition from archived to active', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      bundle.archive('user-123')
      bundle.uncommittedEvents = []

      // Act & Assert
      expect(() => bundle.publish('user-123')).toThrow('Cannot publish an archived bundle')
    })

    test('should not allow transition from archived to draft', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      bundle.archive('user-123')
      bundle.uncommittedEvents = []

      // Act & Assert
      expect(() => bundle.unpublish('user-123')).toThrow('Cannot unpublish an archived bundle')
    })

    test('should not allow transition from active to active', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      bundle.publish('user-123')
      bundle.uncommittedEvents = []

      // Act & Assert
      expect(() => bundle.publish('user-123')).toThrow('Bundle is already published')
    })

    test('should not allow transition from draft to draft', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []

      // Act & Assert
      expect(() => bundle.unpublish('user-123')).toThrow('Bundle is already unpublished')
    })

    test('should not allow transition from archived to archived', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []
      bundle.archive('user-123')
      bundle.uncommittedEvents = []

      // Act & Assert
      expect(() => bundle.archive('user-123')).toThrow('Bundle is already archived')
    })
  })

  describe('version management', () => {
    test('should start with version 0', () => {
      // Arrange & Act
      const bundle = BundleAggregate.create(createValidBundleParams())

      // Assert
      expect(bundle.version).toBe(0)
    })

    test('should increment version on publish', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []

      // Act
      bundle.publish('user-123')

      // Assert
      expect(bundle.version).toBe(1)
    })

    test('should increment version on archive', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []

      // Act
      bundle.archive('user-123')

      // Assert
      expect(bundle.version).toBe(1)
    })

    test('should track version correctly through multiple operations', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []

      // Act
      bundle.publish('user-123')
      bundle.uncommittedEvents = []
      bundle.archive('user-123')

      // Assert
      expect(bundle.version).toBe(2)
    })

    test('should track version through many operations', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []

      // Act
      bundle.updateDetails('Name 1', 'Desc 1', 'url1', 'user-123')
      bundle.updatePrice(100, 150, 'user-123')
      bundle.updateMetadata('Meta', 'Desc', ['tag'], 'user-123')
      bundle.updateItems([{ variantId: 'v1', quantity: 1 }], 'user-123')
      bundle.publish('user-123')

      // Assert
      expect(bundle.version).toBe(5)
    })
  })

  describe('uncommittedEvents', () => {
    test('should accumulate uncommitted events', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []

      // Act
      bundle.publish('user-123')
      bundle.archive('user-123')

      // Assert
      expect(bundle.uncommittedEvents).toHaveLength(2)
      expect(bundle.uncommittedEvents[0]).toBeInstanceOf(BundlePublishedEvent)
      expect(bundle.uncommittedEvents[1]).toBeInstanceOf(BundleArchivedEvent)
    })

    test('should preserve event order in uncommittedEvents', () => {
      // Arrange
      const bundle = BundleAggregate.create(createValidBundleParams())
      bundle.uncommittedEvents = []

      // Act
      bundle.publish('user-123')
      bundle.archive('user-123')

      // Assert
      const publishEvent = bundle.uncommittedEvents[0]!
      const archiveEvent = bundle.uncommittedEvents[1]!
      expect(publishEvent.eventName).toBe('bundle.published')
      expect(archiveEvent.eventName).toBe('bundle.archived')
      expect(publishEvent.version).toBe(1)
      expect(archiveEvent.version).toBe(2)
    })
  })

  describe('edge cases', () => {
    test('should handle bundle with empty items', () => {
      // Arrange
      const params = createValidBundleParams()
      params.items = []

      // Act
      const bundle = BundleAggregate.create(params)

      // Assert
      expect(bundle.toSnapshot().items).toEqual([])
    })

    test('should handle bundle with many items', () => {
      // Arrange
      const params = createValidBundleParams()
      params.items = Array.from({ length: 100 }, (_, i) => ({
        variantId: `variant-${i}`,
        quantity: i + 1,
      }))

      // Act
      const bundle = BundleAggregate.create(params)

      // Assert
      expect(bundle.toSnapshot().items).toHaveLength(100)
    })

    test('should handle very long strings', () => {
      // Arrange
      const params = createValidBundleParams()
      params.name = 'A'.repeat(10000)
      params.description = 'B'.repeat(10000)
      params.slug = 'C'.repeat(1000)

      // Act
      const bundle = BundleAggregate.create(params)

      // Assert
      const snapshot = bundle.toSnapshot()
      expect(snapshot.name).toBe('A'.repeat(10000))
      expect(snapshot.description).toBe('B'.repeat(10000))
      expect(snapshot.slug).toBe('C'.repeat(1000))
    })

    test('should handle zero price', () => {
      // Arrange
      const params = createValidBundleParams()
      params.price = 0

      // Act
      const bundle = BundleAggregate.create(params)

      // Assert
      expect(bundle.toSnapshot().price).toBe(0)
    })

    test('should handle decimal prices', () => {
      // Arrange
      const params = createValidBundleParams()
      params.price = 19.99
      params.compareAtPrice = 29.99

      // Act
      const bundle = BundleAggregate.create(params)

      // Assert
      expect(bundle.toSnapshot().price).toBe(19.99)
      expect(bundle.toSnapshot().compareAtPrice).toBe(29.99)
    })

    test('should handle bundle with all optional fields empty', () => {
      // Arrange
      const params = {
        id: 'bundle-123',
        correlationId: 'correlation-123',
        userId: 'user-123',
        name: 'Minimal Bundle',
        description: '',
        slug: 'minimal-bundle',
        items: [{ variantId: 'variant-1', quantity: 1 }],
        price: 0,
      }

      // Act
      const bundle = BundleAggregate.create(params)

      // Assert
      const snapshot = bundle.toSnapshot()
      expect(snapshot.description).toBe('')
      expect(snapshot.compareAtPrice).toBeNull()
      expect(snapshot.metaTitle).toBe('')
      expect(snapshot.metaDescription).toBe('')
      expect(snapshot.richDescriptionUrl).toBe('')
      expect(snapshot.tags).toEqual([])
      expect(snapshot.collections).toEqual([])
      expect(snapshot.taxable).toBe(true)
      expect(snapshot.taxId).toBe('')
    })
  })
})
