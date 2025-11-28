import { describe, test, expect } from 'bun:test'
import { ProductAggregate } from '../../../../src/api/domain/product/aggregate'
import { ProductCreatedEvent, ProductArchivedEvent, ProductPublishedEvent, ProductSlugChangedEvent, ProductDetailsUpdatedEvent, ProductMetadataUpdatedEvent, ProductClassificationUpdatedEvent, ProductTagsUpdatedEvent, ProductCollectionsUpdatedEvent, ProductUpdateProductTaxDetailsEvent } from '../../../../src/api/domain/product/events'

function createValidProductParams() {
  return {
    id: 'product-123',
    correlationId: 'correlation-123',
    userId: 'user-123',
    name: 'Test Product',
    description: 'A test product',
    slug: 'test-product',
    collections: [{ collectionId: 'collection-1', position: 0 }],
    variantIds: ['variant-1'],
    richDescriptionUrl: 'https://example.com/description',
    fulfillmentType: 'digital' as const,
    vendor: 'Test Vendor',
    variantOptions: [{ name: 'Size', values: ['S', 'M', 'L'] }],
    metaTitle: 'Test Product Meta',
    metaDescription: 'Test product description',
    tags: ['tag1', 'tag2'],
    taxable: true,
    taxId: 'TAX123',
    dropshipSafetyBuffer: 2,
  }
}

