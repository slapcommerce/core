import { describe, test, expect } from 'bun:test'
import { DropshipVariantAggregate } from '../../../../src/api/domain/dropshipVariant/aggregate'
import { DropshipVariantCreatedEvent, DropshipVariantArchivedEvent, DropshipVariantPublishedEvent, DropshipVariantInventoryUpdatedEvent, DropshipVariantImagesUpdatedEvent, DropshipVariantFulfillmentSettingsUpdatedEvent, DropshipVariantHiddenDropScheduledEvent, DropshipVariantVisibleDropScheduledEvent } from '../../../../src/api/domain/dropshipVariant/events'
import { ImageCollection } from '../../../../src/api/domain/_base/imageCollection'
import type { ImageUploadResult } from '../../../../src/api/infrastructure/adapters/imageStorageAdapter'

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

function createValidDropshipVariantParams() {
  return {
    id: 'dropship-variant-123',
    correlationId: 'correlation-123',
    userId: 'user-123',
    productId: 'product-123',
    sku: 'DROP-SKU-123',
    price: 49.99,
    inventory: 100,
    options: { size: 'Large', color: 'Red' },
    fulfillmentProviderId: 'printful',
    supplierCost: 25.00,
    supplierSku: 'PRINTFUL-VAR-123',
  }
}

