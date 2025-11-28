import { describe, test, expect } from 'bun:test'
import { ProductsProjector } from '../../../../../src/api/infrastructure/projections/product/productsProjector'
import {
  ProductCreatedEvent,
  ProductArchivedEvent,
  ProductPublishedEvent,
  ProductUnpublishedEvent,
  ProductSlugChangedEvent,
  ProductDetailsUpdatedEvent,
  ProductMetadataUpdatedEvent,
  ProductClassificationUpdatedEvent,
  ProductTagsUpdatedEvent,
  ProductCollectionsUpdatedEvent,
  ProductFulfillmentTypeUpdatedEvent,
  variantsOptionsUpdatedEvent,
  ProductUpdateProductTaxDetailsEvent,
  type ProductState,
} from '../../../../../src/api/domain/product/events'
import type { UnitOfWorkRepositories } from '../../../../../src/api/infrastructure/unitOfWork'

function createMockProductState(overrides: Partial<ProductState> = {}): ProductState {
  return {
    name: 'Test Product',
    description: 'Test description',
    slug: 'test-product',
    collections: ['collection-1'],
    variantPositionsAggregateId: 'variant-positions-123',
    defaultVariantId: null,
    richDescriptionUrl: '',
    fulfillmentType: 'digital',
    vendor: 'Test Vendor',
    variantOptions: [],
    metaTitle: 'Test Meta Title',
    metaDescription: 'Test Meta Description',
    tags: ['tag1', 'tag2'],
    taxable: true,
    taxId: '',
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: null,
    ...overrides,
  }
}

function createMockRepositories(): { repositories: UnitOfWorkRepositories; savedStates: ProductState[] } {
  const savedStates: ProductState[] = []

  const mockProductsReadModelRepository = {
    save: (state: ProductState) => {
      savedStates.push(state)
    },
  }

  const repositories = {
    productsReadModelRepository: mockProductsReadModelRepository,
  } as unknown as UnitOfWorkRepositories

  return { repositories, savedStates }
}

describe('ProductsProjector', () => {
  test('should handle product.created event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new ProductsProjector(repositories)
    const newState = createMockProductState({ name: 'New Product' })
    const event = new ProductCreatedEvent({
      occurredAt: new Date(),
      aggregateId: 'product-123',
      correlationId: 'correlation-123',
      version: 0,
      userId: 'user-123',
      priorState: createMockProductState(),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.name).toBe('New Product')
    expect(savedStates[0]?.id).toBe('product-123')
    expect(savedStates[0]?.correlationId).toBe('correlation-123')
    expect(savedStates[0]?.version).toBe(0)
  })

  test('should handle product.archived event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new ProductsProjector(repositories)
    const newState = createMockProductState({ status: 'archived' })
    const event = new ProductArchivedEvent({
      occurredAt: new Date(),
      aggregateId: 'product-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockProductState({ status: 'draft' }),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.status).toBe('archived')
  })

  test('should handle product.published event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new ProductsProjector(repositories)
    const publishedAt = new Date()
    const newState = createMockProductState({ status: 'active', publishedAt })
    const event = new ProductPublishedEvent({
      occurredAt: new Date(),
      aggregateId: 'product-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockProductState({ status: 'draft' }),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.status).toBe('active')
    expect(savedStates[0]?.publishedAt).toBe(publishedAt)
  })

  test('should handle product.unpublished event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new ProductsProjector(repositories)
    const newState = createMockProductState({ status: 'draft', publishedAt: null })
    const event = new ProductUnpublishedEvent({
      occurredAt: new Date(),
      aggregateId: 'product-123',
      correlationId: 'correlation-123',
      version: 2,
      userId: 'user-123',
      priorState: createMockProductState({ status: 'active', publishedAt: new Date() }),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.status).toBe('draft')
    expect(savedStates[0]?.publishedAt).toBeNull()
  })

  test('should handle product.slug_changed event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new ProductsProjector(repositories)
    const newState = createMockProductState({ slug: 'new-product-slug' })
    const event = new ProductSlugChangedEvent({
      occurredAt: new Date(),
      aggregateId: 'product-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockProductState({ slug: 'old-slug' }),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.slug).toBe('new-product-slug')
  })

  test('should handle product.details_updated event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new ProductsProjector(repositories)
    const newState = createMockProductState({ name: 'Updated Name', description: 'Updated desc' })
    const event = new ProductDetailsUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: 'product-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockProductState(),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.name).toBe('Updated Name')
    expect(savedStates[0]?.description).toBe('Updated desc')
  })

  test('should handle product.metadata_updated event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new ProductsProjector(repositories)
    const newState = createMockProductState({
      metaTitle: 'New SEO Title',
      metaDescription: 'New SEO Description',
    })
    const event = new ProductMetadataUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: 'product-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockProductState(),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.metaTitle).toBe('New SEO Title')
    expect(savedStates[0]?.metaDescription).toBe('New SEO Description')
  })

  test('should handle product.classification_updated event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new ProductsProjector(repositories)
    const newState = createMockProductState({ vendor: 'New Vendor' })
    const event = new ProductClassificationUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: 'product-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockProductState(),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.vendor).toBe('New Vendor')
  })

  test('should handle product.tags_updated event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new ProductsProjector(repositories)
    const newState = createMockProductState({ tags: ['new-tag1', 'new-tag2'] })
    const event = new ProductTagsUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: 'product-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockProductState(),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.tags).toEqual(['new-tag1', 'new-tag2'])
  })

  test('should handle product.collections_updated event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new ProductsProjector(repositories)
    const newState = createMockProductState({ collections: ['collection-2', 'collection-3'] })
    const event = new ProductCollectionsUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: 'product-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockProductState(),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.collections).toEqual(['collection-2', 'collection-3'])
  })

  test('should handle product.fulfillment_type_updated event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new ProductsProjector(repositories)
    const newState = createMockProductState({ fulfillmentType: 'dropship', dropshipSafetyBuffer: 5 })
    const event = new ProductFulfillmentTypeUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: 'product-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockProductState(),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.fulfillmentType).toBe('dropship')
    expect(savedStates[0]?.dropshipSafetyBuffer).toBe(5)
  })

  test('should handle product.variant_options_updated event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new ProductsProjector(repositories)
    const newOptions = [{ name: 'Size', values: ['S', 'M', 'L'] }]
    const newState = createMockProductState({ variantOptions: newOptions })
    const event = new variantsOptionsUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: 'product-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockProductState(),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.variantOptions).toEqual(newOptions)
  })

  test('should handle product.update_product_tax_details event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new ProductsProjector(repositories)
    const newState = createMockProductState({ taxable: false, taxId: 'tax-123' })
    const event = new ProductUpdateProductTaxDetailsEvent({
      occurredAt: new Date(),
      aggregateId: 'product-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockProductState(),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.taxable).toBe(false)
    expect(savedStates[0]?.taxId).toBe('tax-123')
  })

  test('should ignore unhandled events', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new ProductsProjector(repositories)

    // Create an event with a type that the projector doesn't handle
    const unknownEvent = {
      eventName: 'unknown.event',
      aggregateId: 'test-123',
      correlationId: 'correlation-123',
      version: 0,
      userId: 'user-123',
      occurredAt: new Date(),
      payload: {},
    }

    // Act
    await projector.execute(unknownEvent as any)

    // Assert - should not throw and should not save anything
    expect(savedStates).toHaveLength(0)
  })
})
