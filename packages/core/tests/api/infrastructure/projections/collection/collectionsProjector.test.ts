import { describe, test, expect } from 'bun:test'
import { CollectionsProjector } from '../../../../../src/api/infrastructure/projections/collection/collectionsProjector'
import {
  CollectionCreatedEvent,
  CollectionArchivedEvent,
  CollectionMetadataUpdatedEvent,
  CollectionPublishedEvent,
  CollectionSeoMetadataUpdatedEvent,
  CollectionUnpublishedEvent,
  CollectionImagesUpdatedEvent,
  type CollectionState,
} from '../../../../../src/api/domain/collection/events'
import { ImageCollection } from '../../../../../src/api/domain/_base/imageCollection'
import type { UnitOfWorkRepositories } from '../../../../../src/api/infrastructure/unitOfWork'

function createMockCollectionState(overrides: Partial<CollectionState> = {}): CollectionState {
  return {
    id: 'collection-123',
    correlationId: 'correlation-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    name: 'Test Collection',
    description: 'Test description',
    slug: 'test-collection',
    version: 0,
    status: 'draft',
    metaTitle: 'Test Meta Title',
    metaDescription: 'Test Meta Description',
    publishedAt: null,
    images: ImageCollection.empty(),
    ...overrides,
  }
}

function createMockRepositories(): { repositories: UnitOfWorkRepositories; savedStates: CollectionState[] } {
  const savedStates: CollectionState[] = []

  const mockCollectionsReadModelRepository = {
    save: (state: CollectionState) => {
      savedStates.push(state)
    },
  }

  const repositories = {
    collectionsReadModelRepository: mockCollectionsReadModelRepository,
  } as unknown as UnitOfWorkRepositories

  return { repositories, savedStates }
}

describe('CollectionsProjector', () => {
  test('should handle collection.created event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new CollectionsProjector(repositories)
    const newState = createMockCollectionState({ name: 'New Collection' })
    const event = new CollectionCreatedEvent({
      occurredAt: new Date(),
      aggregateId: 'collection-123',
      correlationId: 'correlation-123',
      version: 0,
      userId: 'user-123',
      priorState: createMockCollectionState(),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.name).toBe('New Collection')
  })

  test('should handle collection.archived event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new CollectionsProjector(repositories)
    const newState = createMockCollectionState({ status: 'archived' })
    const event = new CollectionArchivedEvent({
      occurredAt: new Date(),
      aggregateId: 'collection-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockCollectionState({ status: 'draft' }),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.status).toBe('archived')
  })

  test('should handle collection.metadata_updated event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new CollectionsProjector(repositories)
    const newState = createMockCollectionState({ name: 'Updated Name', description: 'Updated desc' })
    const event = new CollectionMetadataUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: 'collection-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockCollectionState(),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.name).toBe('Updated Name')
    expect(savedStates[0]?.description).toBe('Updated desc')
  })

  test('should handle collection.published event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new CollectionsProjector(repositories)
    const publishedAt = new Date()
    const newState = createMockCollectionState({ status: 'active', publishedAt })
    const event = new CollectionPublishedEvent({
      occurredAt: new Date(),
      aggregateId: 'collection-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockCollectionState({ status: 'draft' }),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.status).toBe('active')
    expect(savedStates[0]?.publishedAt).toBe(publishedAt)
  })

  test('should handle collection.seo_metadata_updated event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new CollectionsProjector(repositories)
    const newState = createMockCollectionState({
      metaTitle: 'New SEO Title',
      metaDescription: 'New SEO Description',
    })
    const event = new CollectionSeoMetadataUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: 'collection-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockCollectionState(),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.metaTitle).toBe('New SEO Title')
    expect(savedStates[0]?.metaDescription).toBe('New SEO Description')
  })

  test('should handle collection.unpublished event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new CollectionsProjector(repositories)
    const newState = createMockCollectionState({ status: 'draft', publishedAt: null })
    const event = new CollectionUnpublishedEvent({
      occurredAt: new Date(),
      aggregateId: 'collection-123',
      correlationId: 'correlation-123',
      version: 2,
      userId: 'user-123',
      priorState: createMockCollectionState({ status: 'active', publishedAt: new Date() }),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.status).toBe('draft')
    expect(savedStates[0]?.publishedAt).toBeNull()
  })

  test('should handle collection.images_updated event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new CollectionsProjector(repositories)
    const newState = createMockCollectionState({ name: 'Collection with Images' })
    const event = new CollectionImagesUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: 'collection-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockCollectionState(),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.name).toBe('Collection with Images')
  })

  test('should ignore unhandled events', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new CollectionsProjector(repositories)

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
