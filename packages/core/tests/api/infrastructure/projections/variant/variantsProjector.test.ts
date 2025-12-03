import { describe, test, expect } from 'bun:test'
import { VariantsProjector } from '../../../../../src/api/infrastructure/projections/variant/variantsProjector'
import {
  DropshipVariantCreatedEvent,
  DropshipVariantArchivedEvent,
  DropshipVariantPublishedEvent,
  DropshipVariantDetailsUpdatedEvent,
  DropshipVariantPriceUpdatedEvent,
  DropshipVariantSkuUpdatedEvent,
  DropshipVariantInventoryUpdatedEvent,
  DropshipVariantImagesUpdatedEvent,
  DropshipVariantFulfillmentSettingsUpdatedEvent,
  type DropshipVariantState,
} from '../../../../../src/api/domain/dropshipVariant/events'
import {
  DigitalDownloadableVariantCreatedEvent,
  DigitalDownloadableVariantDigitalAssetAttachedEvent,
  DigitalDownloadableVariantDigitalAssetDetachedEvent,
  type DigitalDownloadableVariantState,
} from '../../../../../src/api/domain/digitalDownloadableVariant/events'
import { ImageCollection } from '../../../../../src/api/domain/_base/imageCollection'
import type { UnitOfWorkRepositories } from '../../../../../src/api/infrastructure/unitOfWork'

function createMockDropshipVariantState(overrides: Partial<DropshipVariantState> = {}): DropshipVariantState {
  return {
    variantType: 'dropship',
    productId: 'product-123',
    sku: 'SKU-001',
    listPrice: 29.99,
    saleType: null,
    saleValue: null,
    inventory: 100,
    options: { size: 'M', color: 'Blue' },
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: null,
    images: ImageCollection.empty(),
    fulfillmentProviderId: null,
    supplierCost: null,
    supplierSku: null,
    saleSchedule: null,
    dropSchedule: null,
    ...overrides,
  }
}

function createMockDigitalVariantState(overrides: Partial<DigitalDownloadableVariantState> = {}): DigitalDownloadableVariantState {
  return {
    variantType: 'digital_downloadable',
    productId: 'product-123',
    sku: 'SKU-001',
    listPrice: 29.99,
    saleType: null,
    saleValue: null,
    inventory: -1 as const,
    options: { size: 'M', color: 'Blue' },
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: null,
    images: ImageCollection.empty(),
    digitalAsset: null,
    maxDownloads: null,
    accessDurationDays: null,
    saleSchedule: null,
    dropSchedule: null,
    ...overrides,
  }
}

type SavedState = DropshipVariantState | DigitalDownloadableVariantState

function createMockRepositories(): { repositories: UnitOfWorkRepositories; savedStates: SavedState[] } {
  const savedStates: SavedState[] = []

  const mockVariantsReadModelRepository = {
    save: (state: SavedState) => {
      savedStates.push(state)
    },
  }

  const repositories = {
    variantsReadModelRepository: mockVariantsReadModelRepository,
  } as unknown as UnitOfWorkRepositories

  return { repositories, savedStates }
}

