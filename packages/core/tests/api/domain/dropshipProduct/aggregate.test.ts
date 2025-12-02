import { describe, test, expect } from 'bun:test'
import { DropshipProductAggregate } from '../../../../src/api/domain/dropshipProduct/aggregate'
import { DropshipProductCreatedEvent, DropshipProductArchivedEvent, DropshipProductPublishedEvent, DropshipProductSafetyBufferUpdatedEvent, DropshipProductFulfillmentSettingsUpdatedEvent, DropshipProductHiddenDropScheduledEvent, DropshipProductVisibleDropScheduledEvent } from '../../../../src/api/domain/dropshipProduct/events'

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
    fulfillmentProviderId: 'printful',
    supplierCost: 15.99,
    supplierSku: 'SUPPLIER-SKU-123',
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
      expect(snapshot.fulfillmentProviderId).toBe(params.fulfillmentProviderId)
      expect(snapshot.supplierCost).toBe(params.supplierCost)
      expect(snapshot.supplierSku).toBe(params.supplierSku)
      expect(snapshot.status).toBe('draft')
      expect(product.version).toBe(0)
      expect(product.uncommittedEvents).toHaveLength(1)
      expect(product.uncommittedEvents[0]).toBeInstanceOf(DropshipProductCreatedEvent)
      expect(product.uncommittedEvents[0]!.eventName).toBe('dropship_product.created')
    })

    test('should create product with default null fulfillment settings', () => {
      const params = createValidDropshipProductParams()
      // Remove fulfillment settings to test defaults
      const { fulfillmentProviderId, supplierCost, supplierSku, ...paramsWithoutFulfillment } = params
      const product = DropshipProductAggregate.create(paramsWithoutFulfillment)

      const snapshot = product.toSnapshot()
      expect(snapshot.fulfillmentProviderId).toBeNull()
      expect(snapshot.supplierCost).toBeNull()
      expect(snapshot.supplierSku).toBeNull()
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

    test('should throw error when safety buffer is negative', () => {
      const product = DropshipProductAggregate.create(createValidDropshipProductParams())
      product.uncommittedEvents = []

      expect(() => product.updateSafetyBuffer(-1, 'user-123')).toThrow('Safety buffer must be non-negative')
    })
  })

  describe('updateFulfillmentSettings', () => {
    test('should update fulfillment settings', () => {
      const product = DropshipProductAggregate.create(createValidDropshipProductParams())
      product.uncommittedEvents = []

      product.updateFulfillmentSettings('gooten', 25.99, 'GOOTEN-SKU-456', 'user-123')

      const snapshot = product.toSnapshot()
      expect(snapshot.fulfillmentProviderId).toBe('gooten')
      expect(snapshot.supplierCost).toBe(25.99)
      expect(snapshot.supplierSku).toBe('GOOTEN-SKU-456')
      expect(product.uncommittedEvents[0]).toBeInstanceOf(DropshipProductFulfillmentSettingsUpdatedEvent)
      expect(product.uncommittedEvents[0]!.eventName).toBe('dropship_product.fulfillment_settings_updated')
    })

    test('should allow setting fulfillment settings to null', () => {
      const product = DropshipProductAggregate.create(createValidDropshipProductParams())
      product.uncommittedEvents = []

      product.updateFulfillmentSettings(null, null, null, 'user-123')

      const snapshot = product.toSnapshot()
      expect(snapshot.fulfillmentProviderId).toBeNull()
      expect(snapshot.supplierCost).toBeNull()
      expect(snapshot.supplierSku).toBeNull()
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

  describe('scheduleHiddenDrop', () => {
    test('should set draft product to hidden pending drop status', () => {
      const product = DropshipProductAggregate.create(createValidDropshipProductParams())
      product.uncommittedEvents = []

      product.scheduleHiddenDrop('user-123')

      expect(product.toSnapshot().status).toBe('hidden_pending_drop')
      expect(product.version).toBe(1)
      expect(product.uncommittedEvents).toHaveLength(1)
      expect(product.uncommittedEvents[0]).toBeInstanceOf(DropshipProductHiddenDropScheduledEvent)
      expect(product.uncommittedEvents[0]!.eventName).toBe('dropship_product.hidden_drop_scheduled')
    })

    test('should throw error when product is already in hidden pending drop status', () => {
      const product = DropshipProductAggregate.create(createValidDropshipProductParams())
      product.scheduleHiddenDrop('user-123')

      expect(() => product.scheduleHiddenDrop('user-123')).toThrow('Product is already scheduled for hidden drop')
    })

    test('should throw error when product is archived', () => {
      const product = DropshipProductAggregate.create(createValidDropshipProductParams())
      product.archive('user-123')

      expect(() => product.scheduleHiddenDrop('user-123')).toThrow('Cannot schedule drop on an archived product')
    })

    test('should throw error when product has no variants', () => {
      const product = DropshipProductAggregate.create(createValidDropshipProductParams())
      product.uncommittedEvents = []

      expect(() => product.scheduleHiddenDrop('user-123', false)).toThrow('Cannot schedule drop on product without at least one variant')
    })
  })

  describe('scheduleVisibleDrop', () => {
    test('should set draft product to visible pending drop status', () => {
      const product = DropshipProductAggregate.create(createValidDropshipProductParams())
      product.uncommittedEvents = []

      product.scheduleVisibleDrop('user-123')

      expect(product.toSnapshot().status).toBe('visible_pending_drop')
      expect(product.version).toBe(1)
      expect(product.uncommittedEvents).toHaveLength(1)
      expect(product.uncommittedEvents[0]).toBeInstanceOf(DropshipProductVisibleDropScheduledEvent)
      expect(product.uncommittedEvents[0]!.eventName).toBe('dropship_product.visible_drop_scheduled')
    })

    test('should throw error when product is already in visible pending drop status', () => {
      const product = DropshipProductAggregate.create(createValidDropshipProductParams())
      product.scheduleVisibleDrop('user-123')

      expect(() => product.scheduleVisibleDrop('user-123')).toThrow('Product is already scheduled for visible drop')
    })

    test('should throw error when product is archived', () => {
      const product = DropshipProductAggregate.create(createValidDropshipProductParams())
      product.archive('user-123')

      expect(() => product.scheduleVisibleDrop('user-123')).toThrow('Cannot schedule drop on an archived product')
    })

    test('should throw error when product has no variants', () => {
      const product = DropshipProductAggregate.create(createValidDropshipProductParams())
      product.uncommittedEvents = []

      expect(() => product.scheduleVisibleDrop('user-123', false)).toThrow('Cannot schedule drop on product without at least one variant')
    })
  })

  describe('publish from pending drop', () => {
    test('should publish product from hidden pending drop status', () => {
      const product = DropshipProductAggregate.create(createValidDropshipProductParams())
      product.scheduleHiddenDrop('user-123')
      product.uncommittedEvents = []

      product.publish('user-123')

      expect(product.toSnapshot().status).toBe('active')
      expect(product.toSnapshot().publishedAt).not.toBeNull()
    })

    test('should publish product from visible pending drop status', () => {
      const product = DropshipProductAggregate.create(createValidDropshipProductParams())
      product.scheduleVisibleDrop('user-123')
      product.uncommittedEvents = []

      product.publish('user-123')

      expect(product.toSnapshot().status).toBe('active')
      expect(product.toSnapshot().publishedAt).not.toBeNull()
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
          fulfillmentProviderId: 'printful',
          supplierCost: 12.50,
          supplierSku: 'PRINTFUL-123',
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
      expect(product.toSnapshot().fulfillmentProviderId).toBe('printful')
      expect(product.toSnapshot().supplierCost).toBe(12.50)
      expect(product.toSnapshot().supplierSku).toBe('PRINTFUL-123')
      expect(product.version).toBe(5)
    })

    test('should load product from snapshot with null fulfillment settings', () => {
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
          status: 'draft',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
          publishedAt: null,
        }),
      }

      const product = DropshipProductAggregate.loadFromSnapshot(snapshot)

      expect(product.toSnapshot().fulfillmentProviderId).toBeNull()
      expect(product.toSnapshot().supplierCost).toBeNull()
      expect(product.toSnapshot().supplierSku).toBeNull()
    })
  })

  describe('toSnapshot', () => {
    test('should return complete snapshot of product state', () => {
      const product = DropshipProductAggregate.create(createValidDropshipProductParams())
      const snapshot = product.toSnapshot()

      expect(snapshot.id).toBe(product.id)
      expect(snapshot.productType).toBe('dropship')
      expect(snapshot.dropshipSafetyBuffer).toBe(5)
      expect(snapshot.fulfillmentProviderId).toBe('printful')
      expect(snapshot.supplierCost).toBe(15.99)
      expect(snapshot.supplierSku).toBe('SUPPLIER-SKU-123')
      expect(snapshot.status).toBe('draft')
    })
  })

  describe('validatePublish', () => {
    test('should throw error when publishing with negative safety buffer', () => {
      const product = DropshipProductAggregate.create({
        ...createValidDropshipProductParams(),
        dropshipSafetyBuffer: -1,
      })
      product.uncommittedEvents = []

      expect(() => product.publish('user-123')).toThrow('Dropship products must have a non-negative safety buffer')
    })
  })
})
