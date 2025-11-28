import { describe, test, expect } from 'bun:test'
import { VariantsProjector } from '../../../../../src/api/infrastructure/projections/variant/variantsProjector'
import {
  VariantCreatedEvent,
  VariantArchivedEvent,
  VariantDetailsUpdatedEvent,
  VariantPriceUpdatedEvent,
  VariantInventoryUpdatedEvent,
  VariantSkuUpdatedEvent,
  VariantPublishedEvent,
  VariantImagesUpdatedEvent,
  VariantDigitalAssetAttachedEvent,
  VariantDigitalAssetDetachedEvent,
  type VariantState,
} from '../../../../../src/api/domain/variant/events'
import { ImageCollection } from '../../../../../src/api/domain/_base/imageCollection'
import type { UnitOfWorkRepositories } from '../../../../../src/api/infrastructure/unitOfWork'

function createMockVariantState(overrides: Partial<VariantState> = {}): VariantState {
  return {
    productId: 'product-123',
    sku: 'SKU-001',
    price: 29.99,
    inventory: 100,
    options: { size: 'M', color: 'Blue' },
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: null,
    images: ImageCollection.empty(),
    digitalAsset: null,
    ...overrides,
  }
}

function createMockRepositories(): { repositories: UnitOfWorkRepositories; savedStates: VariantState[] } {
  const savedStates: VariantState[] = []

  const mockVariantsReadModelRepository = {
    save: (state: VariantState) => {
      savedStates.push(state)
    },
  }

  const repositories = {
    variantsReadModelRepository: mockVariantsReadModelRepository,
  } as unknown as UnitOfWorkRepositories

  return { repositories, savedStates }
}

describe('VariantsProjector', () => {
  test('should handle variant.created event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new VariantsProjector(repositories)
    const newState = createMockVariantState({ sku: 'NEW-SKU' })
    const event = new VariantCreatedEvent({
      occurredAt: new Date(),
      aggregateId: 'variant-123',
      correlationId: 'correlation-123',
      version: 0,
      userId: 'user-123',
      priorState: createMockVariantState(),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.sku).toBe('NEW-SKU')
    expect(savedStates[0]?.id).toBe('variant-123')
    expect(savedStates[0]?.correlationId).toBe('correlation-123')
    expect(savedStates[0]?.version).toBe(0)
  })

  test('should handle variant.archived event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new VariantsProjector(repositories)
    const newState = createMockVariantState({ status: 'archived' })
    const event = new VariantArchivedEvent({
      occurredAt: new Date(),
      aggregateId: 'variant-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockVariantState({ status: 'draft' }),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.status).toBe('archived')
  })

  test('should handle variant.details_updated event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new VariantsProjector(repositories)
    const newOptions = { size: 'L', color: 'Red' }
    const newState = createMockVariantState({ options: newOptions })
    const event = new VariantDetailsUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: 'variant-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockVariantState(),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.options).toEqual(newOptions)
  })

  test('should handle variant.price_updated event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new VariantsProjector(repositories)
    const newState = createMockVariantState({ price: 49.99 })
    const event = new VariantPriceUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: 'variant-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockVariantState({ price: 29.99 }),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.price).toBe(49.99)
  })

  test('should handle variant.inventory_updated event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new VariantsProjector(repositories)
    const newState = createMockVariantState({ inventory: 50 })
    const event = new VariantInventoryUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: 'variant-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockVariantState({ inventory: 100 }),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.inventory).toBe(50)
  })

  test('should handle variant.sku_updated event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new VariantsProjector(repositories)
    const newState = createMockVariantState({ sku: 'UPDATED-SKU' })
    const event = new VariantSkuUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: 'variant-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockVariantState({ sku: 'OLD-SKU' }),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.sku).toBe('UPDATED-SKU')
  })

  test('should handle variant.published event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new VariantsProjector(repositories)
    const publishedAt = new Date()
    const newState = createMockVariantState({ status: 'active', publishedAt })
    const event = new VariantPublishedEvent({
      occurredAt: new Date(),
      aggregateId: 'variant-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockVariantState({ status: 'draft' }),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.status).toBe('active')
    expect(savedStates[0]?.publishedAt).toBe(publishedAt)
  })

  test('should handle variant.images_updated event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new VariantsProjector(repositories)
    const newImages = ImageCollection.empty()
    const newState = createMockVariantState({ images: newImages })
    const event = new VariantImagesUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: 'variant-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockVariantState(),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.images).toBe(newImages)
  })

  test('should handle variant.digital_asset_attached event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new VariantsProjector(repositories)
    const digitalAsset = {
      name: 'test-file.pdf',
      fileKey: 'files/test-file.pdf',
      mimeType: 'application/pdf',
      size: 1024,
    }
    const newState = createMockVariantState({ digitalAsset })
    const event = new VariantDigitalAssetAttachedEvent({
      occurredAt: new Date(),
      aggregateId: 'variant-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockVariantState(),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.digitalAsset).toEqual(digitalAsset)
  })

  test('should handle variant.digital_asset_detached event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new VariantsProjector(repositories)
    const newState = createMockVariantState({ digitalAsset: null })
    const event = new VariantDigitalAssetDetachedEvent({
      occurredAt: new Date(),
      aggregateId: 'variant-123',
      correlationId: 'correlation-123',
      version: 2,
      userId: 'user-123',
      priorState: createMockVariantState({
        digitalAsset: {
          name: 'test-file.pdf',
          fileKey: 'files/test-file.pdf',
          mimeType: 'application/pdf',
          size: 1024,
        },
      }),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.digitalAsset).toBeNull()
  })

  test('should ignore unhandled events', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new VariantsProjector(repositories)

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
