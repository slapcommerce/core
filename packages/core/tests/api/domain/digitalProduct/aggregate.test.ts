import { describe, test, expect } from 'bun:test'
import { DigitalProductAggregate } from '../../../../src/api/domain/digitalProduct/aggregate'
import { DigitalProductCreatedEvent, DigitalProductArchivedEvent, DigitalProductPublishedEvent, DigitalProductSlugChangedEvent, DigitalProductDetailsUpdatedEvent, DigitalProductMetadataUpdatedEvent, DigitalProductClassificationUpdatedEvent, DigitalProductTagsUpdatedEvent, DigitalProductCollectionsUpdatedEvent, DigitalProductTaxDetailsUpdatedEvent, DigitalProductDefaultVariantSetEvent } from '../../../../src/api/domain/digitalProduct/events'

function createValidDigitalProductParams() {
  return {
    id: 'digital-product-123',
    correlationId: 'correlation-123',
    userId: 'user-123',
    name: 'Test Digital Product',
    description: 'A test digital product',
    slug: 'test-digital-product',
    collections: ['collection-1'],
    variantPositionsAggregateId: 'variant-positions-123',
    richDescriptionUrl: 'https://example.com/description',
    vendor: 'Test Vendor',
    variantOptions: [{ name: 'Format', values: ['PDF', 'EPUB'] }],
    metaTitle: 'Test Digital Product Meta',
    metaDescription: 'Test digital product description',
    tags: ['digital', 'ebook'],
    taxable: true,
    taxId: 'TAX123',
  }
}

