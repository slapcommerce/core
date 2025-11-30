import { describe, test, expect } from 'bun:test'
import { DropshipProductAggregate } from '../../../../src/api/domain/dropshipProduct/aggregate'
import { DropshipProductCreatedEvent, DropshipProductArchivedEvent, DropshipProductPublishedEvent, DropshipProductSafetyBufferUpdatedEvent } from '../../../../src/api/domain/dropshipProduct/events'

function createValidDropshipProductParams() {
  return {
    id: 'dropship-product-123',
    correlationId: 'correlation-123',
    userId: 'user-123',
    name: 'Test Dropship Product',
    description: 'A test dropship product',
    slug: 'test-dropship-product',
    collections: ['collection-1'],
    variantPositionsAggregateId: 'variant-positions-123',
    richDescriptionUrl: 'https://example.com/description',
    vendor: 'Test Vendor',
    variantOptions: [{ name: 'Size', values: ['S', 'M', 'L'] }],
    metaTitle: 'Test Dropship Product Meta',
    metaDescription: 'Test dropship product description',
    tags: ['dropship', 'apparel'],
    taxable: true,
    taxId: 'TAX123',
    dropshipSafetyBuffer: 5,
  }
}

describe('DropshipProductAggregate', () => {
  describe('create', () => {
    test('should create a new dropship product aggregate with draft status', () => {
      const params = createValidDropshipProductParams()
      const product = DropshipProductAggregate.create(params)

      const snapshot = product.toSnapshot()
      expect(product.id).toBe(params.id)
      expect(snapshot.name).toBe(params.name)
      expect(snapshot.productType).toBe('dropship')
      expect(snapshot.dropshipSafetyBuffer).toBe(params.dropshipSafetyBuffer)
      expect(snapshot.status).toBe('draft')
      expect(product.version).toBe(0)
      expect(product.uncommittedEvents).toHaveLength(1)
      expect(product.uncommittedEvents[0]).toBeInstanceOf(DropshipProductCreatedEvent)
      expect(product.uncommittedEvents[0]!.eventName).toBe('dropship_product.created')
    })

    test('should throw error if no collections provided', () => {
      const params = createValidDropshipProductParams()
      params.collections = []

      expect(() => DropshipProductAggregate.create(params)).toThrow('Product must belong to at least one collection')
    })
  })

  describe('archive', () => {
    test('should archive a draft product', () => {
      const product = DropshipProductAggregate.create(createValidDropshipProductParams())
      product.uncommittedEvents = []

      product.archive('user-123')

      expect(product.toSnapshot().status).toBe('archived')
      expect(product.uncommittedEvents[0]).toBeInstanceOf(DropshipProductArchivedEvent)
      expect(product.uncommittedEvents[0]!.eventName).toBe('dropship_product.archived')
    })

    test('should throw error when product is already archived', () => {
      const product = DropshipProductAggregate.create(createValidDropshipProductParams())
      product.uncommittedEvents = []
      product.archive('user-123')

      expect(() => product.archive('user-123')).toThrow('Product is already archived')
    })
  })

  describe('publish', () => {
    test('should publish a draft product', () => {
      const product = DropshipProductAggregate.create(createValidDropshipProductParams())
      product.uncommittedEvents = []

      product.publish('user-123')

      expect(product.toSnapshot().status).toBe('active')
      expect(product.uncommittedEvents[0]).toBeInstanceOf(DropshipProductPublishedEvent)
      expect(product.uncommittedEvents[0]!.eventName).toBe('dropship_product.published')
    })

    test('should throw error when product is already published', () => {
      const product = DropshipProductAggregate.create(createValidDropshipProductParams())
      product.uncommittedEvents = []
      product.publish('user-123')

      expect(() => product.publish('user-123')).toThrow('Product is already published')
    })

    test('should throw error when trying to publish archived product', () => {
      const product = DropshipProductAggregate.create(createValidDropshipProductParams())
      product.uncommittedEvents = []
      product.archive('user-123')

      expect(() => product.publish('user-123')).toThrow('Cannot publish an archived product')
    })

    test('should throw error when trying to publish without variants', () => {
      const product = DropshipProductAggregate.create(createValidDropshipProductParams())
      product.uncommittedEvents = []

      expect(() => product.publish('user-123', false)).toThrow('Cannot publish product without at least one variant')
    })
  })

  describe('unpublish', () => {
    test('should unpublish an active product', () => {
      const product = DropshipProductAggregate.create(createValidDropshipProductParams())
      product.uncommittedEvents = []
      product.publish('user-123')
      product.uncommittedEvents = []

      product.unpublish('user-123')

      expect(product.toSnapshot().status).toBe('draft')
      expect(product.toSnapshot().publishedAt).toBeNull()
    })
  })

  describe('updateSafetyBuffer', () => {
    test('should update safety buffer', () => {
      const product = DropshipProductAggregate.create(createValidDropshipProductParams())
      product.uncommittedEvents = []

      product.updateSafetyBuffer(10, 'user-123')

      expect(product.toSnapshot().dropshipSafetyBuffer).toBe(10)
      expect(product.uncommittedEvents[0]).toBeInstanceOf(DropshipProductSafetyBufferUpdatedEvent)
      expect(product.uncommittedEvents[0]!.eventName).toBe('dropship_product.safety_buffer_updated')
    })
  })

  describe('changeSlug', () => {
    test('should change slug of a product', () => {
      const product = DropshipProductAggregate.create(createValidDropshipProductParams())
      product.uncommittedEvents = []

      product.changeSlug('new-slug', 'user-123')

      expect(product.toSnapshot().slug).toBe('new-slug')
      expect(product.uncommittedEvents[0]!.eventName).toBe('dropship_product.slug_changed')
    })
  })

  describe('updateDetails', () => {
    test('should update product details', () => {
      const product = DropshipProductAggregate.create(createValidDropshipProductParams())
      product.uncommittedEvents = []

      product.updateDetails('New Title', 'New Description', 'https://example.com/new', 'user-123')

      const snapshot = product.toSnapshot()
      expect(snapshot.name).toBe('New Title')
      expect(snapshot.description).toBe('New Description')
      expect(product.uncommittedEvents[0]!.eventName).toBe('dropship_product.details_updated')
    })
  })

  describe('updateMetadata', () => {
    test('should update product metadata', () => {
      const product = DropshipProductAggregate.create(createValidDropshipProductParams())
      product.uncommittedEvents = []

      product.updateMetadata('New Meta Title', 'New Meta Description', 'user-123')

      const snapshot = product.toSnapshot()
      expect(snapshot.metaTitle).toBe('New Meta Title')
      expect(product.uncommittedEvents[0]!.eventName).toBe('dropship_product.metadata_updated')
    })
  })

  describe('updateVendor', () => {
    test('should update product vendor', () => {
      const product = DropshipProductAggregate.create(createValidDropshipProductParams())
      product.uncommittedEvents = []

      product.updateVendor('New Vendor', 'user-123')

      expect(product.toSnapshot().vendor).toBe('New Vendor')
      expect(product.uncommittedEvents[0]!.eventName).toBe('dropship_product.classification_updated')
    })
  })

  describe('updateTags', () => {
    test('should update product tags', () => {
      const product = DropshipProductAggregate.create(createValidDropshipProductParams())
      product.uncommittedEvents = []

      product.updateTags(['new-tag'], 'user-123')

      expect(product.toSnapshot().tags).toEqual(['new-tag'])
      expect(product.uncommittedEvents[0]!.eventName).toBe('dropship_product.tags_updated')
    })
  })

  describe('updateCollections', () => {
    test('should update product collections', () => {
      const product = DropshipProductAggregate.create(createValidDropshipProductParams())
      product.uncommittedEvents = []

      product.updateCollections(['collection-2'], 'user-123')

      expect(product.toSnapshot().collections).toEqual(['collection-2'])
      expect(product.uncommittedEvents[0]!.eventName).toBe('dropship_product.collections_updated')
    })
  })

  describe('updateOptions', () => {
    test('should update variant options', () => {
      const product = DropshipProductAggregate.create(createValidDropshipProductParams())
      product.uncommittedEvents = []

      product.updateOptions([{ name: 'Color', values: ['Red', 'Blue'] }], 'user-123')

      expect(product.toSnapshot().variantOptions).toEqual([{ name: 'Color', values: ['Red', 'Blue'] }])
      expect(product.uncommittedEvents[0]!.eventName).toBe('dropship_product.variant_options_updated')
    })
  })

  describe('updateTaxDetails', () => {
    test('should update tax details', () => {
      const product = DropshipProductAggregate.create(createValidDropshipProductParams())
      product.uncommittedEvents = []

      product.updateTaxDetails(false, 'NEW-TAX', 'user-123')

      expect(product.toSnapshot().taxable).toBe(false)
      expect(product.toSnapshot().taxId).toBe('NEW-TAX')
      expect(product.uncommittedEvents[0]!.eventName).toBe('dropship_product.tax_details_updated')
    })
  })

  describe('setDefaultVariant', () => {
    test('should set default variant', () => {
      const product = DropshipProductAggregate.create(createValidDropshipProductParams())
      product.uncommittedEvents = []

      product.setDefaultVariant('variant-123', 'user-123')

      expect(product.defaultVariantId).toBe('variant-123')
      expect(product.uncommittedEvents[0]!.eventName).toBe('dropship_product.default_variant_set')
    })
  })

  describe('clearDefaultVariant', () => {
    test('should clear default variant', () => {
      const product = DropshipProductAggregate.create(createValidDropshipProductParams())
      product.setDefaultVariant('variant-123', 'user-123')
      product.uncommittedEvents = []

      product.clearDefaultVariant('user-123')

      expect(product.defaultVariantId).toBeNull()
    })
  })

  describe('loadFromSnapshot', () => {
    test('should load product from snapshot', () => {
      const snapshot = {
        aggregateId: 'dropship-product-123',
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
          productType: 'dropship',
          dropshipSafetyBuffer: 10,
          vendor: 'Test Vendor',
          variantOptions: [],
          metaTitle: 'Meta Title',
          metaDescription: 'Meta Description',
          tags: [],
          taxable: true,
          taxId: 'TAX123',
          status: 'active',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
          publishedAt: '2024-01-02T00:00:00.000Z',
        }),
      }

      const product = DropshipProductAggregate.loadFromSnapshot(snapshot)

      expect(product.id).toBe('dropship-product-123')
      expect(product.toSnapshot().productType).toBe('dropship')
      expect(product.toSnapshot().dropshipSafetyBuffer).toBe(10)
      expect(product.version).toBe(5)
    })
  })

  describe('toSnapshot', () => {
    test('should return complete snapshot of product state', () => {
      const product = DropshipProductAggregate.create(createValidDropshipProductParams())
      const snapshot = product.toSnapshot()

      expect(snapshot.id).toBe(product.id)
      expect(snapshot.productType).toBe('dropship')
      expect(snapshot.dropshipSafetyBuffer).toBe(5)
      expect(snapshot.status).toBe('draft')
    })
  })
})
