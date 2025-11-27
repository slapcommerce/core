import { describe, test, expect } from 'bun:test'
import { CollectionSlugRedirectProjector } from '../../../../../src/api/infrastructure/projections/collection/collectionSlugRedirectProjector'
import {
  CollectionMetadataUpdatedEvent,
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

interface SlugRedirectEntry {
  oldSlug: string
  newSlug: string
  aggregateId: string
  aggregateType: string
  createdAt: Date
}

function createMockRepositories(): { repositories: UnitOfWorkRepositories; savedRedirects: SlugRedirectEntry[] } {
  const savedRedirects: SlugRedirectEntry[] = []

  const mockSlugRedirectReadModelRepository = {
    save: (entry: SlugRedirectEntry) => {
      savedRedirects.push(entry)
    },
  }

  const repositories = {
    slugRedirectReadModelRepository: mockSlugRedirectReadModelRepository,
  } as unknown as UnitOfWorkRepositories

  return { repositories, savedRedirects }
}

describe('CollectionSlugRedirectProjector', () => {
  test('should create redirect when slug changes', async () => {
    // Arrange
    const { repositories, savedRedirects } = createMockRepositories()
    const projector = new CollectionSlugRedirectProjector(repositories)
    const occurredAt = new Date()
    const event = new CollectionMetadataUpdatedEvent({
      occurredAt,
      aggregateId: 'collection-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockCollectionState({ slug: 'old-slug' }),
      newState: createMockCollectionState({ slug: 'new-slug' }),
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedRedirects).toHaveLength(1)
    expect(savedRedirects[0]?.oldSlug).toBe('old-slug')
    expect(savedRedirects[0]?.newSlug).toBe('new-slug')
    expect(savedRedirects[0]?.aggregateId).toBe('collection-123')
    expect(savedRedirects[0]?.aggregateType).toBe('collection')
    expect(savedRedirects[0]?.createdAt).toBe(occurredAt)
  })

  test('should not create redirect when slug stays the same', async () => {
    // Arrange
    const { repositories, savedRedirects } = createMockRepositories()
    const projector = new CollectionSlugRedirectProjector(repositories)
    const event = new CollectionMetadataUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: 'collection-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockCollectionState({ slug: 'same-slug', name: 'Old Name' }),
      newState: createMockCollectionState({ slug: 'same-slug', name: 'New Name' }),
    })

    // Act
    await projector.execute(event)

    // Assert - no redirect should be created
    expect(savedRedirects).toHaveLength(0)
  })

  test('should ignore non-metadata_updated events', async () => {
    // Arrange
    const { repositories, savedRedirects } = createMockRepositories()
    const projector = new CollectionSlugRedirectProjector(repositories)

    // Create an event with a different type
    const unknownEvent = {
      eventName: 'collection.created',
      aggregateId: 'collection-123',
      correlationId: 'correlation-123',
      version: 0,
      userId: 'user-123',
      occurredAt: new Date(),
      payload: {
        priorState: createMockCollectionState({ slug: 'old' }),
        newState: createMockCollectionState({ slug: 'new' }),
      },
    }

    // Act
    await projector.execute(unknownEvent as any)

    // Assert - should not create redirect for non-handled events
    expect(savedRedirects).toHaveLength(0)
  })

})
