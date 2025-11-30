import { describe, test, expect } from 'bun:test'
import { PhysicalVariantAggregate } from '../../../../src/api/domain/physicalVariant/aggregate'
import { PhysicalVariantCreatedEvent, PhysicalVariantArchivedEvent, PhysicalVariantPublishedEvent, PhysicalVariantInventoryUpdatedEvent, PhysicalVariantImagesUpdatedEvent } from '../../../../src/api/domain/physicalVariant/events'
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

function createValidPhysicalVariantParams() {
  return {
    id: 'physical-variant-123',
    correlationId: 'correlation-123',
    userId: 'user-123',
    productId: 'product-123',
    sku: 'PHYS-SKU-123',
    price: 79.99,
    inventory: 50,
    options: { size: 'Medium', color: 'Blue' },
  }
}

describe('PhysicalVariantAggregate', () => {
  describe('create', () => {
    test('should create a new physical variant aggregate with draft status', () => {
      const params = createValidPhysicalVariantParams()
      const variant = PhysicalVariantAggregate.create(params)

      const snapshot = variant.toSnapshot()
      expect(variant.id).toBe(params.id)
      expect(snapshot.productId).toBe(params.productId)
      expect(snapshot.sku).toBe(params.sku)
      expect(snapshot.price).toBe(params.price)
      expect(snapshot.inventory).toBe(params.inventory)
      expect(snapshot.options).toEqual(params.options)
      expect(snapshot.variantType).toBe('physical')
      expect(snapshot.status).toBe('draft')
      expect(variant.version).toBe(0)
      expect(variant.uncommittedEvents).toHaveLength(1)
      expect(variant.uncommittedEvents[0]).toBeInstanceOf(PhysicalVariantCreatedEvent)
      expect(variant.uncommittedEvents[0]!.eventName).toBe('physical_variant.created')
    })

    test('should create variant with default values when optional params not provided', () => {
      const variant = PhysicalVariantAggregate.create({
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
    })
  })

  describe('publish', () => {
    test('should publish draft variant', () => {
      const variant = PhysicalVariantAggregate.create(createValidPhysicalVariantParams())
      variant.uncommittedEvents = []

      variant.publish('user-123')

      const snapshot = variant.toSnapshot()
      expect(snapshot.status).toBe('active')
      expect(snapshot.publishedAt).not.toBeNull()
      expect(variant.uncommittedEvents[0]).toBeInstanceOf(PhysicalVariantPublishedEvent)
      expect(variant.uncommittedEvents[0]!.eventName).toBe('physical_variant.published')
    })

    test('should throw error when variant is already published', () => {
      const variant = PhysicalVariantAggregate.create(createValidPhysicalVariantParams())
      variant.uncommittedEvents = []
      variant.publish('user-123')

      expect(() => variant.publish('user-123')).toThrow('Variant is already published')
    })

    test('should throw error when variant is archived', () => {
      const variant = PhysicalVariantAggregate.create(createValidPhysicalVariantParams())
      variant.uncommittedEvents = []
      variant.archive('user-123')

      expect(() => variant.publish('user-123')).toThrow('Cannot publish an archived variant')
    })

    test('should throw error when variant has no SKU', () => {
      const variant = PhysicalVariantAggregate.create({
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
      const variant = PhysicalVariantAggregate.create({
        ...createValidPhysicalVariantParams(),
        price: -10,
      })
      variant.uncommittedEvents = []

      expect(() => variant.publish('user-123')).toThrow('Cannot publish variant with negative price')
    })

    test('should throw error when variant has negative inventory', () => {
      const variant = PhysicalVariantAggregate.create({
        ...createValidPhysicalVariantParams(),
        inventory: -10,
      })
      variant.uncommittedEvents = []

      expect(() => variant.publish('user-123')).toThrow('Cannot publish variant with negative inventory')
    })
  })

  describe('archive', () => {
    test('should archive draft variant', () => {
      const variant = PhysicalVariantAggregate.create(createValidPhysicalVariantParams())
      variant.uncommittedEvents = []

      variant.archive('user-123')

      expect(variant.toSnapshot().status).toBe('archived')
      expect(variant.uncommittedEvents[0]).toBeInstanceOf(PhysicalVariantArchivedEvent)
      expect(variant.uncommittedEvents[0]!.eventName).toBe('physical_variant.archived')
    })

    test('should throw error when variant is already archived', () => {
      const variant = PhysicalVariantAggregate.create(createValidPhysicalVariantParams())
      variant.uncommittedEvents = []
      variant.archive('user-123')

      expect(() => variant.archive('user-123')).toThrow('Variant is already archived')
    })
  })

  describe('updateDetails', () => {
    test('should update options', () => {
      const variant = PhysicalVariantAggregate.create(createValidPhysicalVariantParams())
      variant.uncommittedEvents = []

      variant.updateDetails({ size: 'Small', color: 'Red' }, 'user-123')

      expect(variant.toSnapshot().options).toEqual({ size: 'Small', color: 'Red' })
      expect(variant.uncommittedEvents[0]!.eventName).toBe('physical_variant.details_updated')
    })
  })

  describe('updatePrice', () => {
    test('should update price', () => {
      const variant = PhysicalVariantAggregate.create(createValidPhysicalVariantParams())
      variant.uncommittedEvents = []

      variant.updatePrice(89.99, 'user-123')

      expect(variant.toSnapshot().price).toBe(89.99)
      expect(variant.uncommittedEvents[0]!.eventName).toBe('physical_variant.price_updated')
    })
  })

  describe('updateInventory', () => {
    test('should update inventory', () => {
      const variant = PhysicalVariantAggregate.create(createValidPhysicalVariantParams())
      variant.uncommittedEvents = []

      variant.updateInventory(100, 'user-123')

      expect(variant.toSnapshot().inventory).toBe(100)
      expect(variant.uncommittedEvents[0]).toBeInstanceOf(PhysicalVariantInventoryUpdatedEvent)
      expect(variant.uncommittedEvents[0]!.eventName).toBe('physical_variant.inventory_updated')
    })
  })

  describe('updateSku', () => {
    test('should update sku', () => {
      const variant = PhysicalVariantAggregate.create(createValidPhysicalVariantParams())
      variant.uncommittedEvents = []

      variant.updateSku('NEW-SKU-456', 'user-123')

      expect(variant.toSnapshot().sku).toBe('NEW-SKU-456')
      expect(variant.uncommittedEvents[0]!.eventName).toBe('physical_variant.sku_updated')
    })
  })

  describe('updateImages', () => {
    test('should update images with new collection', () => {
      const variant = PhysicalVariantAggregate.create(createValidPhysicalVariantParams())
      variant.uncommittedEvents = []
      const uploadResult = createMockImageUploadResult('img-1')
      const images = ImageCollection.empty().addImage(uploadResult, 'Test image')

      variant.updateImages(images, 'user-123')

      const snapshot = variant.toSnapshot()
      expect(snapshot.images).toHaveLength(1)
      expect(snapshot.images[0]?.imageId).toBe('img-1')
      expect(variant.uncommittedEvents[0]).toBeInstanceOf(PhysicalVariantImagesUpdatedEvent)
      expect(variant.uncommittedEvents[0]!.eventName).toBe('physical_variant.images_updated')
    })
  })

  describe('loadFromSnapshot', () => {
    test('should load variant from snapshot', () => {
      const snapshot = {
        aggregateId: 'physical-variant-123',
        correlationId: 'correlation-123',
        version: 5,
        payload: JSON.stringify({
          productId: 'product-123',
          sku: 'SKU-123',
          price: 79.99,
          inventory: 50,
          options: { size: 'Medium' },
          variantType: 'physical',
          status: 'active',
          publishedAt: '2024-01-02T00:00:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
          images: [],
        }),
      }

      const variant = PhysicalVariantAggregate.loadFromSnapshot(snapshot)

      expect(variant.id).toBe('physical-variant-123')
      expect(variant.toSnapshot().variantType).toBe('physical')
      expect(variant.toSnapshot().inventory).toBe(50)
      expect(variant.version).toBe(5)
    })
  })

  describe('toSnapshot', () => {
    test('should return complete snapshot of variant state', () => {
      const variant = PhysicalVariantAggregate.create(createValidPhysicalVariantParams())
      const snapshot = variant.toSnapshot()

      expect(snapshot.id).toBe(variant.id)
      expect(snapshot.variantType).toBe('physical')
      expect(snapshot.inventory).toBe(50)
      expect(snapshot.status).toBe('draft')
    })
  })
})
