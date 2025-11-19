import { describe, test, expect } from 'bun:test'
import { VariantAggregate } from '../../../src/domain/variant/aggregate'
import { VariantCreatedEvent, VariantArchivedEvent, VariantDetailsUpdatedEvent, VariantPriceUpdatedEvent, VariantInventoryUpdatedEvent, VariantPublishedEvent, VariantImagesUpdatedEvent, VariantDigitalAssetAttachedEvent, VariantDigitalAssetDetachedEvent, type DigitalAsset } from '../../../src/domain/variant/events'
import { ImageCollection } from '../../../src/domain/_base/imageCollection'
import type { ImageUploadResult } from '../../../src/infrastructure/adapters/imageStorageAdapter'
import type { DomainEvent } from '../../../src/domain/_base/domainEvent'

function createMockImageUploadResult(imageId: string): ImageUploadResult {
  return {
    imageId,
    urls: {
      thumbnail: { original: `https://example.com/${imageId}/thumbnail.jpg`, webp: null },
      small: { original: `https://example.com/${imageId}/small.jpg`, webp: null },
      medium: { original: `https://example.com/${imageId}/medium.jpg`, webp: null },
      large: { original: `https://example.com/${imageId}/large.jpg`, webp: null },
    },
  }
}

function createValidVariantParams() {
  return {
    id: 'variant-123',
    correlationId: 'correlation-123',
    userId: 'user-123',
    productId: 'product-123',
    sku: 'SKU-123',
    title: 'Test Variant',
    price: 29.99,
    inventory: 100,
    options: { size: 'Large', color: 'Red' },
    barcode: '123456789' as string | null,
  }
}

