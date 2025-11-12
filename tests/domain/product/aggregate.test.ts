import { describe, test, expect } from 'bun:test'
import { ProductAggregate } from '../../../src/domain/product/aggregate'
import { ProductCreatedEvent, ProductArchivedEvent, ProductPublishedEvent, ProductSlugChangedEvent, ProductDetailsUpdatedEvent, ProductMetadataUpdatedEvent, ProductClassificationUpdatedEvent, ProductTagsUpdatedEvent, ProductShippingSettingsUpdatedEvent, ProductPageLayoutUpdatedEvent } from '../../../src/domain/product/events'
import type { DomainEvent } from '../../../src/domain/_base/domainEvent'

function createValidProductParams() {
  return {
    id: 'product-123',
    correlationId: 'correlation-123',
    title: 'Test Product',
    shortDescription: 'A test product',
    slug: 'test-product',
    collectionIds: ['collection-1'],
    variantIds: ['variant-1'],
    richDescriptionUrl: 'https://example.com/description',
    productType: 'physical',
    vendor: 'Test Vendor',
    variantOptions: [{ name: 'Size', values: ['S', 'M', 'L'] }],
    metaTitle: 'Test Product Meta',
    metaDescription: 'Test product description',
    tags: ['tag1', 'tag2'],
    requiresShipping: true,
    taxable: true,
    pageLayoutId: 'layout-123',
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
      expect(snapshot.title).toBe(params.title)
      expect(snapshot.shortDescription).toBe(params.shortDescription)
      expect(snapshot.slug).toBe(params.slug)
      expect(snapshot.collectionIds).toEqual(params.collectionIds)
      expect(snapshot.variantIds).toEqual(params.variantIds)
      expect(snapshot.richDescriptionUrl).toBe(params.richDescriptionUrl)
      expect(snapshot.productType).toBe(params.productType)
      expect(snapshot.vendor).toBe(params.vendor)
      expect(snapshot.variantOptions).toEqual(params.variantOptions)
      expect(snapshot.metaTitle).toBe(params.metaTitle)
      expect(snapshot.metaDescription).toBe(params.metaDescription)
      expect(snapshot.tags).toEqual(params.tags)
      expect(snapshot.requiresShipping).toBe(params.requiresShipping)
      expect(snapshot.taxable).toBe(params.taxable)
      expect(snapshot.pageLayoutId).toBe(params.pageLayoutId)
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
      expect(event.payload.newState.title).toBe(params.title)
      expect(event.payload.newState.shortDescription).toBe(params.shortDescription)
      expect(event.payload.newState.slug).toBe(params.slug)
      expect(event.payload.newState.collectionIds).toEqual(params.collectionIds)
      expect(event.payload.newState.variantIds).toEqual(params.variantIds)
      expect(event.payload.newState.richDescriptionUrl).toBe(params.richDescriptionUrl)
      expect(event.payload.newState.productType).toBe(params.productType)
      expect(event.payload.newState.vendor).toBe(params.vendor)
      expect(event.payload.newState.variantOptions).toEqual(params.variantOptions)
      expect(event.payload.newState.metaTitle).toBe(params.metaTitle)
      expect(event.payload.newState.metaDescription).toBe(params.metaDescription)
      expect(event.payload.newState.tags).toEqual(params.tags)
      expect(event.payload.newState.requiresShipping).toBe(params.requiresShipping)
      expect(event.payload.newState.taxable).toBe(params.taxable)
      expect(event.payload.newState.pageLayoutId).toBe(params.pageLayoutId)
      expect(event.payload.newState.status).toBe('draft')
      expect(event.payload.newState.publishedAt).toBeNull()
    })

    test('should throw error when variantIds is empty', () => {
      // Arrange
      const params = createValidProductParams()
      params.variantIds = []

      // Act & Assert
      expect(() => ProductAggregate.create(params)).toThrow('Product must have at least one variant')
    })

    test('should throw error when collectionIds is empty', () => {
      // Arrange
      const params = createValidProductParams()
      params.collectionIds = []

      // Act & Assert
      expect(() => ProductAggregate.create(params)).toThrow('Product must have at least one collection')
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
      params.collectionIds = ['collection-1', 'collection-2']

      // Act
      const product = ProductAggregate.create(params)

      // Assert
      expect(product.toSnapshot().collectionIds).toEqual(['collection-1', 'collection-2'])
    })

    test('should allow null pageLayoutId', () => {
      // Arrange
      const params = createValidProductParams()
      params.pageLayoutId = null as any

      // Act
      const product = ProductAggregate.create(params)

      // Assert
      expect(product.toSnapshot().pageLayoutId).toBeNull()
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
      product.archive()

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
      product.publish()
      product.uncommittedEvents = [] // Clear publish event

      // Act
      product.archive()

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
      product.archive()
      product.uncommittedEvents = [] // Clear archive event

      // Act & Assert
      expect(() => product.archive()).toThrow('Product is already archived')
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
      product.archive()

      // Assert
      expect(product.toSnapshot().updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should include current state in archived event payload', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      product.archive()
      const event = product.uncommittedEvents[0] as ProductArchivedEvent

      // Assert
      expect(event.payload.newState.status).toBe('archived')
      const snapshot = product.toSnapshot()
      expect(event.payload.newState.title).toBe(snapshot.title)
      expect(event.payload.newState.slug).toBe(snapshot.slug)
      expect(event.payload.priorState.status).toBe('draft')
    })

    test('should increment version when archiving', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const initialVersion = product.version

      // Act
      product.archive()

      // Assert
      expect(product.version).toBe(initialVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      const result = product.archive()

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
      product.publish()

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
      product.publish()
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
      product.publish()
      product.uncommittedEvents = [] // Clear publish event

      // Act & Assert
      expect(() => product.publish()).toThrow('Product is already published')
    })

    test('should throw error when trying to publish archived product', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      product.archive()
      product.uncommittedEvents = [] // Clear archive event

      // Act & Assert
      expect(() => product.publish()).toThrow('Cannot publish an archived product')
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
      product.publish()

      // Assert
      expect(product.toSnapshot().updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should set publishedAt equal to updatedAt when publishing', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      product.publish()

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
      product.publish()
      const event = product.uncommittedEvents[0] as ProductPublishedEvent

      // Assert
      const snapshot = product.toSnapshot()
      expect(event.payload.newState.status).toBe('active')
      expect(event.payload.newState.publishedAt).not.toBeNull()
      expect(event.payload.newState.title).toBe(snapshot.title)
      expect(event.payload.newState.slug).toBe(snapshot.slug)
      expect(event.payload.priorState.status).toBe('draft')
    })

    test('should increment version when publishing', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const initialVersion = product.version

      // Act
      product.publish()

      // Assert
      expect(product.version).toBe(initialVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      const result = product.publish()

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
      product.changeSlug('new-slug')

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
        expect(slugChangedEvent.payload.newState.title).toBe(product.toSnapshot().title)
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
      expect(() => product.changeSlug(currentSlug)).toThrow('New slug must be different from current slug')
    })

    test('should update updatedAt when changing slug', async () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const originalUpdatedAt = product.toSnapshot().updatedAt
      
      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10))

      // Act
      product.changeSlug('new-slug')

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
      product.changeSlug('new-slug')

      // Assert
      expect(product.version).toBe(originalVersion + 1)
    })

    test('should include current state in slug changed event', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      product.changeSlug('new-slug')

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
      const result = product.changeSlug('new-slug')

      // Assert
      expect(result).toBe(product)
    })
  })

  describe('updateDetails', () => {
    test('should update product details', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const oldTitle = product.toSnapshot().title
      const oldShortDescription = product.toSnapshot().shortDescription
      const oldRichDescriptionUrl = product.toSnapshot().richDescriptionUrl

      // Act
      product.updateDetails('New Title', 'New Description', 'https://example.com/new-description')

      // Assert
      const snapshot = product.toSnapshot()
      expect(snapshot.title).toBe('New Title')
      expect(snapshot.shortDescription).toBe('New Description')
      expect(snapshot.richDescriptionUrl).toBe('https://example.com/new-description')
      expect(product.uncommittedEvents).toHaveLength(1)
      const event = product.uncommittedEvents[0]!
      expect(event.eventName).toBe('product.details_updated')
      if (event.eventName === 'product.details_updated') {
        const detailsUpdatedEvent = event as ProductDetailsUpdatedEvent
        expect(detailsUpdatedEvent.payload.priorState.title).toBe(oldTitle)
        expect(detailsUpdatedEvent.payload.newState.title).toBe('New Title')
        expect(detailsUpdatedEvent.payload.newState.shortDescription).toBe('New Description')
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
      product.updateDetails('New Title', 'New Description', 'https://example.com/new-description')

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
      product.updateDetails('New Title', 'New Description', 'https://example.com/new-description')

      // Assert
      expect(product.version).toBe(originalVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      const result = product.updateDetails('New Title', 'New Description', 'https://example.com/new-description')

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
      product.updateMetadata('New Meta Title', 'New Meta Description')

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
      product.updateMetadata('New Meta Title', 'New Meta Description')

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
      product.updateMetadata('New Meta Title', 'New Meta Description')

      // Assert
      expect(product.version).toBe(originalVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      const result = product.updateMetadata('New Meta Title', 'New Meta Description')

      // Assert
      expect(result).toBe(product)
    })
  })

  describe('updateClassification', () => {
    test('should update product classification', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const oldProductType = product.toSnapshot().productType
      const oldVendor = product.toSnapshot().vendor

      // Act
      product.updateClassification('digital', 'New Vendor')

      // Assert
      const snapshot = product.toSnapshot()
      expect(snapshot.productType).toBe('digital')
      expect(snapshot.vendor).toBe('New Vendor')
      expect(product.uncommittedEvents).toHaveLength(1)
      const event = product.uncommittedEvents[0]!
      expect(event.eventName).toBe('product.classification_updated')
      if (event.eventName === 'product.classification_updated') {
        const classificationUpdatedEvent = event as ProductClassificationUpdatedEvent
        expect(classificationUpdatedEvent.payload.priorState.productType).toBe(oldProductType)
        expect(classificationUpdatedEvent.payload.newState.productType).toBe('digital')
        expect(classificationUpdatedEvent.payload.newState.vendor).toBe('New Vendor')
      }
    })

    test('should update updatedAt when updating classification', async () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const originalUpdatedAt = product.toSnapshot().updatedAt
      
      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10))

      // Act
      product.updateClassification('digital', 'New Vendor')

      // Assert
      const newUpdatedAt = product.toSnapshot().updatedAt
      expect(newUpdatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should increment version when updating classification', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const originalVersion = product.version

      // Act
      product.updateClassification('digital', 'New Vendor')

      // Assert
      expect(product.version).toBe(originalVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      const result = product.updateClassification('digital', 'New Vendor')

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
      product.updateTags(['new-tag1', 'new-tag2', 'new-tag3'])

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
      product.updateTags([])

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
      product.updateTags(['new-tag'])

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
      product.updateTags(['new-tag'])

      // Assert
      expect(product.version).toBe(originalVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      const result = product.updateTags(['new-tag'])

      // Assert
      expect(result).toBe(product)
    })
  })

  describe('updateShippingSettings', () => {
    test('should update shipping settings', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const oldRequiresShipping = product.toSnapshot().requiresShipping
      const oldTaxable = product.toSnapshot().taxable

      // Act
      product.updateShippingSettings(false, false)

      // Assert
      const snapshot = product.toSnapshot()
      expect(snapshot.requiresShipping).toBe(false)
      expect(snapshot.taxable).toBe(false)
      expect(product.uncommittedEvents).toHaveLength(1)
      const event = product.uncommittedEvents[0]!
      expect(event.eventName).toBe('product.shipping_settings_updated')
      if (event.eventName === 'product.shipping_settings_updated') {
        const shippingSettingsUpdatedEvent = event as ProductShippingSettingsUpdatedEvent
        expect(shippingSettingsUpdatedEvent.payload.priorState.requiresShipping).toBe(oldRequiresShipping)
        expect(shippingSettingsUpdatedEvent.payload.newState.requiresShipping).toBe(false)
        expect(shippingSettingsUpdatedEvent.payload.newState.taxable).toBe(false)
      }
    })

    test('should update updatedAt when updating shipping settings', async () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const originalUpdatedAt = product.toSnapshot().updatedAt
      
      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10))

      // Act
      product.updateShippingSettings(false, false)

      // Assert
      const newUpdatedAt = product.toSnapshot().updatedAt
      expect(newUpdatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should increment version when updating shipping settings', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const originalVersion = product.version

      // Act
      product.updateShippingSettings(false, false)

      // Assert
      expect(product.version).toBe(originalVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      const result = product.updateShippingSettings(false, false)

      // Assert
      expect(result).toBe(product)
    })
  })

  describe('updatePageLayout', () => {
    test('should update page layout', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const oldPageLayoutId = product.toSnapshot().pageLayoutId

      // Act
      product.updatePageLayout('new-layout-123')

      // Assert
      const snapshot = product.toSnapshot()
      expect(snapshot.pageLayoutId).toBe('new-layout-123')
      expect(product.uncommittedEvents).toHaveLength(1)
      const event = product.uncommittedEvents[0]!
      expect(event.eventName).toBe('product.page_layout_updated')
      if (event.eventName === 'product.page_layout_updated') {
        const pageLayoutUpdatedEvent = event as ProductPageLayoutUpdatedEvent
        expect(pageLayoutUpdatedEvent.payload.priorState.pageLayoutId).toBe(oldPageLayoutId)
        expect(pageLayoutUpdatedEvent.payload.newState.pageLayoutId).toBe('new-layout-123')
      }
    })

    test('should allow null page layout', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      product.updatePageLayout(null)

      // Assert
      const snapshot = product.toSnapshot()
      expect(snapshot.pageLayoutId).toBeNull()
    })

    test('should update updatedAt when updating page layout', async () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const originalUpdatedAt = product.toSnapshot().updatedAt
      
      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10))

      // Act
      product.updatePageLayout('new-layout-123')

      // Assert
      const newUpdatedAt = product.toSnapshot().updatedAt
      expect(newUpdatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test('should increment version when updating page layout', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const originalVersion = product.version

      // Act
      product.updatePageLayout('new-layout-123')

      // Assert
      expect(product.version).toBe(originalVersion + 1)
    })

    test('should return self for method chaining', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      const result = product.updatePageLayout('new-layout-123')

      // Assert
      expect(result).toBe(product)
    })
  })

  describe('apply', () => {
    test('should apply ProductArchivedEvent and update state', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const initialVersion = product.version
      const occurredAt = new Date()
      const snapshot = product.toSnapshot()
      const { id, version, ...priorState } = snapshot
      
      const archivedEvent = new ProductArchivedEvent({
        occurredAt,
        correlationId: createValidProductParams().correlationId,
        aggregateId: product.id,
        version: initialVersion + 1,
        priorState: priorState as any,
        newState: {
          ...priorState,
          status: 'archived' as const,
          updatedAt: occurredAt,
        } as any,
      })

      // Act
      product.apply(archivedEvent)

      // Assert
      expect(product.toSnapshot().status).toBe('archived')
      expect(product.toSnapshot().updatedAt).toBe(occurredAt)
      expect(product.version).toBe(initialVersion + 1)
      expect(product.events).toHaveLength(1)
      expect(product.events[0]).toBe(archivedEvent)
    })

    test('should apply ProductPublishedEvent and update state', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const initialVersion = product.version
      const occurredAt = new Date()
      const snapshot = product.toSnapshot()
      const { id, version, ...priorState } = snapshot
      
      const publishedEvent = new ProductPublishedEvent({
        occurredAt,
        correlationId: createValidProductParams().correlationId,
        aggregateId: product.id,
        version: initialVersion + 1,
        priorState: priorState as any,
        newState: {
          ...priorState,
          status: 'active' as const,
          publishedAt: occurredAt,
          updatedAt: occurredAt,
        } as any,
      })

      // Act
      product.apply(publishedEvent)

      // Assert
      expect(product.toSnapshot().status).toBe('active')
      expect(product.toSnapshot().publishedAt).toBe(occurredAt)
      expect(product.toSnapshot().updatedAt).toBe(occurredAt)
      expect(product.version).toBe(initialVersion + 1)
      expect(product.events).toHaveLength(1)
      expect(product.events[0]).toBe(publishedEvent)
    })

    test('should apply ProductSlugChangedEvent and update slug', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const initialVersion = product.version
      const occurredAt = new Date()
      const snapshot = product.toSnapshot()
      // Remove id and version from snapshot as they're not part of ProductState
      const { id, version, ...priorState } = snapshot
      
      const slugChangedEvent = new ProductSlugChangedEvent({
        occurredAt,
        correlationId: createValidProductParams().correlationId,
        aggregateId: product.id,
        version: initialVersion + 1,
        priorState: priorState as any,
        newState: {
          ...priorState,
          slug: 'new-slug',
          updatedAt: occurredAt,
        } as any,
      })

      // Act
      product.apply(slugChangedEvent)

      // Assert
      expect(product.toSnapshot().slug).toBe('new-slug')
      expect(product.toSnapshot().updatedAt).toBe(occurredAt)
      expect(product.version).toBe(initialVersion + 1)
      expect(product.events).toHaveLength(1)
      expect(product.events[0]).toBe(slugChangedEvent)
    })

    test('should apply ProductDetailsUpdatedEvent and update details', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const initialVersion = product.version
      const occurredAt = new Date()
      const snapshot = product.toSnapshot()
      const { id, version, ...priorState } = snapshot
      
      const detailsUpdatedEvent = new ProductDetailsUpdatedEvent({
        occurredAt,
        correlationId: createValidProductParams().correlationId,
        aggregateId: product.id,
        version: initialVersion + 1,
        priorState: priorState as any,
        newState: {
          ...priorState,
          title: 'New Title',
          shortDescription: 'New Description',
          richDescriptionUrl: 'https://example.com/new-description',
          updatedAt: occurredAt,
        } as any,
      })

      // Act
      product.apply(detailsUpdatedEvent)

      // Assert
      expect(product.toSnapshot().title).toBe('New Title')
      expect(product.toSnapshot().shortDescription).toBe('New Description')
      expect(product.toSnapshot().richDescriptionUrl).toBe('https://example.com/new-description')
      expect(product.toSnapshot().updatedAt).toBe(occurredAt)
      expect(product.version).toBe(initialVersion + 1)
      expect(product.events).toHaveLength(1)
      expect(product.events[0]).toBe(detailsUpdatedEvent)
    })

    test('should apply ProductMetadataUpdatedEvent and update metadata', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const initialVersion = product.version
      const occurredAt = new Date()
      const snapshot = product.toSnapshot()
      const { id, version, ...priorState } = snapshot
      
      const metadataUpdatedEvent = new ProductMetadataUpdatedEvent({
        occurredAt,
        correlationId: createValidProductParams().correlationId,
        aggregateId: product.id,
        version: initialVersion + 1,
        priorState: priorState as any,
        newState: {
          ...priorState,
          metaTitle: 'New Meta Title',
          metaDescription: 'New Meta Description',
          updatedAt: occurredAt,
        } as any,
      })

      // Act
      product.apply(metadataUpdatedEvent)

      // Assert
      expect(product.toSnapshot().metaTitle).toBe('New Meta Title')
      expect(product.toSnapshot().metaDescription).toBe('New Meta Description')
      expect(product.toSnapshot().updatedAt).toBe(occurredAt)
      expect(product.version).toBe(initialVersion + 1)
      expect(product.events).toHaveLength(1)
      expect(product.events[0]).toBe(metadataUpdatedEvent)
    })

    test('should apply ProductClassificationUpdatedEvent and update classification', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const initialVersion = product.version
      const occurredAt = new Date()
      const snapshot = product.toSnapshot()
      const { id, version, ...priorState } = snapshot
      
      const classificationUpdatedEvent = new ProductClassificationUpdatedEvent({
        occurredAt,
        correlationId: createValidProductParams().correlationId,
        aggregateId: product.id,
        version: initialVersion + 1,
        priorState: priorState as any,
        newState: {
          ...priorState,
          productType: 'digital',
          vendor: 'New Vendor',
          updatedAt: occurredAt,
        } as any,
      })

      // Act
      product.apply(classificationUpdatedEvent)

      // Assert
      expect(product.toSnapshot().productType).toBe('digital')
      expect(product.toSnapshot().vendor).toBe('New Vendor')
      expect(product.toSnapshot().updatedAt).toBe(occurredAt)
      expect(product.version).toBe(initialVersion + 1)
      expect(product.events).toHaveLength(1)
      expect(product.events[0]).toBe(classificationUpdatedEvent)
    })

    test('should apply ProductTagsUpdatedEvent and update tags', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const initialVersion = product.version
      const occurredAt = new Date()
      const snapshot = product.toSnapshot()
      const { id, version, ...priorState } = snapshot
      
      const tagsUpdatedEvent = new ProductTagsUpdatedEvent({
        occurredAt,
        correlationId: createValidProductParams().correlationId,
        aggregateId: product.id,
        version: initialVersion + 1,
        priorState: priorState as any,
        newState: {
          ...priorState,
          tags: ['new-tag1', 'new-tag2'],
          updatedAt: occurredAt,
        } as any,
      })

      // Act
      product.apply(tagsUpdatedEvent)

      // Assert
      expect(product.toSnapshot().tags).toEqual(['new-tag1', 'new-tag2'])
      expect(product.toSnapshot().updatedAt).toBe(occurredAt)
      expect(product.version).toBe(initialVersion + 1)
      expect(product.events).toHaveLength(1)
      expect(product.events[0]).toBe(tagsUpdatedEvent)
    })

    test('should apply ProductShippingSettingsUpdatedEvent and update shipping settings', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const initialVersion = product.version
      const occurredAt = new Date()
      const snapshot = product.toSnapshot()
      const { id, version, ...priorState } = snapshot
      
      const shippingSettingsUpdatedEvent = new ProductShippingSettingsUpdatedEvent({
        occurredAt,
        correlationId: createValidProductParams().correlationId,
        aggregateId: product.id,
        version: initialVersion + 1,
        priorState: priorState as any,
        newState: {
          ...priorState,
          requiresShipping: false,
          taxable: false,
          updatedAt: occurredAt,
        } as any,
      })

      // Act
      product.apply(shippingSettingsUpdatedEvent)

      // Assert
      expect(product.toSnapshot().requiresShipping).toBe(false)
      expect(product.toSnapshot().taxable).toBe(false)
      expect(product.toSnapshot().updatedAt).toBe(occurredAt)
      expect(product.version).toBe(initialVersion + 1)
      expect(product.events).toHaveLength(1)
      expect(product.events[0]).toBe(shippingSettingsUpdatedEvent)
    })

    test('should apply ProductPageLayoutUpdatedEvent and update page layout', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const initialVersion = product.version
      const occurredAt = new Date()
      const snapshot = product.toSnapshot()
      const { id, version, ...priorState } = snapshot
      
      const pageLayoutUpdatedEvent = new ProductPageLayoutUpdatedEvent({
        occurredAt,
        correlationId: createValidProductParams().correlationId,
        aggregateId: product.id,
        version: initialVersion + 1,
        priorState: priorState as any,
        newState: {
          ...priorState,
          pageLayoutId: 'new-layout-123',
          updatedAt: occurredAt,
        } as any,
      })

      // Act
      product.apply(pageLayoutUpdatedEvent)

      // Assert
      expect(product.toSnapshot().pageLayoutId).toBe('new-layout-123')
      expect(product.toSnapshot().updatedAt).toBe(occurredAt)
      expect(product.version).toBe(initialVersion + 1)
      expect(product.events).toHaveLength(1)
      expect(product.events[0]).toBe(pageLayoutUpdatedEvent)
    })

    test('should apply ProductPageLayoutUpdatedEvent with null page layout', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const initialVersion = product.version
      const occurredAt = new Date()
      const snapshot = product.toSnapshot()
      const { id, version, ...priorState } = snapshot
      
      const pageLayoutUpdatedEvent = new ProductPageLayoutUpdatedEvent({
        occurredAt,
        correlationId: createValidProductParams().correlationId,
        aggregateId: product.id,
        version: initialVersion + 1,
        priorState: priorState as any,
        newState: {
          ...priorState,
          pageLayoutId: null,
          updatedAt: occurredAt,
        } as any,
      })

      // Act
      product.apply(pageLayoutUpdatedEvent)

      // Assert
      expect(product.toSnapshot().pageLayoutId).toBeNull()
      expect(product.toSnapshot().updatedAt).toBe(occurredAt)
      expect(product.version).toBe(initialVersion + 1)
      expect(product.events).toHaveLength(1)
      expect(product.events[0]).toBe(pageLayoutUpdatedEvent)
    })

    test('should throw error for unknown event type', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      const unknownEvent: DomainEvent<string, Record<string, unknown>> = {
        eventName: 'unknown.event',
        occurredAt: new Date(),
        correlationId: 'test',
        aggregateId: 'test',
        version: 1,
        payload: {},
      }

      // Act & Assert
      expect(() => product.apply(unknownEvent)).toThrow('Unknown event type: unknown.event')
    })

    test('should increment version when applying event', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const initialVersion = product.version
      const snapshot = product.toSnapshot()
      const { id, version, ...priorState } = snapshot
      
      const archivedEvent = new ProductArchivedEvent({
        occurredAt: new Date(),
        correlationId: createValidProductParams().correlationId,
        aggregateId: product.id,
        version: initialVersion + 1,
        priorState: priorState as any,
        newState: {
          ...priorState,
          status: 'archived' as const,
          updatedAt: new Date(),
        } as any,
      })

      // Act
      product.apply(archivedEvent)

      // Assert
      expect(product.version).toBe(initialVersion + 1)
    })

    test('should add event to events array when applying', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      expect(product.events).toHaveLength(0)
      const snapshot = product.toSnapshot()
      const { id, version, ...priorState } = snapshot
      
      const archivedEvent = new ProductArchivedEvent({
        occurredAt: new Date(),
        correlationId: createValidProductParams().correlationId,
        aggregateId: product.id,
        version: 1,
        priorState: priorState as any,
        newState: {
          ...priorState,
          status: 'archived' as const,
          updatedAt: new Date(),
        } as any,
      })

      // Act
      product.apply(archivedEvent)

      // Assert
      expect(product.events).toHaveLength(1)
      expect(product.events[0]).toBe(archivedEvent)
    })

    test('should apply multiple events in sequence', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const snapshot1 = product.toSnapshot()
      const { id, version, ...priorState1 } = snapshot1
      
      const publishedEvent = new ProductPublishedEvent({
        occurredAt: new Date(),
        correlationId: createValidProductParams().correlationId,
        aggregateId: product.id,
        version: 1,
        priorState: priorState1 as any,
        newState: {
          ...priorState1,
          status: 'active' as const,
          publishedAt: new Date(),
          updatedAt: new Date(),
        } as any,
      })

      // Apply first event to get updated state
      product.apply(publishedEvent)
      const snapshot2 = product.toSnapshot()
      const { id: id2, version: version2, ...priorState2 } = snapshot2

      const archivedEvent = new ProductArchivedEvent({
        occurredAt: new Date(),
        correlationId: createValidProductParams().correlationId,
        aggregateId: product.id,
        version: 2,
        priorState: priorState2 as any,
        newState: {
          ...priorState2,
          status: 'archived' as const,
          updatedAt: new Date(),
        } as any,
      })

      // Act
      product.apply(archivedEvent)

      // Assert
      expect(product.toSnapshot().status).toBe('archived')
      expect(product.version).toBe(2)
      expect(product.events).toHaveLength(2)
      expect(product.events[0]).toBe(publishedEvent)
      expect(product.events[1]).toBe(archivedEvent)
    })
  })

  describe('loadFromSnapshot', () => {
    test('should load product from snapshot', () => {
      // Arrange
      const snapshot = {
        aggregate_id: 'product-123',
        correlation_id: 'correlation-123',
        version: 5,
        payload: JSON.stringify({
          title: 'Snapshot Product',
          shortDescription: 'A product from snapshot',
          slug: 'snapshot-product',
          collectionIds: ['collection-1'],
          variantIds: ['variant-1'],
          richDescriptionUrl: 'https://example.com/description',
          productType: 'physical',
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
      expect(productSnapshot.title).toBe('Snapshot Product')
      expect(productSnapshot.shortDescription).toBe('A product from snapshot')
      expect(productSnapshot.slug).toBe('snapshot-product')
      expect(productSnapshot.collectionIds).toEqual(['collection-1'])
      expect(productSnapshot.variantIds).toEqual(['variant-1'])
      expect(productSnapshot.richDescriptionUrl).toBe('https://example.com/description')
      expect(productSnapshot.productType).toBe('physical')
      expect(productSnapshot.vendor).toBe('Test Vendor')
      expect(productSnapshot.variantOptions).toEqual([{ name: 'Size', values: ['S', 'M'] }])
      expect(productSnapshot.metaTitle).toBe('Meta Title')
      expect(productSnapshot.metaDescription).toBe('Meta Description')
      expect(productSnapshot.tags).toEqual(['tag1'])
      expect(productSnapshot.requiresShipping).toBe(true)
      expect(productSnapshot.taxable).toBe(false)
      expect(productSnapshot.pageLayoutId).toBe('layout-123')
      expect(productSnapshot.status).toBe('active')
      expect(product.version).toBe(5)
      expect(productSnapshot.publishedAt).not.toBeNull()
      expect(product.events).toEqual([])
    })

    test('should handle null publishedAt in snapshot', () => {
      // Arrange
      const snapshot = {
        aggregate_id: 'product-123',
        correlation_id: 'correlation-123',
        version: 0,
        payload: JSON.stringify({
          title: 'Draft Product',
          shortDescription: 'A draft product',
          slug: 'draft-product',
          collectionIds: ['collection-1'],
          variantIds: ['variant-1'],
          richDescriptionUrl: 'https://example.com/description',
          productType: 'physical',
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
        aggregate_id: 'product-123',
        correlation_id: 'correlation-123',
        version: 10,
        payload: JSON.stringify({
          title: 'Test',
          shortDescription: 'Test',
          slug: 'test',
          collectionIds: ['collection-1'],
          variantIds: ['variant-1'],
          richDescriptionUrl: 'https://example.com',
          productType: 'physical',
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
        aggregate_id: 'product-123',
        correlation_id: 'correlation-123',
        version: 1,
        payload: JSON.stringify({
          title: 'Test',
          shortDescription: 'Test',
          slug: 'test',
          collectionIds: ['collection-1'],
          variantIds: ['variant-1'],
          richDescriptionUrl: 'https://example.com',
          productType: 'physical',
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
      expect(snapshot.title).toBe(params.title)
      expect(snapshot.shortDescription).toBe(params.shortDescription)
      expect(snapshot.slug).toBe(params.slug)
      expect(snapshot.collectionIds).toEqual(params.collectionIds)
      expect(snapshot.variantIds).toEqual(params.variantIds)
      expect(snapshot.richDescriptionUrl).toBe(params.richDescriptionUrl)
      expect(snapshot.productType).toBe(params.productType)
      expect(snapshot.vendor).toBe(params.vendor)
      expect(snapshot.variantOptions).toEqual(params.variantOptions)
      expect(snapshot.metaTitle).toBe(params.metaTitle)
      expect(snapshot.metaDescription).toBe(params.metaDescription)
      expect(snapshot.tags).toEqual(params.tags)
      expect(snapshot.requiresShipping).toBe(params.requiresShipping)
      expect(snapshot.taxable).toBe(params.taxable)
      expect(snapshot.pageLayoutId).toBe(params.pageLayoutId)
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
      product.publish()

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
      product.publish()
      product.uncommittedEvents = []
      product.archive()

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
      product.publish()

      // Assert
      expect(product.toSnapshot().status).toBe('active')
    })

    test('should transition from draft to archived via archive', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      product.archive()

      // Assert
      expect(product.toSnapshot().status).toBe('archived')
    })

    test('should transition from active to archived via archive', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      product.publish()
      product.uncommittedEvents = []

      // Act
      product.archive()

      // Assert
      expect(product.toSnapshot().status).toBe('archived')
    })

    test('should not allow transition from archived to active', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      product.archive()
      product.uncommittedEvents = []

      // Act & Assert
      expect(() => product.publish()).toThrow('Cannot publish an archived product')
    })

    test('should not allow transition from active to active', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      product.publish()
      product.uncommittedEvents = []

      // Act & Assert
      expect(() => product.publish()).toThrow('Product is already published')
    })

    test('should not allow transition from archived to archived', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      product.archive()
      product.uncommittedEvents = []

      // Act & Assert
      expect(() => product.archive()).toThrow('Product is already archived')
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
      product.publish()

      // Assert
      expect(product.version).toBe(1)
    })

    test('should increment version on archive', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      product.archive()

      // Assert
      expect(product.version).toBe(1)
    })

    test('should increment version on apply', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const snapshot = product.toSnapshot()
      const { id, version, ...priorState } = snapshot
      
      const archivedEvent = new ProductArchivedEvent({
        occurredAt: new Date(),
        correlationId: createValidProductParams().correlationId,
        aggregateId: product.id,
        version: 1,
        priorState: priorState as any,
        newState: {
          ...priorState,
          status: 'archived' as const,
          updatedAt: new Date(),
        } as any,
      })

      // Act
      product.apply(archivedEvent)

      // Assert
      expect(product.version).toBe(1)
    })

    test('should track version correctly through multiple operations', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      product.publish()
      product.uncommittedEvents = []
      product.archive()

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
      product.publish()
      product.archive()

      // Assert
      expect(product.uncommittedEvents).toHaveLength(2)
      expect(product.uncommittedEvents[0]).toBeInstanceOf(ProductPublishedEvent)
      expect(product.uncommittedEvents[1]).toBeInstanceOf(ProductArchivedEvent)
    })

    test('should not add events to uncommittedEvents when applying', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []
      const snapshot = product.toSnapshot()
      const { id, version, ...priorState } = snapshot
      
      const archivedEvent = new ProductArchivedEvent({
        occurredAt: new Date(),
        correlationId: createValidProductParams().correlationId,
        aggregateId: product.id,
        version: 1,
        priorState: priorState as any,
        newState: {
          ...priorState,
          status: 'archived' as const,
          updatedAt: new Date(),
        } as any,
      })

      // Act
      product.apply(archivedEvent)

      // Assert
      expect(product.uncommittedEvents).toHaveLength(0)
      expect(product.events).toHaveLength(1)
    })
  })

  describe('edge cases', () => {
    test('should handle product with all optional fields', () => {
      // Arrange
      const params = createValidProductParams()
      params.pageLayoutId = null as any
      params.tags = []
      params.variantOptions = []

      // Act
      const product = ProductAggregate.create(params)

      // Assert
      const snapshot = product.toSnapshot()
      expect(snapshot.pageLayoutId).toBeNull()
      expect(snapshot.tags).toEqual([])
      expect(snapshot.variantOptions).toEqual([])
    })

    test('should handle product with many variants and collections', () => {
      // Arrange
      const params = createValidProductParams()
      params.variantIds = Array.from({ length: 100 }, (_, i) => `variant-${i}`)
      params.collectionIds = Array.from({ length: 50 }, (_, i) => `collection-${i}`)

      // Act
      const product = ProductAggregate.create(params)

      // Assert
      const snapshot = product.toSnapshot()
      expect(snapshot.variantIds).toHaveLength(100)
      expect(snapshot.collectionIds).toHaveLength(50)
    })

    test('should handle very long strings', () => {
      // Arrange
      const params = createValidProductParams()
      params.title = 'A'.repeat(10000)
      params.shortDescription = 'B'.repeat(10000)
      params.slug = 'C'.repeat(1000)

      // Act
      const product = ProductAggregate.create(params)

      // Assert
      const snapshot = product.toSnapshot()
      expect(snapshot.title).toBe('A'.repeat(10000))
      expect(snapshot.shortDescription).toBe('B'.repeat(10000))
      expect(snapshot.slug).toBe('C'.repeat(1000))
    })

    test('should preserve event order in uncommittedEvents', () => {
      // Arrange
      const product = ProductAggregate.create(createValidProductParams())
      product.uncommittedEvents = []

      // Act
      product.publish()
      product.archive()

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
})

