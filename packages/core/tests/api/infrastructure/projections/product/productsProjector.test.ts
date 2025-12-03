import { describe, test, expect } from 'bun:test'
import { ProductsProjector } from '../../../../../src/api/infrastructure/projections/product/productsProjector'
import {
  DropshipProductCreatedEvent,
  DropshipProductArchivedEvent,
  DropshipProductPublishedEvent,
  DropshipProductUnpublishedEvent,
  DropshipProductSlugChangedEvent,
  DropshipProductDetailsUpdatedEvent,
  DropshipProductMetadataUpdatedEvent,
  DropshipProductClassificationUpdatedEvent,
  DropshipProductTagsUpdatedEvent,
  DropshipProductCollectionsUpdatedEvent,
  DropshipProductVariantOptionsUpdatedEvent,
  DropshipProductTaxDetailsUpdatedEvent,
  DropshipProductDefaultVariantSetEvent,
  DropshipProductSafetyBufferUpdatedEvent,
  DropshipProductFulfillmentSettingsUpdatedEvent,
  type DropshipProductState,
} from '../../../../../src/api/domain/dropshipProduct/events'
import {
  DigitalDownloadableProductCreatedEvent,
  type DigitalDownloadableProductState,
} from '../../../../../src/api/domain/digitalDownloadableProduct/events'
import type { UnitOfWorkRepositories } from '../../../../../src/api/infrastructure/unitOfWork'

function createMockDropshipProductState(overrides: Partial<DropshipProductState> = {}): DropshipProductState {
  return {
    productType: 'dropship',
    name: 'Test Product',
    description: 'Test description',
    slug: 'test-product',
    collections: ['collection-1'],
    variantPositionsAggregateId: 'variant-positions-123',
    defaultVariantId: null,
    richDescriptionUrl: '',
    vendor: 'Test Vendor',
    variantOptions: [],
    metaTitle: 'Test Meta Title',
    metaDescription: 'Test Meta Description',
    tags: ['tag1', 'tag2'],
    taxable: true,
    taxId: '',
    dropshipSafetyBuffer: 5,
    fulfillmentProviderId: null,
    supplierCost: null,
    supplierSku: null,
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: null,
    dropSchedule: null,
    ...overrides,
  }
}

function createMockDigitalProductState(overrides: Partial<DigitalDownloadableProductState> = {}): DigitalDownloadableProductState {
  return {
    productType: 'digital_downloadable',
    name: 'Test Digital Product',
    description: 'Test description',
    slug: 'test-digital-product',
    collections: ['collection-1'],
    variantPositionsAggregateId: 'variant-positions-123',
    defaultVariantId: null,
    richDescriptionUrl: '',
    vendor: 'Test Vendor',
    variantOptions: [],
    metaTitle: 'Test Meta Title',
    metaDescription: 'Test Meta Description',
    tags: ['tag1', 'tag2'],
    taxable: true,
    taxId: '',
    maxDownloads: null,
    accessDurationDays: null,
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: null,
    dropSchedule: null,
    ...overrides,
  }
}

type SavedState = DropshipProductState | DigitalDownloadableProductState

function createMockRepositories(): { repositories: UnitOfWorkRepositories; savedStates: SavedState[] } {
  const savedStates: SavedState[] = []

  const mockProductsReadModelRepository = {
    save: (state: SavedState) => {
      savedStates.push(state)
    },
  }

  const repositories = {
    productsReadModelRepository: mockProductsReadModelRepository,
  } as unknown as UnitOfWorkRepositories

  return { repositories, savedStates }
}