describe('VariantAggregate', () => {
  describe('create', () => {
    test('should create a new variant aggregate with draft status', () => {
      // Arrange
      const params = createValidVariantParams()

      // Act
      const variant = VariantAggregate.create(params)

      // Assert
      const snapshot = variant.toSnapshot()
      expect(variant.id).toBe(params.id)
      expect(snapshot.productId).toBe(params.productId)
      expect(snapshot.sku).toBe(params.sku)
      expect(snapshot.title).toBe(params.title)
      expect(snapshot.price).toBe(params.price)
      expect(snapshot.inventory).toBe(params.inventory)
      expect(snapshot.options).toEqual(params.options)
      expect(snapshot.barcode).toBe(params.barcode)
      expect(snapshot.status).toBe('draft')
      expect(snapshot.publishedAt).toBeNull()
      expect(variant.version).toBe(0)
      expect(variant.events).toEqual([])
      expect(variant.uncommittedEvents).toHaveLength(1)
      const event = variant.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(VariantCreatedEvent)
      expect(event.eventName).toBe('variant.created')
      expect(event.aggregateId).toBe(params.id)
      expect(event.correlationId).toBe(params.correlationId)
      expect(event.version).toBe(0)
    })

    test('should create with null barcode', () => {
      // Arrange
      const params = createValidVariantParams()
      params.barcode = null

      // Act
      const variant = VariantAggregate.create(params)

      // Assert
      expect(variant.toSnapshot().barcode).toBeNull()
    })
  })

  describe('publish', () => {
    test('should publish draft variant', () => {
      // Arrange
      const variant = VariantAggregate.create(createValidVariantParams())
      variant.uncommittedEvents = []

      // Act
      variant.publish('user-123')

      // Assert
      const snapshot = variant.toSnapshot()
      expect(snapshot.status).toBe('active')
      expect(snapshot.publishedAt).not.toBeNull()
      expect(variant.version).toBe(1)
      expect(variant.uncommittedEvents).toHaveLength(1)
      const event = variant.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(VariantPublishedEvent)
      expect(event.eventName).toBe('variant.published')
      expect(event.version).toBe(1)
    })

    test('should throw error when variant already published', () => {
      // Arrange
      const variant = VariantAggregate.create(createValidVariantParams())
      variant.uncommittedEvents = []
      variant.publish('user-123')
      variant.uncommittedEvents = []

      // Act & Assert
      expect(() => variant.publish('user-123')).toThrow('Variant is already published')
    })

    test('should throw error when variant is archived', () => {
      // Arrange
      const variant = VariantAggregate.create(createValidVariantParams())
      variant.uncommittedEvents = []
      variant.archive('user-123')
      variant.uncommittedEvents = []

      // Act & Assert
      expect(() => variant.publish('user-123')).toThrow('Cannot publish an archived variant')
    })
  })

  describe('archive', () => {
    test('should archive draft variant', () => {
      // Arrange
      const variant = VariantAggregate.create(createValidVariantParams())
      variant.uncommittedEvents = []

      // Act
      variant.archive('user-123')

      // Assert
      expect(variant.toSnapshot().status).toBe('archived')
      expect(variant.version).toBe(1)
      expect(variant.uncommittedEvents).toHaveLength(1)
      const event = variant.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(VariantArchivedEvent)
      expect(event.eventName).toBe('variant.archived')
      expect(event.version).toBe(1)
    })

    test('should throw error when variant already archived', () => {
      // Arrange
      const variant = VariantAggregate.create(createValidVariantParams())
      variant.uncommittedEvents = []
      variant.archive('user-123')
      variant.uncommittedEvents = []

      // Act & Assert
      expect(() => variant.archive('user-123')).toThrow('Variant is already archived')
    })
  })

  describe('updateDetails', () => {
    test('should update title, options, and barcode', () => {
      // Arrange
      const variant = VariantAggregate.create(createValidVariantParams())
      variant.uncommittedEvents = []

      // Act
      variant.updateDetails('New Title', { size: 'Small', color: 'Blue' }, '987654321', 'user-123')

      // Assert
      const snapshot = variant.toSnapshot()
      expect(snapshot.title).toBe('New Title')
      expect(snapshot.options).toEqual({ size: 'Small', color: 'Blue' })
      expect(snapshot.barcode).toBe('987654321')
      expect(variant.uncommittedEvents).toHaveLength(1)
      const event = variant.uncommittedEvents[0]!
      expect(event.eventName).toBe('variant.details_updated')
    })
  })

  describe('updatePrice', () => {
    test('should update price', () => {
      // Arrange
      const variant = VariantAggregate.create(createValidVariantParams())
      variant.uncommittedEvents = []

      // Act
      variant.updatePrice(39.99, 'user-123')

      // Assert
      expect(variant.toSnapshot().price).toBe(39.99)
      expect(variant.uncommittedEvents).toHaveLength(1)
      const event = variant.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(VariantPriceUpdatedEvent)
      expect(event.eventName).toBe('variant.price_updated')
    })
  })

  describe('updateInventory', () => {
    test('should update inventory', () => {
      // Arrange
      const variant = VariantAggregate.create(createValidVariantParams())
      variant.uncommittedEvents = []

      // Act
      variant.updateInventory(200, 'user-123')

      // Assert
      expect(variant.toSnapshot().inventory).toBe(200)
      expect(variant.uncommittedEvents).toHaveLength(1)
      const event = variant.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(VariantInventoryUpdatedEvent)
      expect(event.eventName).toBe('variant.inventory_updated')
    })
  })

  describe('updateImages', () => {
    test('should update images with new collection', () => {
      // Arrange
      const variant = VariantAggregate.create(createValidVariantParams())
      variant.uncommittedEvents = []
      const uploadResult = createMockImageUploadResult('img-1')
      const images = ImageCollection.empty().addImage(uploadResult, 'Test image')

      // Act
      variant.updateImages(images, 'user-123')

      // Assert
      const snapshot = variant.toSnapshot()
      expect(snapshot.images).toHaveLength(1)
      expect(snapshot.images[0]?.imageId).toBe('img-1')
      expect(snapshot.images[0]?.altText).toBe('Test image')
      expect(variant.uncommittedEvents).toHaveLength(1)
      const event = variant.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(VariantImagesUpdatedEvent)
      expect(event.eventName).toBe('variant.images_updated')
    })

    test('should update images with multiple images', () => {
      // Arrange
      const variant = VariantAggregate.create(createValidVariantParams())
      variant.uncommittedEvents = []
      let images = ImageCollection.empty()
      images = images.addImage(createMockImageUploadResult('img-1'), 'First')
      images = images.addImage(createMockImageUploadResult('img-2'), 'Second')
      images = images.addImage(createMockImageUploadResult('img-3'), 'Third')

      // Act
      variant.updateImages(images, 'user-123')

      // Assert
      const snapshot = variant.toSnapshot()
      expect(snapshot.images).toHaveLength(3)
      expect(snapshot.images[0]?.imageId).toBe('img-1')
      expect(snapshot.images[1]?.imageId).toBe('img-2')
      expect(snapshot.images[2]?.imageId).toBe('img-3')
    })

    test('should update images with empty collection', () => {
      // Arrange
      const variant = VariantAggregate.create(createValidVariantParams())
      variant.uncommittedEvents = []
      const images = ImageCollection.empty()

      // Act
      variant.updateImages(images, 'user-123')

      // Assert
      const snapshot = variant.toSnapshot()
      expect(snapshot.images).toHaveLength(0)
      expect(variant.uncommittedEvents).toHaveLength(1)
    })
  })

  describe('apply', () => {
    test('should apply VariantCreatedEvent and update state', () => {
      // Arrange
      const variantId = 'variant-123'
      const correlationId = 'correlation-123'
      const occurredAt = new Date()
      const createdAt = occurredAt
      const createdEvent = new VariantCreatedEvent({
        occurredAt,
        correlationId,
        aggregateId: variantId,
        version: 0,
        userId: 'user-123',
        priorState: {} as any,
        newState: {
          productId: 'product-123',
          sku: 'SKU-123',
          title: 'Created Variant',
          price: 29.99,
          inventory: 100,
          options: { size: 'Large' },
          barcode: '123',
          status: 'draft' as const,
          createdAt,
          updatedAt: createdAt,
          publishedAt: null,
          images: ImageCollection.empty(),
        },
      })

      const variant = new VariantAggregate({
        id: variantId,
        correlationId,
        createdAt: new Date(),
        updatedAt: new Date(),
        productId: '',
        sku: '',
        title: '',
        price: 0,
        inventory: 0,
        options: {},
        barcode: null,
        version: 0,
        events: [],
        status: 'draft',
        publishedAt: null,
        images: ImageCollection.empty(),
      })

      // Act
      variant.apply(createdEvent)

      // Assert
      expect(variant.toSnapshot().title).toBe('Created Variant')
      expect(variant.toSnapshot().price).toBe(29.99)
      expect(variant.version).toBe(1)
      expect(variant.events).toHaveLength(1)
    })

    test('should apply VariantArchivedEvent and update state', () => {
      // Arrange
      const variant = VariantAggregate.create(createValidVariantParams())
      variant.uncommittedEvents = []
      const snapshot = variant.toSnapshot()
      const { id, version, ...priorState } = snapshot

      const archivedEvent = new VariantArchivedEvent({
        occurredAt: new Date(),
        correlationId: createValidVariantParams().correlationId,
        aggregateId: variant.id,
        version: 1,
        userId: 'user-123',
        priorState: priorState as any,
        newState: {
          ...priorState,
          status: 'archived' as const,
          updatedAt: new Date(),
          publishedAt: null,
        } as any,
      })

      // Act
      variant.apply(archivedEvent)

      // Assert
      expect(variant.toSnapshot().status).toBe('archived')
      expect(variant.version).toBe(1)
    })
  })

  describe('loadFromSnapshot', () => {
    test('should load variant from snapshot', () => {
      // Arrange
      const snapshot = {
        aggregate_id: 'variant-123',
        correlation_id: 'correlation-123',
        version: 5,
        payload: JSON.stringify({
          productId: 'product-123',
          sku: 'SKU-123',
          title: 'Snapshot Variant',
          price: 29.99,
          inventory: 100,
          options: { size: 'Large' },
          barcode: '123',
          publishedAt: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        }),
      }

      // Act
      const variant = VariantAggregate.loadFromSnapshot(snapshot)

      // Assert
      const variantSnapshot = variant.toSnapshot()
      expect(variant.id).toBe('variant-123')
      expect(variantSnapshot.title).toBe('Snapshot Variant')
      expect(variantSnapshot.price).toBe(29.99)
      expect(variantSnapshot.publishedAt).toBeNull()
      expect(variant.version).toBe(5)
      expect(variant.events).toEqual([])
    })

    test('should load variant from snapshot with publishedAt', () => {
      // Arrange
      const snapshot = {
        aggregate_id: 'variant-123',
        correlation_id: 'correlation-123',
        version: 5,
        payload: JSON.stringify({
          productId: 'product-123',
          sku: 'SKU-123',
          title: 'Snapshot Variant',
          price: 29.99,
          inventory: 100,
          options: { size: 'Large' },
          barcode: '123',
          status: 'active',
          publishedAt: '2024-01-03T00:00:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        }),
      }

      // Act
      const variant = VariantAggregate.loadFromSnapshot(snapshot)

      // Assert
      const variantSnapshot = variant.toSnapshot()
      expect(variant.id).toBe('variant-123')
      expect(variantSnapshot.title).toBe('Snapshot Variant')
      expect(variantSnapshot.status).toBe('active')
      expect(variantSnapshot.publishedAt).not.toBeNull()
      expect(variantSnapshot.publishedAt).toBeInstanceOf(Date)
      expect(variant.version).toBe(5)
      expect(variant.events).toEqual([])
    })
  })

  describe('apply variant.published', () => {
    test('should apply VariantPublishedEvent and update state', () => {
      // Arrange
      const variant = VariantAggregate.create(createValidVariantParams())
      variant.uncommittedEvents = []
      const snapshot = variant.toSnapshot()
      const { id, version, ...priorState } = snapshot

      const publishedAt = new Date()
      const publishedEvent = new VariantPublishedEvent({
        occurredAt: publishedAt,
        correlationId: createValidVariantParams().correlationId,
        aggregateId: variant.id,
        version: 1,
        userId: 'user-123',
        priorState: priorState as any,
        newState: {
          ...priorState,
          status: 'active' as const,
          publishedAt,
          updatedAt: publishedAt,
        } as any,
      })

      // Act
      variant.apply(publishedEvent)

      // Assert
      const updatedSnapshot = variant.toSnapshot()
      expect(updatedSnapshot.status).toBe('active')
      expect(updatedSnapshot.publishedAt).not.toBeNull()
      expect(updatedSnapshot.publishedAt).toEqual(publishedAt)
      expect(variant.version).toBe(1)
    })
  })

  describe('apply variant.images_updated', () => {
    test('should apply VariantImagesUpdatedEvent and update state', () => {
      // Arrange
      const variant = VariantAggregate.create(createValidVariantParams())
      variant.uncommittedEvents = []
      const snapshot = variant.toSnapshot()
      const { id, version, ...priorState } = snapshot

      const uploadResult = createMockImageUploadResult('img-1')
      const images = ImageCollection.empty().addImage(uploadResult, 'Test image')
      const occurredAt = new Date()

      const imagesUpdatedEvent = new VariantImagesUpdatedEvent({
        occurredAt,
        correlationId: createValidVariantParams().correlationId,
        aggregateId: variant.id,
        version: 1,
        userId: 'user-123',
        priorState: priorState as any,
        newState: {
          ...priorState,
          images,
          updatedAt: occurredAt,
        } as any,
      })

      // Act
      variant.apply(imagesUpdatedEvent)

      // Assert
      const updatedSnapshot = variant.toSnapshot()
      expect(updatedSnapshot.images).toHaveLength(1)
      expect(updatedSnapshot.images[0]?.imageId).toBe('img-1')
      expect(updatedSnapshot.images[0]?.altText).toBe('Test image')
      expect(variant.version).toBe(1)
    })
  })

  describe('loadFromSnapshot with images', () => {
    test('should load variant from snapshot with empty images', () => {
      // Arrange
      const snapshot = {
        aggregate_id: 'variant-123',
        correlation_id: 'correlation-123',
        version: 5,
        payload: JSON.stringify({
          productId: 'product-123',
          sku: 'SKU-123',
          title: 'Snapshot Variant',
          price: 29.99,
          inventory: 100,
          options: { size: 'Large' },
          barcode: '123',
          status: 'draft',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
          images: [],
        }),
      }

      // Act
      const variant = VariantAggregate.loadFromSnapshot(snapshot)

      // Assert
      const variantSnapshot = variant.toSnapshot()
      expect(variantSnapshot.images).toHaveLength(0)
    })

    test('should load variant from snapshot with images', () => {
      // Arrange
      const snapshot = {
        aggregate_id: 'variant-123',
        correlation_id: 'correlation-123',
        version: 5,
        payload: JSON.stringify({
          productId: 'product-123',
          sku: 'SKU-123',
          title: 'Snapshot Variant',
          price: 29.99,
          inventory: 100,
          options: { size: 'Large' },
          barcode: '123',
          status: 'draft',
          publishedAt: null,
          updatedAt: '2024-01-02T00:00:00.000Z',
          images: [
            {
              imageId: 'img-1',
              urls: {
                thumbnail: { original: 'https://example.com/img-1/thumbnail.jpg', webp: null },
                small: { original: 'https://example.com/img-1/small.jpg', webp: null },
                medium: { original: 'https://example.com/img-1/medium.jpg', webp: null },
                large: { original: 'https://example.com/img-1/large.jpg', webp: null },
              },
              uploadedAt: '2024-01-01T00:00:00.000Z',
              altText: 'Test image',
            },
          ],
        }),
      }

      // Act
      const variant = VariantAggregate.loadFromSnapshot(snapshot)

      // Assert
      const variantSnapshot = variant.toSnapshot()
      expect(variantSnapshot.images).toHaveLength(1)
      expect(variantSnapshot.images[0]?.imageId).toBe('img-1')
      expect(variantSnapshot.images[0]?.altText).toBe('Test image')
    })

    test('should load variant from legacy snapshot without images field', () => {
      // Arrange
      const snapshot = {
        aggregate_id: 'variant-123',
        correlation_id: 'correlation-123',
        version: 5,
        payload: JSON.stringify({
          productId: 'product-123',
          sku: 'SKU-123',
          title: 'Legacy Variant',
          price: 29.99,
          inventory: 100,
          options: { size: 'Large' },
          barcode: '123',
          status: 'draft',
          publishedAt: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          // No images field
        }),
      }

      // Act
      const variant = VariantAggregate.loadFromSnapshot(snapshot)

      // Assert
      const variantSnapshot = variant.toSnapshot()
      expect(variantSnapshot.images).toHaveLength(0)
    })
  })

  describe('create with images', () => {
    test('should create variant with empty images collection', () => {
      // Arrange & Act
      const variant = VariantAggregate.create(createValidVariantParams())

      // Assert
      const snapshot = variant.toSnapshot()
      expect(snapshot.images).toHaveLength(0)
      expect(Array.isArray(snapshot.images)).toBe(true)
    })
  })

  describe('attachDigitalAsset', () => {
    test('should attach digital asset to variant', () => {
      // Arrange
      const variant = VariantAggregate.create(createValidVariantParams())
      variant.uncommittedEvents = []
      const asset: DigitalAsset = {
        name: 'ebook.pdf',
        fileKey: 'files/abc123.pdf',
        mimeType: 'application/pdf',
        size: 1024000,
      }

      // Act
      variant.attachDigitalAsset(asset, 'user-123')

      // Assert
      const snapshot = variant.toSnapshot()
      expect(snapshot.digitalAsset).toEqual(asset)
      expect(variant.version).toBe(1)
      expect(variant.uncommittedEvents).toHaveLength(1)
      const event = variant.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(VariantDigitalAssetAttachedEvent)
      expect(event.eventName).toBe('variant.digital_asset_attached')
      expect(event.version).toBe(1)
    })

    test('should replace existing digital asset', () => {
      // Arrange
      const variant = VariantAggregate.create(createValidVariantParams())
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

      // Act
      variant.attachDigitalAsset(newAsset, 'user-123')

      // Assert
      const snapshot = variant.toSnapshot()
      expect(snapshot.digitalAsset).toEqual(newAsset)
      expect(variant.uncommittedEvents).toHaveLength(1)
      const event = variant.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(VariantDigitalAssetAttachedEvent)
    })
  })

  describe('detachDigitalAsset', () => {
    test('should detach digital asset from variant', () => {
      // Arrange
      const variant = VariantAggregate.create(createValidVariantParams())
      const asset: DigitalAsset = {
        name: 'ebook.pdf',
        fileKey: 'files/abc123.pdf',
        mimeType: 'application/pdf',
        size: 1024000,
      }
      variant.attachDigitalAsset(asset, 'user-123')
      variant.uncommittedEvents = []

      // Act
      variant.detachDigitalAsset('user-123')

      // Assert
      const snapshot = variant.toSnapshot()
      expect(snapshot.digitalAsset).toBeNull()
      expect(variant.version).toBe(2)
      expect(variant.uncommittedEvents).toHaveLength(1)
      const event = variant.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(VariantDigitalAssetDetachedEvent)
      expect(event.eventName).toBe('variant.digital_asset_detached')
      expect(event.version).toBe(2)
    })

    test('should work when no asset exists', () => {
      // Arrange
      const variant = VariantAggregate.create(createValidVariantParams())
      variant.uncommittedEvents = []

      // Act
      variant.detachDigitalAsset('user-123')

      // Assert
      const snapshot = variant.toSnapshot()
      expect(snapshot.digitalAsset).toBeNull()
      expect(variant.uncommittedEvents).toHaveLength(1)
    })
  })

  describe('apply digital asset events', () => {
    test('should apply VariantDigitalAssetAttachedEvent', () => {
      // Arrange
      const variant = VariantAggregate.create(createValidVariantParams())
      const asset: DigitalAsset = {
        name: 'ebook.pdf',
        fileKey: 'files/abc123.pdf',
        mimeType: 'application/pdf',
        size: 1024000,
      }
      const occurredAt = new Date()
      const event = new VariantDigitalAssetAttachedEvent({
        occurredAt,
        correlationId: 'correlation-123',
        aggregateId: variant.id,
        version: 1,
        userId: 'user-123',
        priorState: {
          productId: 'product-123',
          sku: 'SKU-123',
          title: 'Test',
          price: 29.99,
          inventory: 100,
          options: {},
          barcode: null,
          status: 'draft' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
          publishedAt: null,
          images: ImageCollection.empty(),
          digitalAsset: null,
        },
        newState: {
          productId: 'product-123',
          sku: 'SKU-123',
          title: 'Test',
          price: 29.99,
          inventory: 100,
          options: {},
          barcode: null,
          status: 'draft' as const,
          createdAt: new Date(),
          updatedAt: occurredAt,
          publishedAt: null,
          images: ImageCollection.empty(),
          digitalAsset: asset,
        },
      })

      // Act
      variant.apply(event)

      // Assert
      const snapshot = variant.toSnapshot()
      expect(snapshot.digitalAsset).toEqual(asset)
      expect(snapshot.updatedAt).toEqual(occurredAt)
    })

    test('should apply VariantDigitalAssetDetachedEvent', () => {
      // Arrange
      const variant = VariantAggregate.create(createValidVariantParams())
      const asset: DigitalAsset = {
        name: 'ebook.pdf',
        fileKey: 'files/abc123.pdf',
        mimeType: 'application/pdf',
        size: 1024000,
      }
      variant.attachDigitalAsset(asset, 'user-123')

      const occurredAt = new Date()
      const event = new VariantDigitalAssetDetachedEvent({
        occurredAt,
        correlationId: 'correlation-123',
        aggregateId: variant.id,
        version: 2,
        userId: 'user-123',
        priorState: {
          productId: 'product-123',
          sku: 'SKU-123',
          title: 'Test',
          price: 29.99,
          inventory: 100,
          options: {},
          barcode: null,
          status: 'draft' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
          publishedAt: null,
          images: ImageCollection.empty(),
          digitalAsset: asset,
        },
        newState: {
          productId: 'product-123',
          sku: 'SKU-123',
          title: 'Test',
          price: 29.99,
          inventory: 100,
          options: {},
          barcode: null,
          status: 'draft' as const,
          createdAt: new Date(),
          updatedAt: occurredAt,
          publishedAt: null,
          images: ImageCollection.empty(),
          digitalAsset: null,
        },
      })

      // Act
      variant.apply(event)

      // Assert
      const snapshot = variant.toSnapshot()
      expect(snapshot.digitalAsset).toBeNull()
      expect(snapshot.updatedAt).toEqual(occurredAt)
    })
  })

  describe('loadFromSnapshot with digitalAsset', () => {
    test('should load variant with digital asset', () => {
      // Arrange
      const asset: DigitalAsset = {
        name: 'ebook.pdf',
        fileKey: 'files/abc123.pdf',
        mimeType: 'application/pdf',
        size: 1024000,
      }
      const snapshot = {
        aggregate_id: 'variant-123',
        correlation_id: 'correlation-123',
        version: 5,
        payload: JSON.stringify({
          productId: 'product-123',
          sku: 'SKU-123',
          title: 'Test Variant',
          price: 29.99,
          inventory: 100,
          options: { size: 'Large' },
          barcode: '123',
          status: 'draft',
          publishedAt: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
          images: [],
          digitalAsset: asset,
        }),
      }

      // Act
      const variant = VariantAggregate.loadFromSnapshot(snapshot)

      // Assert
      const variantSnapshot = variant.toSnapshot()
      expect(variantSnapshot.digitalAsset).toEqual(asset)
    })

    test('should load variant without digital asset (null)', () => {
      // Arrange
      const snapshot = {
        aggregate_id: 'variant-123',
        correlation_id: 'correlation-123',
        version: 5,
        payload: JSON.stringify({
          productId: 'product-123',
          sku: 'SKU-123',
          title: 'Test Variant',
          price: 29.99,
          inventory: 100,
          options: { size: 'Large' },
          barcode: '123',
          status: 'draft',
          publishedAt: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
          images: [],
          digitalAsset: null,
        }),
      }

      // Act
      const variant = VariantAggregate.loadFromSnapshot(snapshot)

      // Assert
      const variantSnapshot = variant.toSnapshot()
      expect(variantSnapshot.digitalAsset).toBeNull()
    })

    test('should handle legacy snapshot without digitalAsset field', () => {
      // Arrange
      const snapshot = {
        aggregate_id: 'variant-123',
        correlation_id: 'correlation-123',
        version: 5,
        payload: JSON.stringify({
          productId: 'product-123',
          sku: 'SKU-123',
          title: 'Legacy Variant',
          price: 29.99,
          inventory: 100,
          options: { size: 'Large' },
          barcode: '123',
          status: 'draft',
          publishedAt: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          images: [],
          // No digitalAsset field
        }),
      }

      // Act
      const variant = VariantAggregate.loadFromSnapshot(snapshot)

      // Assert
      const variantSnapshot = variant.toSnapshot()
      expect(variantSnapshot.digitalAsset).toBeNull()
    })
  })
})