describe('VariantsProjector', () => {
  test('should handle dropship_variant.created event', async () => {
    const { repositories, savedStates } = createMockRepositories()
    const projector = new VariantsProjector(repositories)
    const newState = createMockDropshipVariantState({ sku: 'NEW-SKU' })
    const event = new DropshipVariantCreatedEvent({
      occurredAt: new Date(),
      aggregateId: 'variant-123',
      correlationId: 'correlation-123',
      version: 0,
      userId: 'user-123',
      priorState: createMockDropshipVariantState(),
      newState,
    })

    await projector.execute(event)

    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.sku).toBe('NEW-SKU')
    expect((savedStates[0] as any)?.id).toBe('variant-123')
  })

  test('should handle dropship_variant.archived event', async () => {
    const { repositories, savedStates } = createMockRepositories()
    const projector = new VariantsProjector(repositories)
    const newState = createMockDropshipVariantState({ status: 'archived' })
    const event = new DropshipVariantArchivedEvent({
      occurredAt: new Date(),
      aggregateId: 'variant-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockDropshipVariantState({ status: 'draft' }),
      newState,
    })

    await projector.execute(event)

    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.status).toBe('archived')
  })

  test('should handle dropship_variant.published event', async () => {
    const { repositories, savedStates } = createMockRepositories()
    const projector = new VariantsProjector(repositories)
    const publishedAt = new Date()
    const newState = createMockDropshipVariantState({ status: 'active', publishedAt })
    const event = new DropshipVariantPublishedEvent({
      occurredAt: new Date(),
      aggregateId: 'variant-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockDropshipVariantState({ status: 'draft' }),
      newState,
    })

    await projector.execute(event)

    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.status).toBe('active')
  })

  test('should handle dropship_variant.details_updated event', async () => {
    const { repositories, savedStates } = createMockRepositories()
    const projector = new VariantsProjector(repositories)
    const newOptions = { size: 'L', color: 'Red' }
    const newState = createMockDropshipVariantState({ options: newOptions })
    const event = new DropshipVariantDetailsUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: 'variant-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockDropshipVariantState(),
      newState,
    })

    await projector.execute(event)

    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.options).toEqual(newOptions)
  })

  test('should handle dropship_variant.price_updated event', async () => {
    const { repositories, savedStates } = createMockRepositories()
    const projector = new VariantsProjector(repositories)
    const newState = createMockDropshipVariantState({ listPrice: 49.99 })
    const event = new DropshipVariantPriceUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: 'variant-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockDropshipVariantState({ listPrice: 29.99 }),
      newState,
    })

    await projector.execute(event)

    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.listPrice).toBe(49.99)
  })

  test('should handle dropship_variant.sku_updated event', async () => {
    const { repositories, savedStates } = createMockRepositories()
    const projector = new VariantsProjector(repositories)
    const newState = createMockDropshipVariantState({ sku: 'UPDATED-SKU' })
    const event = new DropshipVariantSkuUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: 'variant-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockDropshipVariantState({ sku: 'OLD-SKU' }),
      newState,
    })

    await projector.execute(event)

    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.sku).toBe('UPDATED-SKU')
  })

  test('should handle dropship_variant.inventory_updated event', async () => {
    const { repositories, savedStates } = createMockRepositories()
    const projector = new VariantsProjector(repositories)
    const newState = createMockDropshipVariantState({ inventory: 50 })
    const event = new DropshipVariantInventoryUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: 'variant-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockDropshipVariantState({ inventory: 100 }),
      newState,
    })

    await projector.execute(event)

    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.inventory).toBe(50)
  })

  test('should handle dropship_variant.images_updated event', async () => {
    const { repositories, savedStates } = createMockRepositories()
    const projector = new VariantsProjector(repositories)
    const newImages = ImageCollection.empty()
    const newState = createMockDropshipVariantState({ images: newImages })
    const event = new DropshipVariantImagesUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: 'variant-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockDropshipVariantState(),
      newState,
    })

    await projector.execute(event)

    expect(savedStates).toHaveLength(1)
  })

  test('should handle dropship_variant.fulfillment_settings_updated event', async () => {
    const { repositories, savedStates } = createMockRepositories()
    const projector = new VariantsProjector(repositories)
    const newState = createMockDropshipVariantState({
      fulfillmentProviderId: 'provider-123',
      supplierCost: 50.00,
      supplierSku: 'SUPPLIER-SKU',
    })
    const event = new DropshipVariantFulfillmentSettingsUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: 'variant-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockDropshipVariantState(),
      newState,
    })

    await projector.execute(event)

    expect(savedStates).toHaveLength(1)
    expect((savedStates[0] as DropshipVariantState)?.fulfillmentProviderId).toBe('provider-123')
  })

  test('should handle digital_downloadable_variant.created event', async () => {
    const { repositories, savedStates } = createMockRepositories()
    const projector = new VariantsProjector(repositories)
    const newState = createMockDigitalVariantState({ sku: 'DIGITAL-SKU' })
    const event = new DigitalDownloadableVariantCreatedEvent({
      occurredAt: new Date(),
      aggregateId: 'variant-456',
      correlationId: 'correlation-456',
      version: 0,
      userId: 'user-123',
      priorState: createMockDigitalVariantState(),
      newState,
    })

    await projector.execute(event)

    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.sku).toBe('DIGITAL-SKU')
    expect(savedStates[0]?.variantType).toBe('digital_downloadable')
  })

  test('should handle digital_downloadable_variant.digital_asset_attached event', async () => {
    const { repositories, savedStates } = createMockRepositories()
    const projector = new VariantsProjector(repositories)
    const digitalAsset = {
      name: 'test-file.pdf',
      fileKey: 'files/test-file.pdf',
      mimeType: 'application/pdf',
      size: 1024,
    }
    const newState = createMockDigitalVariantState({ digitalAsset })
    const event = new DigitalDownloadableVariantDigitalAssetAttachedEvent({
      occurredAt: new Date(),
      aggregateId: 'variant-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockDigitalVariantState(),
      newState,
    })

    await projector.execute(event)

    expect(savedStates).toHaveLength(1)
    expect((savedStates[0] as DigitalDownloadableVariantState)?.digitalAsset).toEqual(digitalAsset)
  })

  test('should handle digital_downloadable_variant.digital_asset_detached event', async () => {
    const { repositories, savedStates } = createMockRepositories()
    const projector = new VariantsProjector(repositories)
    const newState = createMockDigitalVariantState({ digitalAsset: null })
    const event = new DigitalDownloadableVariantDigitalAssetDetachedEvent({
      occurredAt: new Date(),
      aggregateId: 'variant-123',
      correlationId: 'correlation-123',
      version: 2,
      userId: 'user-123',
      priorState: createMockDigitalVariantState({
        digitalAsset: {
          name: 'test-file.pdf',
          fileKey: 'files/test-file.pdf',
          mimeType: 'application/pdf',
          size: 1024,
        },
      }),
      newState,
    })

    await projector.execute(event)

    expect(savedStates).toHaveLength(1)
    expect((savedStates[0] as DigitalDownloadableVariantState)?.digitalAsset).toBeNull()
  })

  test('should ignore unhandled events', async () => {
    const { repositories, savedStates } = createMockRepositories()
    const projector = new VariantsProjector(repositories)

    const unknownEvent = {
      eventName: 'unknown.event',
      aggregateId: 'test-123',
      correlationId: 'correlation-123',
      version: 0,
      userId: 'user-123',
      occurredAt: new Date(),
      payload: {},
    }

    await projector.execute(unknownEvent as any)

    expect(savedStates).toHaveLength(0)
  })
})
