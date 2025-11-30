import { describe, test, expect } from 'bun:test'
import { DigitalDownloadableVariantAggregate } from '../../../../src/api/domain/digitalDownloadableVariant/aggregate'
import { DigitalDownloadableVariantCreatedEvent, DigitalDownloadableVariantArchivedEvent, DigitalDownloadableVariantPublishedEvent, DigitalDownloadableVariantImagesUpdatedEvent, DigitalDownloadableVariantDigitalAssetAttachedEvent, DigitalDownloadableVariantDigitalAssetDetachedEvent, DigitalDownloadableVariantDownloadSettingsUpdatedEvent, type DigitalAsset } from '../../../../src/api/domain/digitalDownloadableVariant/events'
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

function createValidDigitalDownloadableVariantParams() {
  return {
    id: 'digital-variant-123',
    correlationId: 'correlation-123',
    userId: 'user-123',
    productId: 'product-123',
    sku: 'DIG-SKU-123',
    price: 19.99,
    options: { format: 'PDF' },
    maxDownloads: 3,
    accessDurationDays: 14,
  }
}

describe('DigitalDownloadableVariantAggregate', () => {
  describe('create', () => {
    test('should create a new digital downloadable variant aggregate with draft status', () => {
      const params = createValidDigitalDownloadableVariantParams()
      const variant = DigitalDownloadableVariantAggregate.create(params)

      const snapshot = variant.toSnapshot()
      expect(variant.id).toBe(params.id)
      expect(snapshot.productId).toBe(params.productId)
      expect(snapshot.sku).toBe(params.sku)
      expect(snapshot.price).toBe(params.price)
      expect(snapshot.inventory).toBe(-1) // Digital variants always have -1 inventory
      expect(snapshot.options).toEqual(params.options)
      expect(snapshot.variantType).toBe('digital_downloadable')
      expect(snapshot.status).toBe('draft')
      expect(snapshot.digitalAsset).toBeNull()
      expect(snapshot.maxDownloads).toBe(3)
      expect(snapshot.accessDurationDays).toBe(14)
      expect(variant.version).toBe(0)
      expect(variant.uncommittedEvents).toHaveLength(1)
      expect(variant.uncommittedEvents[0]).toBeInstanceOf(DigitalDownloadableVariantCreatedEvent)
      expect(variant.uncommittedEvents[0]!.eventName).toBe('digital_downloadable_variant.created')
    })

    test('should create variant with default values when optional params not provided', () => {
      const variant = DigitalDownloadableVariantAggregate.create({
        id: 'variant-123',
        correlationId: 'correlation-123',
        userId: 'user-123',
        productId: 'product-123',
      })

      const snapshot = variant.toSnapshot()
      expect(snapshot.sku).toBe('')
      expect(snapshot.price).toBe(0)
      expect(snapshot.options).toEqual({})
      expect(snapshot.maxDownloads).toBeNull()
      expect(snapshot.accessDurationDays).toBeNull()
    })

    test('should create variant with null download settings for using product defaults', () => {
      const variant = DigitalDownloadableVariantAggregate.create({
        id: 'variant-123',
        correlationId: 'correlation-123',
        userId: 'user-123',
        productId: 'product-123',
        maxDownloads: null,
        accessDurationDays: null,
      })

      const snapshot = variant.toSnapshot()
      expect(snapshot.maxDownloads).toBeNull()
      expect(snapshot.accessDurationDays).toBeNull()
    })
  })

  describe('publish', () => {
    test('should publish draft variant', () => {
      const variant = DigitalDownloadableVariantAggregate.create(createValidDigitalDownloadableVariantParams())
      variant.uncommittedEvents = []

      variant.publish('user-123')

      const snapshot = variant.toSnapshot()
      expect(snapshot.status).toBe('active')
      expect(snapshot.publishedAt).not.toBeNull()
      expect(variant.version).toBe(1)
      expect(variant.uncommittedEvents).toHaveLength(1)
      expect(variant.uncommittedEvents[0]).toBeInstanceOf(DigitalDownloadableVariantPublishedEvent)
      expect(variant.uncommittedEvents[0]!.eventName).toBe('digital_downloadable_variant.published')
    })

    test('should throw error when variant is already published', () => {
      const variant = DigitalDownloadableVariantAggregate.create(createValidDigitalDownloadableVariantParams())
      variant.uncommittedEvents = []
      variant.publish('user-123')

      expect(() => variant.publish('user-123')).toThrow('Variant is already published')
    })

    test('should throw error when variant is archived', () => {
      const variant = DigitalDownloadableVariantAggregate.create(createValidDigitalDownloadableVariantParams())
      variant.uncommittedEvents = []
      variant.archive('user-123')

      expect(() => variant.publish('user-123')).toThrow('Cannot publish an archived variant')
    })

    test('should throw error when variant has no SKU', () => {
      const variant = DigitalDownloadableVariantAggregate.create({
        id: 'variant-123',
        correlationId: 'correlation-123',
        userId: 'user-123',
        productId: 'product-123',
        sku: '',
        price: 10,
      })
      variant.uncommittedEvents = []

      expect(() => variant.publish('user-123')).toThrow('Cannot publish variant without a SKU')
    })

    test('should throw error when variant has negative price', () => {
      const variant = DigitalDownloadableVariantAggregate.create({
        ...createValidDigitalDownloadableVariantParams(),
        price: -10,
      })
      variant.uncommittedEvents = []

      expect(() => variant.publish('user-123')).toThrow('Cannot publish variant with negative price')
    })
  })

  describe('archive', () => {
    test('should archive draft variant', () => {
      const variant = DigitalDownloadableVariantAggregate.create(createValidDigitalDownloadableVariantParams())
      variant.uncommittedEvents = []

      variant.archive('user-123')

      expect(variant.toSnapshot().status).toBe('archived')
      expect(variant.version).toBe(1)
      expect(variant.uncommittedEvents).toHaveLength(1)
      expect(variant.uncommittedEvents[0]).toBeInstanceOf(DigitalDownloadableVariantArchivedEvent)
      expect(variant.uncommittedEvents[0]!.eventName).toBe('digital_downloadable_variant.archived')
    })

    test('should throw error when variant is already archived', () => {
      const variant = DigitalDownloadableVariantAggregate.create(createValidDigitalDownloadableVariantParams())
      variant.uncommittedEvents = []
      variant.archive('user-123')

      expect(() => variant.archive('user-123')).toThrow('Variant is already archived')
    })
  })

  describe('updateDetails', () => {
    test('should update options', () => {
      const variant = DigitalDownloadableVariantAggregate.create(createValidDigitalDownloadableVariantParams())
      variant.uncommittedEvents = []

      variant.updateDetails({ format: 'EPUB', license: 'Personal' }, 'user-123')

      expect(variant.toSnapshot().options).toEqual({ format: 'EPUB', license: 'Personal' })
      expect(variant.uncommittedEvents[0]!.eventName).toBe('digital_downloadable_variant.details_updated')
    })
  })

  describe('updatePrice', () => {
    test('should update price', () => {
      const variant = DigitalDownloadableVariantAggregate.create(createValidDigitalDownloadableVariantParams())
      variant.uncommittedEvents = []

      variant.updatePrice(29.99, 'user-123')

      expect(variant.toSnapshot().price).toBe(29.99)
      expect(variant.uncommittedEvents[0]!.eventName).toBe('digital_downloadable_variant.price_updated')
    })
  })

  describe('updateSku', () => {
    test('should update sku', () => {
      const variant = DigitalDownloadableVariantAggregate.create(createValidDigitalDownloadableVariantParams())
      variant.uncommittedEvents = []

      variant.updateSku('NEW-SKU-456', 'user-123')

      expect(variant.toSnapshot().sku).toBe('NEW-SKU-456')
      expect(variant.uncommittedEvents[0]!.eventName).toBe('digital_downloadable_variant.sku_updated')
    })
  })

  describe('updateImages', () => {
    test('should update images with new collection', () => {
      const variant = DigitalDownloadableVariantAggregate.create(createValidDigitalDownloadableVariantParams())
      variant.uncommittedEvents = []
      const uploadResult = createMockImageUploadResult('img-1')
      const images = ImageCollection.empty().addImage(uploadResult, 'Test image')

      variant.updateImages(images, 'user-123')

      const snapshot = variant.toSnapshot()
      expect(snapshot.images).toHaveLength(1)
      expect(snapshot.images[0]?.imageId).toBe('img-1')
      expect(variant.uncommittedEvents[0]).toBeInstanceOf(DigitalDownloadableVariantImagesUpdatedEvent)
      expect(variant.uncommittedEvents[0]!.eventName).toBe('digital_downloadable_variant.images_updated')
    })
  })

  describe('attachDigitalAsset', () => {
    test('should attach digital asset to variant', () => {
      const variant = DigitalDownloadableVariantAggregate.create(createValidDigitalDownloadableVariantParams())
      variant.uncommittedEvents = []
      const asset: DigitalAsset = {
        name: 'ebook.pdf',
        fileKey: 'files/abc123.pdf',
        mimeType: 'application/pdf',
        size: 1024000,
      }

      variant.attachDigitalAsset(asset, 'user-123')

      const snapshot = variant.toSnapshot()
      expect(snapshot.digitalAsset).toEqual(asset)
      expect(variant.version).toBe(1)
      expect(variant.uncommittedEvents[0]).toBeInstanceOf(DigitalDownloadableVariantDigitalAssetAttachedEvent)
      expect(variant.uncommittedEvents[0]!.eventName).toBe('digital_downloadable_variant.digital_asset_attached')
    })

    test('should replace existing digital asset', () => {
      const variant = DigitalDownloadableVariantAggregate.create(createValidDigitalDownloadableVariantParams())
      const firstAsset: DigitalAsset = {
        name: 'old.pdf',
        fileKey: 'files/old123.pdf',
        mimeType: 'application/pdf',
        size: 500000,
      }
      variant.attachDigitalAsset(firstAsset, 'user-123')
      variant.uncommittedEvents = []

      const newAsset: DigitalAsset = {
        name: 'new.pdf',
        fileKey: 'files/new456.pdf',
        mimeType: 'application/pdf',
        size: 1024000,
      }
      variant.attachDigitalAsset(newAsset, 'user-123')

      expect(variant.toSnapshot().digitalAsset).toEqual(newAsset)
    })
  })

  describe('detachDigitalAsset', () => {
    test('should detach digital asset from variant', () => {
      const variant = DigitalDownloadableVariantAggregate.create(createValidDigitalDownloadableVariantParams())
      const asset: DigitalAsset = {
        name: 'ebook.pdf',
        fileKey: 'files/abc123.pdf',
        mimeType: 'application/pdf',
        size: 1024000,
      }
      variant.attachDigitalAsset(asset, 'user-123')
      variant.uncommittedEvents = []

      variant.detachDigitalAsset('user-123')

      expect(variant.toSnapshot().digitalAsset).toBeNull()
      expect(variant.uncommittedEvents[0]).toBeInstanceOf(DigitalDownloadableVariantDigitalAssetDetachedEvent)
      expect(variant.uncommittedEvents[0]!.eventName).toBe('digital_downloadable_variant.digital_asset_detached')
    })
  })

  describe('updateDownloadSettings', () => {
    test('should update download settings', () => {
      const variant = DigitalDownloadableVariantAggregate.create(createValidDigitalDownloadableVariantParams())
      variant.uncommittedEvents = []

      variant.updateDownloadSettings(10, 30, 'user-123')

      const snapshot = variant.toSnapshot()
      expect(snapshot.maxDownloads).toBe(10)
      expect(snapshot.accessDurationDays).toBe(30)
      expect(variant.uncommittedEvents[0]).toBeInstanceOf(DigitalDownloadableVariantDownloadSettingsUpdatedEvent)
      expect(variant.uncommittedEvents[0]!.eventName).toBe('digital_downloadable_variant.download_settings_updated')
    })

    test('should allow setting download settings to null to use product defaults', () => {
      const variant = DigitalDownloadableVariantAggregate.create(createValidDigitalDownloadableVariantParams())
      variant.uncommittedEvents = []

      variant.updateDownloadSettings(null, null, 'user-123')

      const snapshot = variant.toSnapshot()
      expect(snapshot.maxDownloads).toBeNull()
      expect(snapshot.accessDurationDays).toBeNull()
    })
  })

  describe('loadFromSnapshot', () => {
    test('should load variant from snapshot', () => {
      const snapshot = {
        aggregateId: 'digital-variant-123',
        correlationId: 'correlation-123',
        version: 5,
        payload: JSON.stringify({
          productId: 'product-123',
          sku: 'SKU-123',
          price: 29.99,
          inventory: -1,
          options: { format: 'PDF' },
          variantType: 'digital_downloadable',
          status: 'active',
          publishedAt: '2024-01-02T00:00:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
          images: [],
          digitalAsset: null,
          maxDownloads: 5,
          accessDurationDays: 7,
        }),
      }

      const variant = DigitalDownloadableVariantAggregate.loadFromSnapshot(snapshot)

      expect(variant.id).toBe('digital-variant-123')
      expect(variant.toSnapshot().variantType).toBe('digital_downloadable')
      expect(variant.toSnapshot().inventory).toBe(-1)
      expect(variant.toSnapshot().maxDownloads).toBe(5)
      expect(variant.toSnapshot().accessDurationDays).toBe(7)
      expect(variant.version).toBe(5)
    })

    test('should load variant with digital asset', () => {
      const asset: DigitalAsset = {
        name: 'ebook.pdf',
        fileKey: 'files/abc123.pdf',
        mimeType: 'application/pdf',
        size: 1024000,
      }
      const snapshot = {
        aggregateId: 'digital-variant-123',
        correlationId: 'correlation-123',
        version: 5,
        payload: JSON.stringify({
          productId: 'product-123',
          sku: 'SKU-123',
          price: 29.99,
          inventory: -1,
          options: {},
          variantType: 'digital_downloadable',
          status: 'draft',
          publishedAt: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
          images: [],
          digitalAsset: asset,
          maxDownloads: null,
          accessDurationDays: null,
        }),
      }

      const variant = DigitalDownloadableVariantAggregate.loadFromSnapshot(snapshot)

      expect(variant.toSnapshot().digitalAsset).toEqual(asset)
      expect(variant.toSnapshot().maxDownloads).toBeNull()
      expect(variant.toSnapshot().accessDurationDays).toBeNull()
    })
  })

  describe('toSnapshot', () => {
    test('should return complete snapshot of variant state', () => {
      const variant = DigitalDownloadableVariantAggregate.create(createValidDigitalDownloadableVariantParams())
      const snapshot = variant.toSnapshot()

      expect(snapshot.id).toBe(variant.id)
      expect(snapshot.variantType).toBe('digital_downloadable')
      expect(snapshot.inventory).toBe(-1)
      expect(snapshot.status).toBe('draft')
      expect(snapshot.version).toBe(variant.version)
      expect(snapshot.maxDownloads).toBe(3)
      expect(snapshot.accessDurationDays).toBe(14)
    })
  })
})