describe('ProductsProjector', () => {
  // Dropship product events
  test('should handle dropship_product.created event', async () => {
    const { repositories, savedStates } = createMockRepositories()
    const projector = new ProductsProjector(repositories)
    const newState = createMockDropshipProductState({ name: 'New Product' })
    const event = new DropshipProductCreatedEvent({
      occurredAt: new Date(),
      aggregateId: 'product-123',
      correlationId: 'correlation-123',
      version: 0,
      userId: 'user-123',
      priorState: createMockDropshipProductState(),
      newState,
    })

    await projector.execute(event)

    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.name).toBe('New Product')
    expect((savedStates[0] as any)?.id).toBe('product-123')
    expect((savedStates[0] as any)?.correlationId).toBe('correlation-123')
    expect((savedStates[0] as any)?.version).toBe(0)
  })

  test('should handle dropship_product.archived event', async () => {
    const { repositories, savedStates } = createMockRepositories()
    const projector = new ProductsProjector(repositories)
    const newState = createMockDropshipProductState({ status: 'archived' })
    const event = new DropshipProductArchivedEvent({
      occurredAt: new Date(),
      aggregateId: 'product-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockDropshipProductState({ status: 'draft' }),
      newState,
    })

    await projector.execute(event)

    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.status).toBe('archived')
  })

  test('should handle dropship_product.published event', async () => {
    const { repositories, savedStates } = createMockRepositories()
    const projector = new ProductsProjector(repositories)
    const publishedAt = new Date()
    const newState = createMockDropshipProductState({ status: 'active', publishedAt })
    const event = new DropshipProductPublishedEvent({
      occurredAt: new Date(),
      aggregateId: 'product-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockDropshipProductState({ status: 'draft' }),
      newState,
    })

    await projector.execute(event)

    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.status).toBe('active')
    expect(savedStates[0]?.publishedAt).toBe(publishedAt)
  })

  test('should handle dropship_product.unpublished event', async () => {
    const { repositories, savedStates } = createMockRepositories()
    const projector = new ProductsProjector(repositories)
    const newState = createMockDropshipProductState({ status: 'draft', publishedAt: null })
    const event = new DropshipProductUnpublishedEvent({
      occurredAt: new Date(),
      aggregateId: 'product-123',
      correlationId: 'correlation-123',
      version: 2,
      userId: 'user-123',
      priorState: createMockDropshipProductState({ status: 'active', publishedAt: new Date() }),
      newState,
    })

    await projector.execute(event)

    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.status).toBe('draft')
    expect(savedStates[0]?.publishedAt).toBeNull()
  })

  test('should handle dropship_product.slug_changed event', async () => {
    const { repositories, savedStates } = createMockRepositories()
    const projector = new ProductsProjector(repositories)
    const newState = createMockDropshipProductState({ slug: 'new-product-slug' })
    const event = new DropshipProductSlugChangedEvent({
      occurredAt: new Date(),
      aggregateId: 'product-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockDropshipProductState({ slug: 'old-slug' }),
      newState,
    })

    await projector.execute(event)

    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.slug).toBe('new-product-slug')
  })

  test('should handle dropship_product.details_updated event', async () => {
    const { repositories, savedStates } = createMockRepositories()
    const projector = new ProductsProjector(repositories)
    const newState = createMockDropshipProductState({ name: 'Updated Name', description: 'Updated desc' })
    const event = new DropshipProductDetailsUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: 'product-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockDropshipProductState(),
      newState,
    })

    await projector.execute(event)

    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.name).toBe('Updated Name')
    expect(savedStates[0]?.description).toBe('Updated desc')
  })

  test('should handle dropship_product.metadata_updated event', async () => {
    const { repositories, savedStates } = createMockRepositories()
    const projector = new ProductsProjector(repositories)
    const newState = createMockDropshipProductState({
      metaTitle: 'New SEO Title',
      metaDescription: 'New SEO Description',
    })
    const event = new DropshipProductMetadataUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: 'product-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockDropshipProductState(),
      newState,
    })

    await projector.execute(event)

    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.metaTitle).toBe('New SEO Title')
    expect(savedStates[0]?.metaDescription).toBe('New SEO Description')
  })

  test('should handle dropship_product.classification_updated event', async () => {
    const { repositories, savedStates } = createMockRepositories()
    const projector = new ProductsProjector(repositories)
    const newState = createMockDropshipProductState({ vendor: 'New Vendor' })
    const event = new DropshipProductClassificationUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: 'product-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockDropshipProductState(),
      newState,
    })

    await projector.execute(event)

    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.vendor).toBe('New Vendor')
  })

  test('should handle dropship_product.tags_updated event', async () => {
    const { repositories, savedStates } = createMockRepositories()
    const projector = new ProductsProjector(repositories)
    const newState = createMockDropshipProductState({ tags: ['new-tag1', 'new-tag2'] })
    const event = new DropshipProductTagsUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: 'product-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockDropshipProductState(),
      newState,
    })

    await projector.execute(event)

    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.tags).toEqual(['new-tag1', 'new-tag2'])
  })

  test('should handle dropship_product.collections_updated event', async () => {
    const { repositories, savedStates } = createMockRepositories()
    const projector = new ProductsProjector(repositories)
    const newState = createMockDropshipProductState({ collections: ['collection-2', 'collection-3'] })
    const event = new DropshipProductCollectionsUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: 'product-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockDropshipProductState(),
      newState,
    })

    await projector.execute(event)

    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.collections).toEqual(['collection-2', 'collection-3'])
  })

  test('should handle dropship_product.variant_options_updated event', async () => {
    const { repositories, savedStates } = createMockRepositories()
    const projector = new ProductsProjector(repositories)
    const newOptions = [{ name: 'Size', values: ['S', 'M', 'L'] }]
    const newState = createMockDropshipProductState({ variantOptions: newOptions })
    const event = new DropshipProductVariantOptionsUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: 'product-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockDropshipProductState(),
      newState,
    })

    await projector.execute(event)

    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.variantOptions).toEqual(newOptions)
  })

  test('should handle dropship_product.tax_details_updated event', async () => {
    const { repositories, savedStates } = createMockRepositories()
    const projector = new ProductsProjector(repositories)
    const newState = createMockDropshipProductState({ taxable: false, taxId: 'tax-123' })
    const event = new DropshipProductTaxDetailsUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: 'product-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockDropshipProductState(),
      newState,
    })

    await projector.execute(event)

    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.taxable).toBe(false)
    expect(savedStates[0]?.taxId).toBe('tax-123')
  })

  test('should handle dropship_product.default_variant_set event', async () => {
    const { repositories, savedStates } = createMockRepositories()
    const projector = new ProductsProjector(repositories)
    const newState = createMockDropshipProductState({ defaultVariantId: 'variant-123' })
    const event = new DropshipProductDefaultVariantSetEvent({
      occurredAt: new Date(),
      aggregateId: 'product-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockDropshipProductState(),
      newState,
    })

    await projector.execute(event)

    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.defaultVariantId).toBe('variant-123')
  })

  test('should handle dropship_product.safety_buffer_updated event', async () => {
    const { repositories, savedStates } = createMockRepositories()
    const projector = new ProductsProjector(repositories)
    const newState = createMockDropshipProductState({ dropshipSafetyBuffer: 10 })
    const event = new DropshipProductSafetyBufferUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: 'product-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockDropshipProductState({ dropshipSafetyBuffer: 5 }),
      newState,
    })

    await projector.execute(event)

    expect(savedStates).toHaveLength(1)
    expect((savedStates[0] as DropshipProductState)?.dropshipSafetyBuffer).toBe(10)
  })

  test('should handle dropship_product.fulfillment_settings_updated event', async () => {
    const { repositories, savedStates } = createMockRepositories()
    const projector = new ProductsProjector(repositories)
    const newState = createMockDropshipProductState({
      fulfillmentProviderId: 'provider-123',
      supplierCost: 50.00,
      supplierSku: 'SUPPLIER-SKU-001',
    })
    const event = new DropshipProductFulfillmentSettingsUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: 'product-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockDropshipProductState(),
      newState,
    })

    await projector.execute(event)

    expect(savedStates).toHaveLength(1)
    expect((savedStates[0] as DropshipProductState)?.fulfillmentProviderId).toBe('provider-123')
  })

  // Digital downloadable product events
  test('should handle digital_downloadable_product.created event', async () => {
    const { repositories, savedStates } = createMockRepositories()
    const projector = new ProductsProjector(repositories)
    const newState = createMockDigitalProductState({ name: 'New Digital Product' })
    const event = new DigitalDownloadableProductCreatedEvent({
      occurredAt: new Date(),
      aggregateId: 'product-456',
      correlationId: 'correlation-456',
      version: 0,
      userId: 'user-123',
      priorState: createMockDigitalProductState(),
      newState,
    })

    await projector.execute(event)

    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.name).toBe('New Digital Product')
    expect((savedStates[0] as any)?.id).toBe('product-456')
    expect(savedStates[0]?.productType).toBe('digital_downloadable')
  })

  test('should ignore unhandled events', async () => {
    const { repositories, savedStates } = createMockRepositories()
    const projector = new ProductsProjector(repositories)

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