describe('DigitalProductAggregate', () => {
  describe('create', () => {
    test('should create a new digital product aggregate with draft status', () => {
      const params = createValidDigitalProductParams()
      const product = DigitalProductAggregate.create(params)

      const snapshot = product.toSnapshot()
      expect(product.id).toBe(params.id)
      expect(snapshot.name).toBe(params.name)
      expect(snapshot.description).toBe(params.description)
      expect(snapshot.slug).toBe(params.slug)
      expect(snapshot.collections).toEqual(params.collections)
      expect(snapshot.productType).toBe('digital')
      expect(snapshot.status).toBe('draft')
      expect(product.version).toBe(0)
      expect(snapshot.publishedAt).toBeNull()
      expect(product.uncommittedEvents).toHaveLength(1)
      const event = product.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(DigitalProductCreatedEvent)
      expect(event.eventName).toBe('digital_product.created')
    })

    test('should throw error if no collections provided', () => {
      const params = createValidDigitalProductParams()
      params.collections = []

      expect(() => DigitalProductAggregate.create(params)).toThrow('Product must belong to at least one collection')
    })
  })

  describe('archive', () => {
    test('should archive a draft product', () => {
      const product = DigitalProductAggregate.create(createValidDigitalProductParams())
      product.uncommittedEvents = []

      product.archive('user-123')

      expect(product.toSnapshot().status).toBe('archived')
      expect(product.version).toBe(1)
      expect(product.uncommittedEvents).toHaveLength(1)
      expect(product.uncommittedEvents[0]).toBeInstanceOf(DigitalProductArchivedEvent)
      expect(product.uncommittedEvents[0]!.eventName).toBe('digital_product.archived')
    })

    test('should throw error when product is already archived', () => {
      const product = DigitalProductAggregate.create(createValidDigitalProductParams())
      product.uncommittedEvents = []
      product.archive('user-123')

      expect(() => product.archive('user-123')).toThrow('Product is already archived')
    })
  })

  describe('publish', () => {
    test('should publish a draft product', () => {
      const product = DigitalProductAggregate.create(createValidDigitalProductParams())
      product.uncommittedEvents = []

      product.publish('user-123')

      expect(product.toSnapshot().status).toBe('active')
      expect(product.toSnapshot().publishedAt).not.toBeNull()
      expect(product.version).toBe(1)
      expect(product.uncommittedEvents).toHaveLength(1)
      expect(product.uncommittedEvents[0]).toBeInstanceOf(DigitalProductPublishedEvent)
      expect(product.uncommittedEvents[0]!.eventName).toBe('digital_product.published')
    })

    test('should throw error when product is already published', () => {
      const product = DigitalProductAggregate.create(createValidDigitalProductParams())
      product.uncommittedEvents = []
      product.publish('user-123')

      expect(() => product.publish('user-123')).toThrow('Product is already published')
    })

    test('should throw error when trying to publish archived product', () => {
      const product = DigitalProductAggregate.create(createValidDigitalProductParams())
      product.uncommittedEvents = []
      product.archive('user-123')

      expect(() => product.publish('user-123')).toThrow('Cannot publish an archived product')
    })

    test('should throw error when trying to publish without variants', () => {
      const product = DigitalProductAggregate.create(createValidDigitalProductParams())
      product.uncommittedEvents = []

      expect(() => product.publish('user-123', false)).toThrow('Cannot publish product without at least one variant')
    })
  })

  describe('unpublish', () => {
    test('should unpublish an active product', () => {
      const product = DigitalProductAggregate.create(createValidDigitalProductParams())
      product.uncommittedEvents = []
      product.publish('user-123')
      product.uncommittedEvents = []

      product.unpublish('user-123')

      expect(product.toSnapshot().status).toBe('draft')
      expect(product.toSnapshot().publishedAt).toBeNull()
      expect(product.version).toBe(2)
    })

    test('should throw error when product is already unpublished', () => {
      const product = DigitalProductAggregate.create(createValidDigitalProductParams())
      product.uncommittedEvents = []

      expect(() => product.unpublish('user-123')).toThrow('Product is already unpublished')
    })

    test('should throw error when trying to unpublish archived product', () => {
      const product = DigitalProductAggregate.create(createValidDigitalProductParams())
      product.uncommittedEvents = []
      product.archive('user-123')

      expect(() => product.unpublish('user-123')).toThrow('Cannot unpublish an archived product')
    })
  })

  describe('changeSlug', () => {
    test('should change slug of a product', () => {
      const product = DigitalProductAggregate.create(createValidDigitalProductParams())
      product.uncommittedEvents = []

      product.changeSlug('new-slug', 'user-123')

      expect(product.toSnapshot().slug).toBe('new-slug')
      expect(product.uncommittedEvents).toHaveLength(1)
      expect(product.uncommittedEvents[0]!.eventName).toBe('digital_product.slug_changed')
    })

    test('should throw error when new slug is same as current slug', () => {
      const product = DigitalProductAggregate.create(createValidDigitalProductParams())
      const currentSlug = product.toSnapshot().slug

      expect(() => product.changeSlug(currentSlug, 'user-123')).toThrow('New slug must be different from current slug')
    })
  })

  describe('updateDetails', () => {
    test('should update product details', () => {
      const product = DigitalProductAggregate.create(createValidDigitalProductParams())
      product.uncommittedEvents = []

      product.updateDetails('New Title', 'New Description', 'https://example.com/new', 'user-123')

      const snapshot = product.toSnapshot()
      expect(snapshot.name).toBe('New Title')
      expect(snapshot.description).toBe('New Description')
      expect(snapshot.richDescriptionUrl).toBe('https://example.com/new')
      expect(product.uncommittedEvents[0]!.eventName).toBe('digital_product.details_updated')
    })
  })

  describe('updateMetadata', () => {
    test('should update product metadata', () => {
      const product = DigitalProductAggregate.create(createValidDigitalProductParams())
      product.uncommittedEvents = []

      product.updateMetadata('New Meta Title', 'New Meta Description', 'user-123')

      const snapshot = product.toSnapshot()
      expect(snapshot.metaTitle).toBe('New Meta Title')
      expect(snapshot.metaDescription).toBe('New Meta Description')
      expect(product.uncommittedEvents[0]!.eventName).toBe('digital_product.metadata_updated')
    })
  })

  describe('updateVendor', () => {
    test('should update product vendor', () => {
      const product = DigitalProductAggregate.create(createValidDigitalProductParams())
      product.uncommittedEvents = []

      product.updateVendor('New Vendor', 'user-123')

      expect(product.toSnapshot().vendor).toBe('New Vendor')
      expect(product.uncommittedEvents[0]!.eventName).toBe('digital_product.classification_updated')
    })
  })

  describe('updateTags', () => {
    test('should update product tags', () => {
      const product = DigitalProductAggregate.create(createValidDigitalProductParams())
      product.uncommittedEvents = []

      product.updateTags(['new-tag1', 'new-tag2'], 'user-123')

      expect(product.toSnapshot().tags).toEqual(['new-tag1', 'new-tag2'])
      expect(product.uncommittedEvents[0]!.eventName).toBe('digital_product.tags_updated')
    })
  })

  describe('updateCollections', () => {
    test('should update product collections', () => {
      const product = DigitalProductAggregate.create(createValidDigitalProductParams())
      product.uncommittedEvents = []

      product.updateCollections(['collection-2', 'collection-3'], 'user-123')

      expect(product.toSnapshot().collections).toEqual(['collection-2', 'collection-3'])
      expect(product.uncommittedEvents[0]!.eventName).toBe('digital_product.collections_updated')
    })
  })

  describe('updateOptions', () => {
    test('should update variant options', () => {
      const product = DigitalProductAggregate.create(createValidDigitalProductParams())
      product.uncommittedEvents = []

      product.updateOptions([{ name: 'License', values: ['Personal', 'Commercial'] }], 'user-123')

      expect(product.toSnapshot().variantOptions).toEqual([{ name: 'License', values: ['Personal', 'Commercial'] }])
      expect(product.uncommittedEvents[0]!.eventName).toBe('digital_product.variant_options_updated')
    })
  })

  describe('updateTaxDetails', () => {
    test('should update tax details', () => {
      const product = DigitalProductAggregate.create(createValidDigitalProductParams())
      product.uncommittedEvents = []

      product.updateTaxDetails(false, 'NEW-TAX-ID', 'user-123')

      const snapshot = product.toSnapshot()
      expect(snapshot.taxable).toBe(false)
      expect(snapshot.taxId).toBe('NEW-TAX-ID')
      expect(product.uncommittedEvents[0]!.eventName).toBe('digital_product.tax_details_updated')
    })
  })

  describe('setDefaultVariant', () => {
    test('should set default variant', () => {
      const product = DigitalProductAggregate.create(createValidDigitalProductParams())
      product.uncommittedEvents = []

      product.setDefaultVariant('variant-123', 'user-123')

      expect(product.defaultVariantId).toBe('variant-123')
      expect(product.uncommittedEvents[0]!.eventName).toBe('digital_product.default_variant_set')
    })
  })

  describe('clearDefaultVariant', () => {
    test('should clear default variant', () => {
      const product = DigitalProductAggregate.create(createValidDigitalProductParams())
      product.setDefaultVariant('variant-123', 'user-123')
      product.uncommittedEvents = []

      product.clearDefaultVariant('user-123')

      expect(product.defaultVariantId).toBeNull()
      expect(product.uncommittedEvents[0]!.eventName).toBe('digital_product.default_variant_set')
    })
  })

  describe('loadFromSnapshot', () => {
    test('should load product from snapshot', () => {
      const snapshot = {
        aggregateId: 'digital-product-123',
        correlationId: 'correlation-123',
        version: 5,
        payload: JSON.stringify({
          name: 'Snapshot Product',
          description: 'A product from snapshot',
          slug: 'snapshot-product',
          collections: ['collection-1'],
          variantPositionsAggregateId: 'variant-positions-123',
          defaultVariantId: null,
          richDescriptionUrl: 'https://example.com/description',
          productType: 'digital',
          vendor: 'Test Vendor',
          variantOptions: [{ name: 'Format', values: ['PDF'] }],
          metaTitle: 'Meta Title',
          metaDescription: 'Meta Description',
          tags: ['tag1'],
          taxable: true,
          taxId: 'TAX123',
          status: 'active',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
          publishedAt: '2024-01-02T00:00:00.000Z',
        }),
      }

      const product = DigitalProductAggregate.loadFromSnapshot(snapshot)

      expect(product.id).toBe('digital-product-123')
      expect(product.toSnapshot().name).toBe('Snapshot Product')
      expect(product.toSnapshot().productType).toBe('digital')
      expect(product.version).toBe(5)
    })
  })

  describe('toSnapshot', () => {
    test('should return complete snapshot of product state', () => {
      const product = DigitalProductAggregate.create(createValidDigitalProductParams())
      const snapshot = product.toSnapshot()

      expect(snapshot.id).toBe(product.id)
      expect(snapshot.productType).toBe('digital')
      expect(snapshot.status).toBe('draft')
      expect(snapshot.version).toBe(product.version)
    })
  })
})
