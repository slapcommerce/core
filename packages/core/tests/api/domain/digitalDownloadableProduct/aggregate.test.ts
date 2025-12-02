import { describe, test, expect } from 'bun:test'
import { DigitalDownloadableProductAggregate } from '../../../../src/api/domain/digitalDownloadableProduct/aggregate'
import { DigitalDownloadableProductCreatedEvent, DigitalDownloadableProductArchivedEvent, DigitalDownloadableProductPublishedEvent, DigitalDownloadableProductDownloadSettingsUpdatedEvent, DigitalDownloadableProductHiddenDropScheduledEvent, DigitalDownloadableProductVisibleDropScheduledEvent } from '../../../../src/api/domain/digitalDownloadableProduct/events'

function createValidDigitalDownloadableProductParams() {
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
    maxDownloads: 5,
    accessDurationDays: 30,
  }
}

describe('DigitalDownloadableProductAggregate', () => {
  describe('create', () => {
    test('should create a new digital downloadable product aggregate with draft status', () => {
      const params = createValidDigitalDownloadableProductParams()
      const product = DigitalDownloadableProductAggregate.create(params)

      const snapshot = product.toSnapshot()
      expect(product.id).toBe(params.id)
      expect(snapshot.name).toBe(params.name)
      expect(snapshot.description).toBe(params.description)
      expect(snapshot.slug).toBe(params.slug)
      expect(snapshot.collections).toEqual(params.collections)
      expect(snapshot.productType).toBe('digital_downloadable')
      expect(snapshot.status).toBe('draft')
      expect(snapshot.maxDownloads).toBe(5)
      expect(snapshot.accessDurationDays).toBe(30)
      expect(product.version).toBe(0)
      expect(snapshot.publishedAt).toBeNull()
      expect(product.uncommittedEvents).toHaveLength(1)
      const event = product.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(DigitalDownloadableProductCreatedEvent)
      expect(event.eventName).toBe('digital_downloadable_product.created')
    })

    test('should create product with null download settings for unlimited access', () => {
      const params = { ...createValidDigitalDownloadableProductParams(), maxDownloads: null, accessDurationDays: null }
      const product = DigitalDownloadableProductAggregate.create(params)

      const snapshot = product.toSnapshot()
      expect(snapshot.maxDownloads).toBeNull()
      expect(snapshot.accessDurationDays).toBeNull()
    })

    test('should throw error if no collections provided', () => {
      const params = createValidDigitalDownloadableProductParams()
      params.collections = []

      expect(() => DigitalDownloadableProductAggregate.create(params)).toThrow('Product must belong to at least one collection')
    })
  })

  describe('archive', () => {
    test('should archive a draft product', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      product.uncommittedEvents = []

      product.archive('user-123')

      expect(product.toSnapshot().status).toBe('archived')
      expect(product.version).toBe(1)
      expect(product.uncommittedEvents).toHaveLength(1)
      expect(product.uncommittedEvents[0]).toBeInstanceOf(DigitalDownloadableProductArchivedEvent)
      expect(product.uncommittedEvents[0]!.eventName).toBe('digital_downloadable_product.archived')
    })

    test('should throw error when product is already archived', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      product.uncommittedEvents = []
      product.archive('user-123')

      expect(() => product.archive('user-123')).toThrow('Product is already archived')
    })
  })

  describe('publish', () => {
    test('should publish a draft product', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      product.uncommittedEvents = []

      product.publish('user-123')

      expect(product.toSnapshot().status).toBe('active')
      expect(product.toSnapshot().publishedAt).not.toBeNull()
      expect(product.version).toBe(1)
      expect(product.uncommittedEvents).toHaveLength(1)
      expect(product.uncommittedEvents[0]).toBeInstanceOf(DigitalDownloadableProductPublishedEvent)
      expect(product.uncommittedEvents[0]!.eventName).toBe('digital_downloadable_product.published')
    })

    test('should throw error when product is already published', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      product.uncommittedEvents = []
      product.publish('user-123')

      expect(() => product.publish('user-123')).toThrow('Product is already published')
    })

    test('should throw error when trying to publish archived product', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      product.uncommittedEvents = []
      product.archive('user-123')

      expect(() => product.publish('user-123')).toThrow('Cannot publish an archived product')
    })

    test('should throw error when trying to publish without variants', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      product.uncommittedEvents = []

      expect(() => product.publish('user-123', false)).toThrow('Cannot publish product without at least one variant')
    })
  })

  describe('unpublish', () => {
    test('should unpublish an active product', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      product.uncommittedEvents = []
      product.publish('user-123')
      product.uncommittedEvents = []

      product.unpublish('user-123')

      expect(product.toSnapshot().status).toBe('draft')
      expect(product.toSnapshot().publishedAt).toBeNull()
      expect(product.version).toBe(2)
    })

    test('should throw error when product is already unpublished', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      product.uncommittedEvents = []

      expect(() => product.unpublish('user-123')).toThrow('Product is already unpublished')
    })

    test('should throw error when trying to unpublish archived product', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      product.uncommittedEvents = []
      product.archive('user-123')

      expect(() => product.unpublish('user-123')).toThrow('Cannot unpublish an archived product')
    })
  })

  describe('changeSlug', () => {
    test('should change slug of a product', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      product.uncommittedEvents = []

      product.changeSlug('new-slug', 'user-123')

      expect(product.toSnapshot().slug).toBe('new-slug')
      expect(product.uncommittedEvents).toHaveLength(1)
      expect(product.uncommittedEvents[0]!.eventName).toBe('digital_downloadable_product.slug_changed')
    })

    test('should throw error when new slug is same as current slug', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      const currentSlug = product.toSnapshot().slug

      expect(() => product.changeSlug(currentSlug, 'user-123')).toThrow('New slug must be different from current slug')
    })
  })

  describe('updateDetails', () => {
    test('should update product details', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      product.uncommittedEvents = []

      product.updateDetails('New Title', 'New Description', 'https://example.com/new', 'user-123')

      const snapshot = product.toSnapshot()
      expect(snapshot.name).toBe('New Title')
      expect(snapshot.description).toBe('New Description')
      expect(snapshot.richDescriptionUrl).toBe('https://example.com/new')
      expect(product.uncommittedEvents[0]!.eventName).toBe('digital_downloadable_product.details_updated')
    })
  })

  describe('updateMetadata', () => {
    test('should update product metadata', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      product.uncommittedEvents = []

      product.updateMetadata('New Meta Title', 'New Meta Description', 'user-123')

      const snapshot = product.toSnapshot()
      expect(snapshot.metaTitle).toBe('New Meta Title')
      expect(snapshot.metaDescription).toBe('New Meta Description')
      expect(product.uncommittedEvents[0]!.eventName).toBe('digital_downloadable_product.metadata_updated')
    })
  })

  describe('updateVendor', () => {
    test('should update product vendor', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      product.uncommittedEvents = []

      product.updateVendor('New Vendor', 'user-123')

      expect(product.toSnapshot().vendor).toBe('New Vendor')
      expect(product.uncommittedEvents[0]!.eventName).toBe('digital_downloadable_product.classification_updated')
    })
  })

  describe('updateTags', () => {
    test('should update product tags', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      product.uncommittedEvents = []

      product.updateTags(['new-tag1', 'new-tag2'], 'user-123')

      expect(product.toSnapshot().tags).toEqual(['new-tag1', 'new-tag2'])
      expect(product.uncommittedEvents[0]!.eventName).toBe('digital_downloadable_product.tags_updated')
    })
  })

  describe('updateCollections', () => {
    test('should update product collections', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      product.uncommittedEvents = []

      product.updateCollections(['collection-2', 'collection-3'], 'user-123')

      expect(product.toSnapshot().collections).toEqual(['collection-2', 'collection-3'])
      expect(product.uncommittedEvents[0]!.eventName).toBe('digital_downloadable_product.collections_updated')
    })
  })

  describe('updateOptions', () => {
    test('should update variant options', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      product.uncommittedEvents = []

      product.updateOptions([{ name: 'License', values: ['Personal', 'Commercial'] }], 'user-123')

      expect(product.toSnapshot().variantOptions).toEqual([{ name: 'License', values: ['Personal', 'Commercial'] }])
      expect(product.uncommittedEvents[0]!.eventName).toBe('digital_downloadable_product.variant_options_updated')
    })
  })

  describe('updateTaxDetails', () => {
    test('should update tax details', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      product.uncommittedEvents = []

      product.updateTaxDetails(false, 'NEW-TAX-ID', 'user-123')

      const snapshot = product.toSnapshot()
      expect(snapshot.taxable).toBe(false)
      expect(snapshot.taxId).toBe('NEW-TAX-ID')
      expect(product.uncommittedEvents[0]!.eventName).toBe('digital_downloadable_product.tax_details_updated')
    })
  })

  describe('updateDownloadSettings', () => {
    test('should update download settings', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      product.uncommittedEvents = []

      product.updateDownloadSettings(10, 60, 'user-123')

      const snapshot = product.toSnapshot()
      expect(snapshot.maxDownloads).toBe(10)
      expect(snapshot.accessDurationDays).toBe(60)
      expect(product.uncommittedEvents[0]).toBeInstanceOf(DigitalDownloadableProductDownloadSettingsUpdatedEvent)
      expect(product.uncommittedEvents[0]!.eventName).toBe('digital_downloadable_product.download_settings_updated')
    })

    test('should allow setting download settings to null for unlimited', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      product.uncommittedEvents = []

      product.updateDownloadSettings(null, null, 'user-123')

      const snapshot = product.toSnapshot()
      expect(snapshot.maxDownloads).toBeNull()
      expect(snapshot.accessDurationDays).toBeNull()
    })
  })

  describe('setDefaultVariant', () => {
    test('should set default variant', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      product.uncommittedEvents = []

      product.setDefaultVariant('variant-123', 'user-123')

      expect(product.defaultVariantId).toBe('variant-123')
      expect(product.uncommittedEvents[0]!.eventName).toBe('digital_downloadable_product.default_variant_set')
    })
  })

  describe('clearDefaultVariant', () => {
    test('should clear default variant', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      product.setDefaultVariant('variant-123', 'user-123')
      product.uncommittedEvents = []

      product.clearDefaultVariant('user-123')

      expect(product.defaultVariantId).toBeNull()
      expect(product.uncommittedEvents[0]!.eventName).toBe('digital_downloadable_product.default_variant_set')
    })
  })

  describe('scheduleHiddenDrop', () => {
    test('should set draft product to hidden pending drop status', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      product.uncommittedEvents = []

      product.scheduleHiddenDrop('user-123')

      expect(product.toSnapshot().status).toBe('hidden_pending_drop')
      expect(product.version).toBe(1)
      expect(product.uncommittedEvents).toHaveLength(1)
      expect(product.uncommittedEvents[0]).toBeInstanceOf(DigitalDownloadableProductHiddenDropScheduledEvent)
      expect(product.uncommittedEvents[0]!.eventName).toBe('digital_downloadable_product.hidden_drop_scheduled')
    })

    test('should set active product to hidden pending drop status', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      product.publish('user-123')
      product.uncommittedEvents = []

      product.scheduleHiddenDrop('user-123')

      expect(product.toSnapshot().status).toBe('hidden_pending_drop')
    })

    test('should throw error when product is already in hidden pending drop status', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      product.scheduleHiddenDrop('user-123')

      expect(() => product.scheduleHiddenDrop('user-123')).toThrow('Product is already scheduled for hidden drop')
    })

    test('should throw error when product is archived', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      product.archive('user-123')

      expect(() => product.scheduleHiddenDrop('user-123')).toThrow('Cannot schedule drop on an archived product')
    })

    test('should throw error when product has no variants', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      product.uncommittedEvents = []

      expect(() => product.scheduleHiddenDrop('user-123', false)).toThrow('Cannot schedule drop on product without at least one variant')
    })
  })

  describe('scheduleVisibleDrop', () => {
    test('should set draft product to visible pending drop status', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      product.uncommittedEvents = []

      product.scheduleVisibleDrop('user-123')

      expect(product.toSnapshot().status).toBe('visible_pending_drop')
      expect(product.version).toBe(1)
      expect(product.uncommittedEvents).toHaveLength(1)
      expect(product.uncommittedEvents[0]).toBeInstanceOf(DigitalDownloadableProductVisibleDropScheduledEvent)
      expect(product.uncommittedEvents[0]!.eventName).toBe('digital_downloadable_product.visible_drop_scheduled')
    })

    test('should set active product to visible pending drop status', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      product.publish('user-123')
      product.uncommittedEvents = []

      product.scheduleVisibleDrop('user-123')

      expect(product.toSnapshot().status).toBe('visible_pending_drop')
    })

    test('should throw error when product is already in visible pending drop status', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      product.scheduleVisibleDrop('user-123')

      expect(() => product.scheduleVisibleDrop('user-123')).toThrow('Product is already scheduled for visible drop')
    })

    test('should throw error when product is archived', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      product.archive('user-123')

      expect(() => product.scheduleVisibleDrop('user-123')).toThrow('Cannot schedule drop on an archived product')
    })

    test('should throw error when product has no variants', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      product.uncommittedEvents = []

      expect(() => product.scheduleVisibleDrop('user-123', false)).toThrow('Cannot schedule drop on product without at least one variant')
    })
  })

  describe('publish from pending drop', () => {
    test('should publish product from hidden pending drop status', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      product.scheduleHiddenDrop('user-123')
      product.uncommittedEvents = []

      product.publish('user-123')

      expect(product.toSnapshot().status).toBe('active')
      expect(product.toSnapshot().publishedAt).not.toBeNull()
    })

    test('should publish product from visible pending drop status', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
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
          productType: 'digital_downloadable',
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
          maxDownloads: 3,
          accessDurationDays: 14,
        }),
      }

      const product = DigitalDownloadableProductAggregate.loadFromSnapshot(snapshot)

      expect(product.id).toBe('digital-product-123')
      expect(product.toSnapshot().name).toBe('Snapshot Product')
      expect(product.toSnapshot().productType).toBe('digital_downloadable')
      expect(product.toSnapshot().maxDownloads).toBe(3)
      expect(product.toSnapshot().accessDurationDays).toBe(14)
      expect(product.version).toBe(5)
    })

    test('should load product from snapshot with null download settings', () => {
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
          productType: 'digital_downloadable',
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

      const product = DigitalDownloadableProductAggregate.loadFromSnapshot(snapshot)

      expect(product.toSnapshot().maxDownloads).toBeNull()
      expect(product.toSnapshot().accessDurationDays).toBeNull()
    })
  })

  describe('toSnapshot', () => {
    test('should return complete snapshot of product state', () => {
      const product = DigitalDownloadableProductAggregate.create(createValidDigitalDownloadableProductParams())
      const snapshot = product.toSnapshot()

      expect(snapshot.id).toBe(product.id)
      expect(snapshot.productType).toBe('digital_downloadable')
      expect(snapshot.status).toBe('draft')
      expect(snapshot.version).toBe(product.version)
      expect(snapshot.maxDownloads).toBe(5)
      expect(snapshot.accessDurationDays).toBe(30)
    })
  })
})