describe('ProductAggregate', () => {
  describe('create', () => {
    test('should create a new product aggregate with draft status', () => {
      // Arrange
      const params = createValidProductParams()

      // Act
      const product = ProductAggregate.create(params)

      // Assert
      const snapshot = product.toSnapshot()
      expect(product.id).toBe(params.id)
      expect(snapshot.name).toBe(params.name)
      expect(snapshot.description).toBe(params.description)
      expect(snapshot.slug).toBe(params.slug)
      expect(snapshot.collections).toEqual(params.collections)
      expect(snapshot.variantIds).toEqual(params.variantIds)
      expect(snapshot.richDescriptionUrl).toBe(params.richDescriptionUrl)
      expect(snapshot.vendor).toBe(params.vendor)
      expect(snapshot.variantOptions).toEqual(params.variantOptions)
      expect(snapshot.metaTitle).toBe(params.metaTitle)
      expect(snapshot.metaDescription).toBe(params.metaDescription)
      expect(snapshot.tags).toEqual(params.tags)
      expect(snapshot.taxable).toBe(params.taxable)
      expect(snapshot.status).toBe('draft')
      expect(product.version).toBe(0)
      expect(snapshot.publishedAt).toBeNull()
      expect(product.events).toEqual([])
      expect(product.uncommittedEvents).toHaveLength(1)
      const event = product.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(ProductCreatedEvent)
      expect(event.eventName).toBe('product.created')
      expect(event.aggregateId).toBe(params.id)
      expect(event.correlationId).toBe(params.correlationId)
      expect(event.version).toBe(0)
    })

    test('should set createdAt and updatedAt to current time', () => {
      // Arrange
      const params = createValidProductParams()
      const beforeCreate = new Date()

      // Act
      const product = ProductAggregate.create(params)
      const afterCreate = new Date()

      // Assert
      const snapshot = product.toSnapshot()
      expect(snapshot.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime())
      expect(snapshot.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime())
      expect(snapshot.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime())
      expect(snapshot.updatedAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime())
      expect(snapshot.createdAt.getTime()).toBe(snapshot.updatedAt.getTime())
    })

    test('should include all product data in created event payload', () => {
      // Arrange
      const params = createValidProductParams()

      // Act
      const product = ProductAggregate.create(params)
      const event = product.uncommittedEvents[0] as ProductCreatedEvent

      // Assert
      expect(event.payload.priorState).toEqual({} as any)
      expect(event.payload.newState.name).toBe(params.name)
      expect(event.payload.newState.description).toBe(params.description)
      expect(event.payload.newState.slug).toBe(params.slug)
      expect(event.payload.newState.collections).toEqual(params.collections)
      expect(event.payload.newState.variantIds).toEqual(params.variantIds)
      expect(event.payload.newState.richDescriptionUrl).toBe(params.richDescriptionUrl)
      expect(event.payload.newState.vendor).toBe(params.vendor)
      expect(event.payload.newState.variantOptions).toEqual(params.variantOptions)
      expect(event.payload.newState.metaTitle).toBe(params.metaTitle)
      expect(event.payload.newState.metaDescription).toBe(params.metaDescription)
      expect(event.payload.newState.tags).toEqual(params.tags)
      expect(event.payload.newState.taxable).toBe(params.taxable)
      expect(event.payload.newState.status).toBe('draft')
      expect(event.payload.newState.publishedAt).toBeNull()
    })

    test('should allow creating draft product with empty variantIds', () => {
      // Arrange
      const params = createValidProductParams()
      params.variantIds = []

      // Act
      const product = ProductAggregate.create(params)

      // Assert
      expect(product.toSnapshot().variantIds).toEqual([])
      expect(product.toSnapshot().status).toBe('draft')
    })



    test('should allow multiple variants', () => {
      // Arrange
      const params = createValidProductParams()
      params.variantIds = ['variant-1', 'variant-2', 'variant-3']

      // Act
      const product = ProductAggregate.create(params)

      // Assert
      expect(product.toSnapshot().variantIds).toEqual(['variant-1', 'variant-2', 'variant-3'])
    })

    test('should allow multiple collections', () => {
      // Arrange
      const params = createValidProductParams()
      params.collections = [{ collectionId: 'collection-1', position: 0 }, { collectionId: 'collection-2', position: 1 }]

      // Act
      const product = ProductAggregate.create(params)

      // Assert
      expect(product.toSnapshot().collections).toEqual([{ collectionId: 'collection-1', position: 0 }, { collectionId: 'collection-2', position: 1 }])
    })

    test('should allow empty tags array', () => {
      // Arrange
      const params = createValidProductParams()
      params.tags = []

      // Act
      const product = ProductAggregate.create(params)

      // Assert
      expect(product.toSnapshot().tags).toEqual([])
    })

    test('should allow empty variantOptions array', () => {
      // Arrange
      const params = createValidProductParams()
      params.variantOptions = []

      // Act
      const product = ProductAggregate.create(params)

      // Assert
      expect(product.toSnapshot().variantOptions).toEqual([])
    })
  })

  describe('archive', () => {
    test('should archive a draft product', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = [] // Clear creation event for this test

      // Act
      product.archive('user-123')

      // Assert
      expect(product.toSnapshot().status).toBe('archived')
      expect(product.version).toBe(1)
      expect(product.uncommittedEvents).toHaveLength(1)
      const event = product.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(ProductArchivedEvent)
      expect(event.eventName).toBe('product.archived')
      expect(event.version).toBe(1)
    })

    test('should archive an active product', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      product.publish('user-123')
      product.uncommittedEvents = [] // Clear publish event

      // Act
      product.archive('user-123')

      // Assert
      expect(product.toSnapshot().status).toBe('archived')
      expect(product.version).toBe(2)
      expect(product.uncommittedEvents).toHaveLength(1)
      expect(product.uncommittedEvents[0]).toBeInstanceOf(ProductArchivedEvent)
    })

    test('should throw error when product is already archived', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      product.archive('user-123')
      product.uncommittedEvents = [] // Clear archive event

      // Act & Assert
      expect(() => product.archive('user-123')).toThrow('Product is already archived')
    })

    test('should update updatedAt when archiving', async () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const snapshot = product.toSnapshot()
      const originalUpdatedAt = snapshot.updatedAt

      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10))

      // Act
      product.archive('user-123')

      // Assert
      expect(product.toSnapshot().updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should include current state in archived event payload', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      product.archive('user-123')
      const event = product.uncommittedEvents[0] as ProductArchivedEvent

      // Assert
      expect(event.payload.newState.status).toBe('archived')
      const snapshot = product.toSnapshot()
      expect(event.payload.newState.name).toBe(snapshot.name)
      expect(event.payload.newState.slug).toBe(snapshot.slug)
      expect(event.payload.priorState.status).toBe('draft')
    })

    test('should increment version when archiving', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const initialVersion = product.version

      // Act
      product.archive('user-123')

      // Assert
      expect(product.version).toBe(initialVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      const result = product.archive('user-123')

      // Assert
      expect(result).toBe(product)
    })
  })

  describe('publish', () => {
    test('should publish a draft product', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = [] // Clear creation event

      // Act
      product.publish('user-123')

      // Assert
      expect(product.toSnapshot().status).toBe('active')
      expect(product.toSnapshot().publishedAt).not.toBeNull()
      expect(product.version).toBe(1)
      expect(product.uncommittedEvents).toHaveLength(1)
      const event = product.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(ProductPublishedEvent)
      expect(event.eventName).toBe('product.published')
      expect(event.version).toBe(1)
    })

    test('should set publishedAt to current time', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const beforePublish = new Date()

      // Act
      product.publish('user-123')
      const afterPublish = new Date()

      // Assert
      expect(product.toSnapshot().publishedAt).not.toBeNull()
      const snapshot = product.toSnapshot()
      if (snapshot.publishedAt) {
        expect(snapshot.publishedAt.getTime()).toBeGreaterThanOrEqual(beforePublish.getTime())
        expect(snapshot.publishedAt.getTime()).toBeLessThanOrEqual(afterPublish.getTime())
      }
    })

    test('should throw error when product is already published', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      product.publish('user-123')
      product.uncommittedEvents = [] // Clear publish event

      // Act & Assert
      expect(() => product.publish('user-123')).toThrow('Product is already published')
    })

    test('should throw error when trying to publish archived product', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      product.archive('user-123')
      product.uncommittedEvents = [] // Clear archive event

      // Act & Assert
      expect(() => product.publish('user-123')).toThrow('Cannot publish an archived product')
    })

    test('should update updatedAt when publishing', async () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const snapshot = product.toSnapshot()
      const originalUpdatedAt = snapshot.updatedAt

      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10))

      // Act
      product.publish('user-123')

      // Assert
      expect(product.toSnapshot().updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should set publishedAt equal to updatedAt when publishing', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      product.publish('user-123')

      // Assert
      expect(product.toSnapshot().publishedAt).not.toBeNull()
      const snapshot = product.toSnapshot()
      if (snapshot.publishedAt) {
        expect(snapshot.publishedAt.getTime()).toBe(snapshot.updatedAt.getTime())
      }
    })

    test('should include current state in published event payload', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      product.publish('user-123')
      const event = product.uncommittedEvents[0] as ProductPublishedEvent

      // Assert
      const snapshot = product.toSnapshot()
      expect(event.payload.newState.status).toBe('active')
      expect(event.payload.newState.publishedAt).not.toBeNull()
      expect(event.payload.newState.name).toBe(snapshot.name)
      expect(event.payload.newState.slug).toBe(snapshot.slug)
      expect(event.payload.priorState.status).toBe('draft')
    })

    test('should increment version when publishing', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const initialVersion = product.version

      // Act
      product.publish('user-123')

      // Assert
      expect(product.version).toBe(initialVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      const result = product.publish('user-123')

      // Assert
      expect(result).toBe(product)
    })
  })

  describe('changeSlug', () => {
    test('should change slug of a product', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const oldSlug = product.toSnapshot().slug

      // Act
      product.changeSlug('new-slug', 'user-123')

      // Assert
      expect(product.toSnapshot().slug).toBe('new-slug')
      expect(product.uncommittedEvents).toHaveLength(1)
      const event = product.uncommittedEvents[0]!
      expect(event.eventName).toBe('product.slug_changed')
      if (event.eventName === 'product.slug_changed') {
        const slugChangedEvent = event as ProductSlugChangedEvent
        expect(slugChangedEvent.payload.priorState.slug).toBe(oldSlug)
        expect(slugChangedEvent.payload.newState.slug).toBe('new-slug')
        // Verify full product state is included
        expect(slugChangedEvent.payload.newState.name).toBe(product.toSnapshot().name)
        expect(slugChangedEvent.payload.newState.slug).toBe('new-slug')
        expect(slugChangedEvent.payload.newState.status).toBe(product.toSnapshot().status)
        expect(slugChangedEvent.payload.newState.vendor).toBe(product.toSnapshot().vendor)
      }
    })

    test('should throw error when new slug is same as current slug', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const currentSlug = product.toSnapshot().slug

      // Act & Assert
      expect(() => product.changeSlug(currentSlug, 'user-123')).toThrow('New slug must be different from current slug')
    })

    test('should update updatedAt when changing slug', async () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const originalUpdatedAt = product.toSnapshot().updatedAt

      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10))

      // Act
      product.changeSlug('new-slug', 'user-123')

      // Assert
      const newUpdatedAt = product.toSnapshot().updatedAt
      expect(newUpdatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should increment version when changing slug', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const originalVersion = product.version

      // Act
      product.changeSlug('new-slug', 'user-123')

      // Assert
      expect(product.version).toBe(originalVersion + 1)
    })

    test('should include current state in slug changed event', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      product.changeSlug('new-slug', 'user-123')

      // Assert
      const event = product.uncommittedEvents[0]!
      expect(event.version).toBe(1)
      expect(event.aggregateId).toBe(product.id)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      const result = product.changeSlug('new-slug', 'user-123')

      // Assert
      expect(result).toBe(product)
    })
  })

  describe('updateDetails', () => {
    test('should update product details', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const oldName = product.toSnapshot().name
      const oldDescription = product.toSnapshot().description
      const oldRichDescriptionUrl = product.toSnapshot().richDescriptionUrl

      // Act
      product.updateDetails('New Title', 'New Description', 'https://example.com/new-description', 'user-123')

      // Assert
      const snapshot = product.toSnapshot()
      expect(snapshot.name).toBe('New Title')
      expect(snapshot.description).toBe('New Description')
      expect(snapshot.richDescriptionUrl).toBe('https://example.com/new-description')
      expect(product.uncommittedEvents).toHaveLength(1)
      const event = product.uncommittedEvents[0]!
      expect(event.eventName).toBe('product.details_updated')
      if (event.eventName === 'product.details_updated') {
        const detailsUpdatedEvent = event as ProductDetailsUpdatedEvent
        expect(detailsUpdatedEvent.payload.priorState.name).toBe(oldName)
        expect(detailsUpdatedEvent.payload.newState.name).toBe('New Title')
        expect(detailsUpdatedEvent.payload.newState.description).toBe('New Description')
        expect(detailsUpdatedEvent.payload.newState.richDescriptionUrl).toBe('https://example.com/new-description')
      }
    })

    test('should update updatedAt when updating details', async () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const originalUpdatedAt = product.toSnapshot().updatedAt

      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10))

      // Act
      product.updateDetails('New Title', 'New Description', 'https://example.com/new-description', 'user-123')

      // Assert
      const newUpdatedAt = product.toSnapshot().updatedAt
      expect(newUpdatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should increment version when updating details', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const originalVersion = product.version

      // Act
      product.updateDetails('New Title', 'New Description', 'https://example.com/new-description', 'user-123')

      // Assert
      expect(product.version).toBe(originalVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      const result = product.updateDetails('New Title', 'New Description', 'https://example.com/new-description', 'user-123')

      // Assert
      expect(result).toBe(product)
    })
  })

  describe('updateMetadata', () => {
    test('should update product metadata', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const oldMetaTitle = product.toSnapshot().metaTitle
      const oldMetaDescription = product.toSnapshot().metaDescription

      // Act
      product.updateMetadata('New Meta Title', 'New Meta Description', 'user-123')

      // Assert
      const snapshot = product.toSnapshot()
      expect(snapshot.metaTitle).toBe('New Meta Title')
      expect(snapshot.metaDescription).toBe('New Meta Description')
      expect(product.uncommittedEvents).toHaveLength(1)
      const event = product.uncommittedEvents[0]!
      expect(event.eventName).toBe('product.metadata_updated')
      if (event.eventName === 'product.metadata_updated') {
        const metadataUpdatedEvent = event as ProductMetadataUpdatedEvent
        expect(metadataUpdatedEvent.payload.priorState.metaTitle).toBe(oldMetaTitle)
        expect(metadataUpdatedEvent.payload.newState.metaTitle).toBe('New Meta Title')
        expect(metadataUpdatedEvent.payload.newState.metaDescription).toBe('New Meta Description')
      }
    })

    test('should update updatedAt when updating metadata', async () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const originalUpdatedAt = product.toSnapshot().updatedAt

      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10))

      // Act
      product.updateMetadata('New Meta Title', 'New Meta Description', 'user-123')

      // Assert
      const newUpdatedAt = product.toSnapshot().updatedAt
      expect(newUpdatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should increment version when updating metadata', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const originalVersion = product.version

      // Act
      product.updateMetadata('New Meta Title', 'New Meta Description', 'user-123')

      // Assert
      expect(product.version).toBe(originalVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      const result = product.updateMetadata('New Meta Title', 'New Meta Description', 'user-123')

      // Assert
      expect(result).toBe(product)
    })
  })

  describe('updateVendor', () => {
    test('should update product vendor', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const oldVendor = product.toSnapshot().vendor

      // Act
      product.updateVendor('New Vendor', 'user-123')

      // Assert
      const snapshot = product.toSnapshot()
      expect(snapshot.vendor).toBe('New Vendor')
      expect(product.uncommittedEvents).toHaveLength(1)
      const event = product.uncommittedEvents[0]!
      expect(event.eventName).toBe('product.classification_updated')
      if (event.eventName === 'product.classification_updated') {
        const classificationUpdatedEvent = event as ProductClassificationUpdatedEvent
        expect(classificationUpdatedEvent.payload.priorState.vendor).toBe(oldVendor)
        expect(classificationUpdatedEvent.payload.newState.vendor).toBe('New Vendor')
      }
    })

    test('should update updatedAt when updating vendor', async () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const originalUpdatedAt = product.toSnapshot().updatedAt

      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10))

      // Act
      product.updateVendor('New Vendor', 'user-123')

      // Assert
      const newUpdatedAt = product.toSnapshot().updatedAt
      expect(newUpdatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should increment version when updating vendor', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const originalVersion = product.version

      // Act
      product.updateVendor('New Vendor', 'user-123')

      // Assert
      expect(product.version).toBe(originalVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      const result = product.updateVendor('New Vendor', 'user-123')

      // Assert
      expect(result).toBe(product)
    })
  })

  describe('updateTags', () => {
    test('should update product tags', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const oldTags = product.toSnapshot().tags

      // Act
      product.updateTags(['new-tag1', 'new-tag2', 'new-tag3'], 'user-123')

      // Assert
      const snapshot = product.toSnapshot()
      expect(snapshot.tags).toEqual(['new-tag1', 'new-tag2', 'new-tag3'])
      expect(product.uncommittedEvents).toHaveLength(1)
      const event = product.uncommittedEvents[0]!
      expect(event.eventName).toBe('product.tags_updated')
      if (event.eventName === 'product.tags_updated') {
        const tagsUpdatedEvent = event as ProductTagsUpdatedEvent
        expect(tagsUpdatedEvent.payload.priorState.tags).toEqual(oldTags)
        expect(tagsUpdatedEvent.payload.newState.tags).toEqual(['new-tag1', 'new-tag2', 'new-tag3'])
      }
    })

    test('should allow empty tags array', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      product.updateTags([], 'user-123')

      // Assert
      const snapshot = product.toSnapshot()
      expect(snapshot.tags).toEqual([])
    })

    test('should update updatedAt when updating tags', async () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const originalUpdatedAt = product.toSnapshot().updatedAt

      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10))

      // Act
      product.updateTags(['new-tag'], 'user-123')

      // Assert
      const newUpdatedAt = product.toSnapshot().updatedAt
      expect(newUpdatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should increment version when updating tags', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const originalVersion = product.version

      // Act
      product.updateTags(['new-tag'], 'user-123')

      // Assert
      expect(product.version).toBe(originalVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      const result = product.updateTags(['new-tag'], 'user-123')

      // Assert
      expect(result).toBe(product)
    })
  })

  describe('updateCollections', () => {
    test('should update product collections', () => {
      // Arrange
      const userId = 'user-123'
      const product = ProductAggregate.create({
        ...createValidProductParams(),
        userId,
      })
      product.uncommittedEvents = []
      const oldCollections = product.toSnapshot().collections

      // Act
      product.updateCollections([{ collectionId: 'collection-2', position: 0 }, { collectionId: 'collection-3', position: 1 }], userId)

      // Assert
      const snapshot = product.toSnapshot()
      expect(snapshot.collections).toEqual([{ collectionId: 'collection-2', position: 0 }, { collectionId: 'collection-3', position: 1 }])
      expect(product.uncommittedEvents).toHaveLength(1)
      const event = product.uncommittedEvents[0]!
      expect(event.eventName).toBe('product.collections_updated')
      if (event.eventName === 'product.collections_updated') {
        const collectionsUpdatedEvent = event as ProductCollectionsUpdatedEvent
        expect(collectionsUpdatedEvent.payload.priorState.collections).toEqual(oldCollections)
        expect(collectionsUpdatedEvent.payload.newState.collections).toEqual([{ collectionId: 'collection-2', position: 0 }, { collectionId: 'collection-3', position: 1 }])
        expect(collectionsUpdatedEvent.userId).toBe(userId)
      }
    })

    test('should allow empty collections array', () => {
      // Arrange
      const userId = 'user-123'
      const product = ProductAggregate.create({
        ...createValidProductParams(),
        userId,
      })
      product.uncommittedEvents = []

      // Act
      product.updateCollections([], userId)

      // Assert
      const snapshot = product.toSnapshot()
      expect(snapshot.collections).toEqual([])
    })

    test('should allow single collection', () => {
      // Arrange
      const userId = 'user-123'
      const product = ProductAggregate.create({
        ...createValidProductParams(),
        userId,
      })
      product.uncommittedEvents = []

      // Act
      product.updateCollections([{ collectionId: 'collection-solo', position: 0 }], userId)

      // Assert
      const snapshot = product.toSnapshot()
      expect(snapshot.collections).toEqual([{ collectionId: 'collection-solo', position: 0 }])
    })

    test('should allow many collections', () => {
      // Arrange
      const userId = 'user-123'
      const product = ProductAggregate.create({
        ...createValidProductParams(),
        userId,
      })
      product.uncommittedEvents = []
      const manyCollections = Array.from({ length: 50 }, (_, i) => ({ collectionId: `collection-${i}`, position: i }))

      // Act
      product.updateCollections(manyCollections, userId)

      // Assert
      const snapshot = product.toSnapshot()
      expect(snapshot.collections).toEqual(manyCollections)
    })

    test('should update updatedAt when updating collections', async () => {
      // Arrange
      const userId = 'user-123'
      const product = ProductAggregate.create({
        ...createValidProductParams(),
        userId,
      })
      product.uncommittedEvents = []
      const originalUpdatedAt = product.toSnapshot().updatedAt

      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10))

      // Act
      product.updateCollections([{ collectionId: 'new-collection', position: 0 }], userId)

      // Assert
      const newUpdatedAt = product.toSnapshot().updatedAt
      expect(newUpdatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should increment version when updating collections', () => {
      // Arrange
      const userId = 'user-123'
      const product = ProductAggregate.create({
        ...createValidProductParams(),
        userId,
      })
      product.uncommittedEvents = []
      const originalVersion = product.version

      // Act
      product.updateCollections([{ collectionId: 'new-collection', position: 0 }], userId)

      // Assert
      expect(product.version).toBe(originalVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const userId = 'user-123'
      const product = ProductAggregate.create({
        ...createValidProductParams(),
        userId,
      })
      product.uncommittedEvents = []

      // Act
      const result = product.updateCollections([{ collectionId: 'new-collection', position: 0 }], userId)

      // Assert
      expect(result).toBe(product)
    })

    test('should include complete state in event payload', () => {
      // Arrange
      const userId = 'user-123'
      const product = ProductAggregate.create({
        ...createValidProductParams(),
        userId,
      })
      product.uncommittedEvents = []
      const oldSnapshot = product.toSnapshot()

      // Act
      product.updateCollections([{ collectionId: 'collection-updated', position: 0 }], userId)
      const event = product.uncommittedEvents[0]!

      // Assert
      expect(event.version).toBe(1)
      expect(event.aggregateId).toBe(product.id)
      if (event.eventName === 'product.collections_updated') {
        const collectionsUpdatedEvent = event as ProductCollectionsUpdatedEvent
        expect(collectionsUpdatedEvent.payload.priorState.collections).toEqual(oldSnapshot.collections)
        expect(collectionsUpdatedEvent.payload.priorState.name).toBe(oldSnapshot.name)
        expect(collectionsUpdatedEvent.payload.newState.collections).toEqual([{ collectionId: 'collection-updated', position: 0 }])
        expect(collectionsUpdatedEvent.payload.newState.name).toBe(oldSnapshot.name)
      }
    })

    test('should allow updating collections on draft product', () => {
      // Arrange
      const userId = 'user-123'
      const product = ProductAggregate.create({
        ...createValidProductParams(),
        userId,
      })
      product.uncommittedEvents = []

      // Act
      product.updateCollections([{ collectionId: 'collection-draft', position: 0 }], userId)

      // Assert
      expect(product.toSnapshot().status).toBe('draft')
      expect(product.toSnapshot().collections).toEqual([{ collectionId: 'collection-draft', position: 0 }])
    })

    test('should allow updating collections on active product', () => {
      // Arrange
      const userId = 'user-123'
      const product = ProductAggregate.create({
        ...createValidProductParams(),
        userId,
      })
      product.uncommittedEvents = []
      product.publish(userId)
      product.uncommittedEvents = []

      // Act
      product.updateCollections([{ collectionId: 'collection-active', position: 0 }], userId)

      // Assert
      expect(product.toSnapshot().status).toBe('active')
      expect(product.toSnapshot().collections).toEqual([{ collectionId: 'collection-active', position: 0 }])
    })

    test('should allow updating collections on archived product', () => {
      // Arrange
      const userId = 'user-123'
      const product = ProductAggregate.create({
        ...createValidProductParams(),
        userId,
      })
      product.uncommittedEvents = []
      product.archive(userId)
      product.uncommittedEvents = []

      // Act
      product.updateCollections([{ collectionId: 'collection-archived', position: 0 }], userId)

      // Assert
      expect(product.toSnapshot().status).toBe('archived')
      expect(product.toSnapshot().collections).toEqual([{ collectionId: 'collection-archived', position: 0 }])
    })
  })

  describe('loadFromSnapshot', () => {
    test('should load product from snapshot', () => {
      // Arrange
      const snapshot = {
        aggregateId: 'product-123',
        correlationId: 'correlation-123',
        version: 5,
        payload: JSON.stringify({
          name: 'Snapshot Product',
          description: 'A product from snapshot',
          slug: 'snapshot-product',
          collections: [{ collectionId: 'collection-1', position: 0 }],
          variantIds: ['variant-1'],
          richDescriptionUrl: 'https://example.com/description',
          fulfillmentType: 'digital' as const,
          vendor: 'Test Vendor',
          variantOptions: [{ name: 'Size', values: ['S', 'M'] }],
          metaTitle: 'Meta Title',
          metaDescription: 'Meta Description',
          tags: ['tag1'],
          requiresShipping: true,
          taxable: false,
          pageLayoutId: 'layout-123',
          status: 'active',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
          publishedAt: '2024-01-02T00:00:00.000Z',
        }),
      }

      // Act
      const product = ProductAggregate.loadFromSnapshot(snapshot)

      // Assert
      const productSnapshot = product.toSnapshot()
      expect(product.id).toBe('product-123')
      expect(productSnapshot.name).toBe('Snapshot Product')
      expect(productSnapshot.description).toBe('A product from snapshot')
      expect(productSnapshot.slug).toBe('snapshot-product')
      expect(productSnapshot.collections).toEqual([{ collectionId: 'collection-1', position: 0 }])
      expect(productSnapshot.variantIds).toEqual(['variant-1'])
      expect(productSnapshot.richDescriptionUrl).toBe('https://example.com/description')
      expect(productSnapshot.vendor).toBe('Test Vendor')
      expect(productSnapshot.variantOptions).toEqual([{ name: 'Size', values: ['S', 'M'] }])
      expect(productSnapshot.metaTitle).toBe('Meta Title')
      expect(productSnapshot.metaDescription).toBe('Meta Description')
      expect(productSnapshot.tags).toEqual(['tag1'])
      expect(productSnapshot.taxable).toBe(false)
      expect(productSnapshot.status).toBe('active')
      expect(product.version).toBe(5)
      expect(productSnapshot.publishedAt).not.toBeNull()
      expect(product.events).toEqual([])
    })

    test('should handle null publishedAt in snapshot', () => {
      // Arrange
      const snapshot = {
        aggregateId: 'product-123',
        correlationId: 'correlation-123',
        version: 0,
        payload: JSON.stringify({
          name: 'Draft Product',
          description: 'A draft product',
          slug: 'draft-product',
          collections: [{ collectionId: 'collection-1', position: 0 }],
          variantIds: ['variant-1'],
          richDescriptionUrl: 'https://example.com/description',
          fulfillmentType: 'digital' as const,
          vendor: 'Test Vendor',
          variantOptions: [],
          metaTitle: 'Meta Title',
          metaDescription: 'Meta Description',
          tags: [],
          requiresShipping: true,
          taxable: true,
          pageLayoutId: null,
          status: 'draft',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          publishedAt: null,
        }),
      }

      // Act
      const product = ProductAggregate.loadFromSnapshot(snapshot)

      // Assert
      expect(product.toSnapshot().publishedAt).toBeNull()
      expect(product.toSnapshot().status).toBe('draft')
    })

    test('should initialize events array as empty', () => {
      // Arrange
      const snapshot = {
        aggregateId: 'product-123',
        correlationId: 'correlation-123',
        version: 10,
        payload: JSON.stringify({
          name: 'Test',
          description: 'Test',
          slug: 'test',
          collections: [{ collectionId: 'collection-1', position: 0 }],
          variantIds: ['variant-1'],
          richDescriptionUrl: 'https://example.com',
          fulfillmentType: 'digital' as const,
          vendor: 'Test',
          variantOptions: [],
          metaTitle: 'Test',
          metaDescription: 'Test',
          tags: [],
          requiresShipping: true,
          taxable: true,
          pageLayoutId: null,
          status: 'draft',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          publishedAt: null,
        }),
      }

      // Act
      const product = ProductAggregate.loadFromSnapshot(snapshot)

      // Assert
      expect(product.events).toEqual([])
    })

    test('should parse dates correctly from snapshot', () => {
      // Arrange
      const createdAt = '2024-01-01T12:00:00.000Z'
      const updatedAt = '2024-01-02T12:00:00.000Z'
      const publishedAt = '2024-01-03T12:00:00.000Z'

      const snapshot = {
        aggregateId: 'product-123',
        correlationId: 'correlation-123',
        version: 1,
        payload: JSON.stringify({
          name: 'Test',
          description: 'Test',
          slug: 'test',
          collections: [{ collectionId: 'collection-1', position: 0 }],
          variantIds: ['variant-1'],
          richDescriptionUrl: 'https://example.com',
          fulfillmentType: 'digital' as const,
          vendor: 'Test',
          variantOptions: [],
          metaTitle: 'Test',
          metaDescription: 'Test',
          tags: [],
          requiresShipping: true,
          taxable: true,
          pageLayoutId: null,
          status: 'active',
          createdAt,
          updatedAt,
          publishedAt,
        }),
      }

      // Act
      const product = ProductAggregate.loadFromSnapshot(snapshot)

      // Assert
      const productSnapshot = product.toSnapshot()
      expect(productSnapshot.createdAt).toEqual(new Date(createdAt))
      expect(productSnapshot.updatedAt).toEqual(new Date(updatedAt))
      expect(productSnapshot.publishedAt).toEqual(new Date(publishedAt))
    })
  })

  describe('toSnapshot', () => {
    test('should return complete snapshot of product state', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())

      // Act
      const snapshot = product.toSnapshot()

      // Assert
      const params = createValidProductParams()
      expect(snapshot.id).toBe(product.id)
      expect(snapshot.name).toBe(params.name)
      expect(snapshot.description).toBe(params.description)
      expect(snapshot.slug).toBe(params.slug)
      expect(snapshot.collections).toEqual(params.collections)
      expect(snapshot.variantIds).toEqual(params.variantIds)
      expect(snapshot.richDescriptionUrl).toBe(params.richDescriptionUrl)
      expect(snapshot.vendor).toBe(params.vendor)
      expect(snapshot.variantOptions).toEqual(params.variantOptions)
      expect(snapshot.metaTitle).toBe(params.metaTitle)
      expect(snapshot.metaDescription).toBe(params.metaDescription)
      expect(snapshot.tags).toEqual(params.tags)
      expect(snapshot.taxable).toBe(params.taxable)
      expect(snapshot.status).toBe('draft')
      expect(snapshot.publishedAt).toBeNull()
      expect(snapshot.version).toBe(product.version)
    })

    test('should include null publishedAt in snapshot for draft products', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())

      // Act
      const snapshot = product.toSnapshot()

      // Assert
      expect(snapshot.publishedAt).toBeNull()
      expect(snapshot.status).toBe('draft')
    })

    test('should include publishedAt in snapshot for published products', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      product.publish('user-123')

      // Act
      const snapshot = product.toSnapshot()

      // Assert
      expect(snapshot.publishedAt).not.toBeNull()
      expect(snapshot.status).toBe('active')
      expect(snapshot.publishedAt).not.toBeNull()
    })

    test('should include current version in snapshot', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      product.publish('user-123')
      product.uncommittedEvents = []
      product.archive('user-123')

      // Act
      const snapshot = product.toSnapshot()

      // Assert
      expect(snapshot.version).toBe(2)
    })
  })

  describe('state transitions', () => {
    test('should transition from draft to active via publish', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      product.publish('user-123')

      // Assert
      expect(product.toSnapshot().status).toBe('active')
    })

    test('should transition from draft to archived via archive', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      product.archive('user-123')

      // Assert
      expect(product.toSnapshot().status).toBe('archived')
    })

    test('should transition from active to archived via archive', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      product.publish('user-123')
      product.uncommittedEvents = []

      // Act
      product.archive('user-123')

      // Assert
      expect(product.toSnapshot().status).toBe('archived')
    })

    test('should not allow transition from archived to active', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      product.archive('user-123')
      product.uncommittedEvents = []

      // Act & Assert
      expect(() => product.publish('user-123')).toThrow('Cannot publish an archived product')
    })

    test('should not allow transition from active to active', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      product.publish('user-123')
      product.uncommittedEvents = []

      // Act & Assert
      expect(() => product.publish('user-123')).toThrow('Product is already published')
    })

    test('should not allow transition from archived to archived', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      product.archive('user-123')
      product.uncommittedEvents = []

      // Act & Assert
      expect(() => product.archive('user-123')).toThrow('Product is already archived')
    })
  })

  describe('version management', () => {
    test('should start with version 0', () => {
      // Arrange & Act
      const product = ProductAggregate.create(createValidProductParams())

      // Assert
      expect(product.version).toBe(0)
    })

    test('should increment version on publish', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      product.publish('user-123')

      // Assert
      expect(product.version).toBe(1)
    })

    test('should increment version on archive', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      product.archive('user-123')

      // Assert
      expect(product.version).toBe(1)
    })

    test('should track version correctly through multiple operations', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      product.publish('user-123')
      product.uncommittedEvents = []
      product.archive('user-123')

      // Assert
      expect(product.version).toBe(2)
    })
  })

  describe('uncommittedEvents', () => {
    test('should accumulate uncommitted events', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      product.publish('user-123')
      product.archive('user-123')

      // Assert
      expect(product.uncommittedEvents).toHaveLength(2)
      expect(product.uncommittedEvents[0]).toBeInstanceOf(ProductPublishedEvent)
      expect(product.uncommittedEvents[1]).toBeInstanceOf(ProductArchivedEvent)
    })
  })

  describe('edge cases', () => {
    test('should handle product with all optional fields', () => {
      // Arrange
      const params = createValidProductParams()
      params.tags = []
      params.variantOptions = []

      // Act
      const product = ProductAggregate.create(params)

      // Assert
      const snapshot = product.toSnapshot()
      expect(snapshot.tags).toEqual([])
      expect(snapshot.variantOptions).toEqual([])
    })

    test('should handle product with many variants and collections', () => {
      // Arrange
      const params = createValidProductParams()
      params.variantIds = Array.from({ length: 100 }, (_, i) => `variant-${i}`)
      params.collections = Array.from({ length: 50 }, (_, i) => ({ collectionId: `collection-${i}`, position: i }))

      // Act
      const product = ProductAggregate.create(params)

      // Assert
      const snapshot = product.toSnapshot()
      expect(snapshot.variantIds).toHaveLength(100)
      expect(snapshot.collections).toHaveLength(50)
    })

    test('should handle very long strings', () => {
      // Arrange
      const params = createValidProductParams()
      params.name = 'A'.repeat(10000)
      params.description = 'B'.repeat(10000)
      params.slug = 'C'.repeat(1000)

      // Act
      const product = ProductAggregate.create(params)

      // Assert
      const snapshot = product.toSnapshot()
      expect(snapshot.name).toBe('A'.repeat(10000))
      expect(snapshot.description).toBe('B'.repeat(10000))
      expect(snapshot.slug).toBe('C'.repeat(1000))
    })

    test('should preserve event order in uncommittedEvents', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      product.publish('user-123')
      product.archive('user-123')

      // Assert
      expect(product.uncommittedEvents).toHaveLength(2)
      const publishEvent = product.uncommittedEvents[0]!
      const archiveEvent = product.uncommittedEvents[1]!
      expect(publishEvent.eventName).toBe('product.published')
      expect(archiveEvent.eventName).toBe('product.archived')
      expect(publishEvent.version).toBe(1)
      expect(archiveEvent.version).toBe(2)
    })
  })

  describe('updateProductTaxDetails', () => {
    test('should update product tax details', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const oldTaxable = product.toSnapshot().taxable
      const oldTaxId = product.toSnapshot().taxId

      // Act
      product.updateProductTaxDetails(false, 'NEW-TAX-ID', 'user-123')

      // Assert
      const snapshot = product.toSnapshot()
      expect(snapshot.taxable).toBe(false)
      expect(snapshot.taxId).toBe('NEW-TAX-ID')
      expect(product.uncommittedEvents).toHaveLength(1)
      const event = product.uncommittedEvents[0]!
      expect(event.eventName).toBe('product.update_product_tax_details')
      if (event.eventName === 'product.update_product_tax_details') {
        const taxDetailsEvent = event as ProductUpdateProductTaxDetailsEvent
        expect(taxDetailsEvent.payload.priorState.taxable).toBe(oldTaxable)
        expect(taxDetailsEvent.payload.priorState.taxId).toBe(oldTaxId)
        expect(taxDetailsEvent.payload.newState.taxable).toBe(false)
        expect(taxDetailsEvent.payload.newState.taxId).toBe('NEW-TAX-ID')
      }
    })

    test('should update taxable from true to false', () => {
      // Arrange
      const params = createValidProductParams()
      params.taxable = true
      const product = ProductAggregate.create(params)
      product.uncommittedEvents = []

      // Act
      product.updateProductTaxDetails(false, 'TAX123', 'user-123')

      // Assert
      const snapshot = product.toSnapshot()
      expect(snapshot.taxable).toBe(false)
    })

    test('should update taxable from false to true', () => {
      // Arrange
      const params = createValidProductParams()
      params.taxable = false
      const product = ProductAggregate.create(params)
      product.uncommittedEvents = []

      // Act
      product.updateProductTaxDetails(true, 'TAX123', 'user-123')

      // Assert
      const snapshot = product.toSnapshot()
      expect(snapshot.taxable).toBe(true)
    })

    test('should update taxId to new value', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      product.updateProductTaxDetails(true, 'NEW-TAX-CODE', 'user-123')

      // Assert
      const snapshot = product.toSnapshot()
      expect(snapshot.taxId).toBe('NEW-TAX-CODE')
    })

    test('should update both taxable and taxId together', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      product.updateProductTaxDetails(false, 'UPDATED-TAX-ID', 'user-123')

      // Assert
      const snapshot = product.toSnapshot()
      expect(snapshot.taxable).toBe(false)
      expect(snapshot.taxId).toBe('UPDATED-TAX-ID')
    })

    test('should update updatedAt when updating tax details', async () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const originalUpdatedAt = product.toSnapshot().updatedAt

      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10))

      // Act
      product.updateProductTaxDetails(false, 'NEW-TAX-ID', 'user-123')

      // Assert
      const newUpdatedAt = product.toSnapshot().updatedAt
      expect(newUpdatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should increment version when updating tax details', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const originalVersion = product.version

      // Act
      product.updateProductTaxDetails(false, 'NEW-TAX-ID', 'user-123')

      // Assert
      expect(product.version).toBe(originalVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      const result = product.updateProductTaxDetails(false, 'NEW-TAX-ID', 'user-123')

      // Assert
      expect(result).toBe(product)
    })

    test('should include complete state in event payload', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      product.updateProductTaxDetails(false, 'NEW-TAX-ID', 'user-123')

      // Assert
      const event = product.uncommittedEvents[0] as ProductUpdateProductTaxDetailsEvent
      expect(event.payload.newState).toMatchObject({
        taxable: false,
        taxId: 'NEW-TAX-ID'
      })
      // Verify the event includes other product fields
      expect(event.payload.newState.name).toBeDefined()
      expect(event.payload.newState.slug).toBeDefined()
      expect(event.payload.newState.status).toBeDefined()
    })

    test('should emit event with correct metadata', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const version = product.version

      // Act
      product.updateProductTaxDetails(false, 'NEW-TAX-ID', 'user-456')

      // Assert
      const event = product.uncommittedEvents[0] as ProductUpdateProductTaxDetailsEvent
      expect(event.aggregateId).toBe(product.id)
      expect(event.version).toBe(version + 1)
      expect(event.userId).toBe('user-456')
      expect(event.occurredAt).toBeInstanceOf(Date)
    })
  })
})