describe('DropshipVariantAggregate', () => {
  describe('create', () => {
    test('should create a new dropship variant aggregate with draft status', () => {
      const params = createValidDropshipVariantParams()
      const variant = DropshipVariantAggregate.create(params)

      const snapshot = variant.toSnapshot()
      expect(variant.id).toBe(params.id)
      expect(snapshot.productId).toBe(params.productId)
      expect(snapshot.sku).toBe(params.sku)
      expect(snapshot.price).toBe(params.price)
      expect(snapshot.inventory).toBe(params.inventory)
      expect(snapshot.options).toEqual(params.options)
      expect(snapshot.variantType).toBe('dropship')
      expect(snapshot.fulfillmentProviderId).toBe(params.fulfillmentProviderId)
      expect(snapshot.supplierCost).toBe(params.supplierCost)
      expect(snapshot.supplierSku).toBe(params.supplierSku)
      expect(snapshot.status).toBe('draft')
      expect(variant.version).toBe(0)
      expect(variant.uncommittedEvents).toHaveLength(1)
      expect(variant.uncommittedEvents[0]).toBeInstanceOf(DropshipVariantCreatedEvent)
      expect(variant.uncommittedEvents[0]!.eventName).toBe('dropship_variant.created')
    })

    test('should create variant with default values when optional params not provided', () => {
      const variant = DropshipVariantAggregate.create({
        id: 'variant-123',
        correlationId: 'correlation-123',
        userId: 'user-123',
        productId: 'product-123',
      })

      const snapshot = variant.toSnapshot()
      expect(snapshot.sku).toBe('')
      expect(snapshot.price).toBe(0)
      expect(snapshot.inventory).toBe(0)
      expect(snapshot.options).toEqual({})
      expect(snapshot.fulfillmentProviderId).toBeNull()
      expect(snapshot.supplierCost).toBeNull()
      expect(snapshot.supplierSku).toBeNull()
    })
  })

  describe('publish', () => {
    test('should publish draft variant', () => {
      const variant = DropshipVariantAggregate.create(createValidDropshipVariantParams())
      variant.uncommittedEvents = []

      variant.publish('user-123')

      const snapshot = variant.toSnapshot()
      expect(snapshot.status).toBe('active')
      expect(snapshot.publishedAt).not.toBeNull()
      expect(variant.uncommittedEvents[0]).toBeInstanceOf(DropshipVariantPublishedEvent)
      expect(variant.uncommittedEvents[0]!.eventName).toBe('dropship_variant.published')
    })

    test('should throw error when variant is already published', () => {
      const variant = DropshipVariantAggregate.create(createValidDropshipVariantParams())
      variant.uncommittedEvents = []
      variant.publish('user-123')

      expect(() => variant.publish('user-123')).toThrow('Variant is already published')
    })

    test('should throw error when variant is archived', () => {
      const variant = DropshipVariantAggregate.create(createValidDropshipVariantParams())
      variant.uncommittedEvents = []
      variant.archive('user-123')

      expect(() => variant.publish('user-123')).toThrow('Cannot publish an archived variant')
    })

    test('should throw error when variant has no SKU', () => {
      const variant = DropshipVariantAggregate.create({
        id: 'variant-123',
        correlationId: 'correlation-123',
        userId: 'user-123',
        productId: 'product-123',
        sku: '',
        price: 10,
        inventory: 10,
      })
      variant.uncommittedEvents = []

      expect(() => variant.publish('user-123')).toThrow('Cannot publish variant without a SKU')
    })

    test('should throw error when variant has negative price', () => {
      const variant = DropshipVariantAggregate.create({
        ...createValidDropshipVariantParams(),
        price: -10,
      })
      variant.uncommittedEvents = []

      expect(() => variant.publish('user-123')).toThrow('Cannot publish variant with negative price')
    })

    test('should throw error when variant has negative inventory', () => {
      const variant = DropshipVariantAggregate.create({
        ...createValidDropshipVariantParams(),
        inventory: -10,
      })
      variant.uncommittedEvents = []

      expect(() => variant.publish('user-123')).toThrow('Cannot publish variant with negative inventory')
    })
  })

  describe('archive', () => {
    test('should archive draft variant', () => {
      const variant = DropshipVariantAggregate.create(createValidDropshipVariantParams())
      variant.uncommittedEvents = []

      variant.archive('user-123')

      expect(variant.toSnapshot().status).toBe('archived')
      expect(variant.uncommittedEvents[0]).toBeInstanceOf(DropshipVariantArchivedEvent)
      expect(variant.uncommittedEvents[0]!.eventName).toBe('dropship_variant.archived')
    })

    test('should throw error when variant is already archived', () => {
      const variant = DropshipVariantAggregate.create(createValidDropshipVariantParams())
      variant.uncommittedEvents = []
      variant.archive('user-123')

      expect(() => variant.archive('user-123')).toThrow('Variant is already archived')
    })
  })

  describe('updateDetails', () => {
    test('should update options', () => {
      const variant = DropshipVariantAggregate.create(createValidDropshipVariantParams())
      variant.uncommittedEvents = []

      variant.updateDetails({ size: 'Small', color: 'Blue' }, 'user-123')

      expect(variant.toSnapshot().options).toEqual({ size: 'Small', color: 'Blue' })
      expect(variant.uncommittedEvents[0]!.eventName).toBe('dropship_variant.details_updated')
    })
  })

  describe('updatePrice', () => {
    test('should update price', () => {
      const variant = DropshipVariantAggregate.create(createValidDropshipVariantParams())
      variant.uncommittedEvents = []

      variant.updatePrice(59.99, 'user-123')

      expect(variant.toSnapshot().price).toBe(59.99)
      expect(variant.uncommittedEvents[0]!.eventName).toBe('dropship_variant.price_updated')
    })
  })

  describe('updateInventory', () => {
    test('should update inventory', () => {
      const variant = DropshipVariantAggregate.create(createValidDropshipVariantParams())
      variant.uncommittedEvents = []

      variant.updateInventory(200, 'user-123')

      expect(variant.toSnapshot().inventory).toBe(200)
      expect(variant.uncommittedEvents[0]).toBeInstanceOf(DropshipVariantInventoryUpdatedEvent)
      expect(variant.uncommittedEvents[0]!.eventName).toBe('dropship_variant.inventory_updated')
    })
  })

  describe('updateFulfillmentSettings', () => {
    test('should update fulfillment settings', () => {
      const variant = DropshipVariantAggregate.create(createValidDropshipVariantParams())
      variant.uncommittedEvents = []

      variant.updateFulfillmentSettings('gooten', 30.00, 'GOOTEN-VAR-456', 'user-123')

      const snapshot = variant.toSnapshot()
      expect(snapshot.fulfillmentProviderId).toBe('gooten')
      expect(snapshot.supplierCost).toBe(30.00)
      expect(snapshot.supplierSku).toBe('GOOTEN-VAR-456')
      expect(variant.uncommittedEvents[0]).toBeInstanceOf(DropshipVariantFulfillmentSettingsUpdatedEvent)
      expect(variant.uncommittedEvents[0]!.eventName).toBe('dropship_variant.fulfillment_settings_updated')
    })

    test('should allow setting fulfillment settings to null to use product defaults', () => {
      const variant = DropshipVariantAggregate.create(createValidDropshipVariantParams())
      variant.uncommittedEvents = []

      variant.updateFulfillmentSettings(null, null, null, 'user-123')

      const snapshot = variant.toSnapshot()
      expect(snapshot.fulfillmentProviderId).toBeNull()
      expect(snapshot.supplierCost).toBeNull()
      expect(snapshot.supplierSku).toBeNull()
    })
  })

  describe('updateSku', () => {
    test('should update sku', () => {
      const variant = DropshipVariantAggregate.create(createValidDropshipVariantParams())
      variant.uncommittedEvents = []

      variant.updateSku('NEW-SKU-456', 'user-123')

      expect(variant.toSnapshot().sku).toBe('NEW-SKU-456')
      expect(variant.uncommittedEvents[0]!.eventName).toBe('dropship_variant.sku_updated')
    })
  })

  describe('updateImages', () => {
    test('should update images with new collection', () => {
      const variant = DropshipVariantAggregate.create(createValidDropshipVariantParams())
      variant.uncommittedEvents = []
      const uploadResult = createMockImageUploadResult('img-1')
      const images = ImageCollection.empty().addImage(uploadResult, 'Test image')

      variant.updateImages(images, 'user-123')

      const snapshot = variant.toSnapshot()
      expect(snapshot.images).toHaveLength(1)
      expect(snapshot.images[0]?.imageId).toBe('img-1')
      expect(variant.uncommittedEvents[0]).toBeInstanceOf(DropshipVariantImagesUpdatedEvent)
      expect(variant.uncommittedEvents[0]!.eventName).toBe('dropship_variant.images_updated')
    })
  })

  describe('scheduleHiddenDrop', () => {
    test('should set draft variant to hidden pending drop status', () => {
      const variant = DropshipVariantAggregate.create(createValidDropshipVariantParams())
      variant.uncommittedEvents = []

      variant.scheduleHiddenDrop('user-123')

      expect(variant.toSnapshot().status).toBe('hidden_pending_drop')
      expect(variant.version).toBe(1)
      expect(variant.uncommittedEvents).toHaveLength(1)
      expect(variant.uncommittedEvents[0]).toBeInstanceOf(DropshipVariantHiddenDropScheduledEvent)
      expect(variant.uncommittedEvents[0]!.eventName).toBe('dropship_variant.hidden_drop_scheduled')
    })

    test('should throw error when variant is already in hidden pending drop status', () => {
      const variant = DropshipVariantAggregate.create(createValidDropshipVariantParams())
      variant.scheduleHiddenDrop('user-123')

      expect(() => variant.scheduleHiddenDrop('user-123')).toThrow('Variant is already scheduled for hidden drop')
    })

    test('should throw error when variant is archived', () => {
      const variant = DropshipVariantAggregate.create(createValidDropshipVariantParams())
      variant.archive('user-123')

      expect(() => variant.scheduleHiddenDrop('user-123')).toThrow('Cannot schedule drop on an archived variant')
    })
  })

  describe('scheduleVisibleDrop', () => {
    test('should set draft variant to visible pending drop status', () => {
      const variant = DropshipVariantAggregate.create(createValidDropshipVariantParams())
      variant.uncommittedEvents = []

      variant.scheduleVisibleDrop('user-123')

      expect(variant.toSnapshot().status).toBe('visible_pending_drop')
      expect(variant.version).toBe(1)
      expect(variant.uncommittedEvents).toHaveLength(1)
      expect(variant.uncommittedEvents[0]).toBeInstanceOf(DropshipVariantVisibleDropScheduledEvent)
      expect(variant.uncommittedEvents[0]!.eventName).toBe('dropship_variant.visible_drop_scheduled')
    })

    test('should throw error when variant is already in visible pending drop status', () => {
      const variant = DropshipVariantAggregate.create(createValidDropshipVariantParams())
      variant.scheduleVisibleDrop('user-123')

      expect(() => variant.scheduleVisibleDrop('user-123')).toThrow('Variant is already scheduled for visible drop')
    })

    test('should throw error when variant is archived', () => {
      const variant = DropshipVariantAggregate.create(createValidDropshipVariantParams())
      variant.archive('user-123')

      expect(() => variant.scheduleVisibleDrop('user-123')).toThrow('Cannot schedule drop on an archived variant')
    })
  })

  describe('publish from pending drop', () => {
    test('should publish variant from hidden pending drop status', () => {
      const variant = DropshipVariantAggregate.create(createValidDropshipVariantParams())
      variant.scheduleHiddenDrop('user-123')
      variant.uncommittedEvents = []

      variant.publish('user-123')

      expect(variant.toSnapshot().status).toBe('active')
      expect(variant.toSnapshot().publishedAt).not.toBeNull()
    })

    test('should publish variant from visible pending drop status', () => {
      const variant = DropshipVariantAggregate.create(createValidDropshipVariantParams())
      variant.scheduleVisibleDrop('user-123')
      variant.uncommittedEvents = []

      variant.publish('user-123')

      expect(variant.toSnapshot().status).toBe('active')
      expect(variant.toSnapshot().publishedAt).not.toBeNull()
    })
  })

  describe('loadFromSnapshot', () => {
    test('should load variant from snapshot', () => {
      const snapshot = {
        aggregateId: 'dropship-variant-123',
        correlationId: 'correlation-123',
        version: 5,
        payload: JSON.stringify({
          productId: 'product-123',
          sku: 'SKU-123',
          price: 49.99,
          inventory: 100,
          options: { size: 'Large' },
          variantType: 'dropship',
          fulfillmentProviderId: 'printful',
          supplierCost: 20.00,
          supplierSku: 'PRINTFUL-SKU',
          status: 'active',
          publishedAt: '2024-01-02T00:00:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
          images: [],
        }),
      }

      const variant = DropshipVariantAggregate.loadFromSnapshot(snapshot)

      expect(variant.id).toBe('dropship-variant-123')
      expect(variant.toSnapshot().variantType).toBe('dropship')
      expect(variant.toSnapshot().inventory).toBe(100)
      expect(variant.toSnapshot().fulfillmentProviderId).toBe('printful')
      expect(variant.toSnapshot().supplierCost).toBe(20.00)
      expect(variant.toSnapshot().supplierSku).toBe('PRINTFUL-SKU')
      expect(variant.version).toBe(5)
    })

    test('should load variant from snapshot with null fulfillment settings', () => {
      const snapshot = {
        aggregateId: 'dropship-variant-123',
        correlationId: 'correlation-123',
        version: 5,
        payload: JSON.stringify({
          productId: 'product-123',
          sku: 'SKU-123',
          price: 49.99,
          inventory: 100,
          options: {},
          variantType: 'dropship',
          status: 'draft',
          publishedAt: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
          images: [],
        }),
      }

      const variant = DropshipVariantAggregate.loadFromSnapshot(snapshot)

      expect(variant.toSnapshot().fulfillmentProviderId).toBeNull()
      expect(variant.toSnapshot().supplierCost).toBeNull()
      expect(variant.toSnapshot().supplierSku).toBeNull()
    })
  })

  describe('toSnapshot', () => {
    test('should return complete snapshot of variant state', () => {
      const variant = DropshipVariantAggregate.create(createValidDropshipVariantParams())
      const snapshot = variant.toSnapshot()

      expect(snapshot.id).toBe(variant.id)
      expect(snapshot.variantType).toBe('dropship')
      expect(snapshot.inventory).toBe(100)
      expect(snapshot.fulfillmentProviderId).toBe('printful')
      expect(snapshot.supplierCost).toBe(25.00)
      expect(snapshot.supplierSku).toBe('PRINTFUL-VAR-123')
      expect(snapshot.status).toBe('draft')
    })
  })
})
