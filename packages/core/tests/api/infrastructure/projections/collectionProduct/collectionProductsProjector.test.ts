import { describe, test, expect } from 'bun:test'
import { CollectionProductsProjector } from '../../../../../src/api/infrastructure/projections/collectionProduct/collectionProductsProjector'
import {
  ProductPositionsWithinCollectionCreatedEvent,
  ProductPositionsWithinCollectionReorderedEvent,
  ProductPositionsWithinCollectionProductAddedEvent,
  ProductPositionsWithinCollectionProductRemovedEvent,
  ProductPositionsWithinCollectionArchivedEvent,
  type ProductPositionsWithinCollectionState,
} from '../../../../../src/api/domain/productPositionsWithinCollection/events'
import {
  DropshipProductCreatedEvent,
  DropshipProductCollectionsUpdatedEvent,
  type DropshipProductState,
} from '../../../../../src/api/domain/dropshipProduct/events'
import type { UnitOfWorkRepositories } from '../../../../../src/api/infrastructure/unitOfWork'

function createMockProductPositionsState(overrides: Partial<ProductPositionsWithinCollectionState> = {}): ProductPositionsWithinCollectionState {
  return {
    collectionId: 'collection-123',
    productIds: ['product-1', 'product-2'],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

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
    ...overrides,
  }
}

type UpdatedPosition = { collectionId: string; positions: Array<{ productId: string; position: number }> }
type SavedFromProductState = { productId: string; state: DropshipProductState & { correlationId: string; version: number } }
type DeletedEntry = { collectionId: string; productId: string }

function createMockRepositories(): {
  repositories: UnitOfWorkRepositories
  updatedPositions: UpdatedPosition[]
  savedFromProductStates: SavedFromProductState[]
  deletedEntries: DeletedEntry[]
} {
  const updatedPositions: UpdatedPosition[] = []
  const savedFromProductStates: SavedFromProductState[] = []
  const deletedEntries: DeletedEntry[] = []

  const mockCollectionProductsReadModelRepository = {
    updatePositions: (collectionId: string, positions: Array<{ productId: string; position: number }>) => {
      updatedPositions.push({ collectionId, positions })
    },
    saveFromProductState: (productId: string, state: DropshipProductState & { correlationId: string; version: number }) => {
      savedFromProductStates.push({ productId, state })
    },
    delete: (collectionId: string, productId: string) => {
      deletedEntries.push({ collectionId, productId })
    },
  }

  const repositories = {
    collectionProductsReadModelRepository: mockCollectionProductsReadModelRepository,
  } as unknown as UnitOfWorkRepositories

  return { repositories, updatedPositions, savedFromProductStates, deletedEntries }
}

describe('CollectionProductsProjector', () => {
  describe('handlePositionsChange', () => {
    test('should handle productPositionsWithinCollection.created event', async () => {
      const { repositories, updatedPositions } = createMockRepositories()
      const projector = new CollectionProductsProjector(repositories)
      const newState = createMockProductPositionsState({
        collectionId: 'collection-abc',
        productIds: ['product-1', 'product-2', 'product-3'],
      })
      const event = new ProductPositionsWithinCollectionCreatedEvent({
        occurredAt: new Date(),
        aggregateId: 'positions-123',
        correlationId: 'correlation-123',
        version: 0,
        userId: 'user-123',
        priorState: {} as ProductPositionsWithinCollectionState,
        newState,
      })

      await projector.execute(event)

      expect(updatedPositions).toHaveLength(1)
      expect(updatedPositions[0]!.collectionId).toBe('collection-abc')
      expect(updatedPositions[0]!.positions).toEqual([
        { productId: 'product-1', position: 0 },
        { productId: 'product-2', position: 1 },
        { productId: 'product-3', position: 2 },
      ])
    })

    test('should handle productPositionsWithinCollection.reordered event', async () => {
      const { repositories, updatedPositions } = createMockRepositories()
      const projector = new CollectionProductsProjector(repositories)
      const newState = createMockProductPositionsState({
        collectionId: 'collection-xyz',
        productIds: ['product-3', 'product-1', 'product-2'],
      })
      const event = new ProductPositionsWithinCollectionReorderedEvent({
        occurredAt: new Date(),
        aggregateId: 'positions-123',
        correlationId: 'correlation-123',
        version: 1,
        userId: 'user-123',
        priorState: createMockProductPositionsState({
          productIds: ['product-1', 'product-2', 'product-3'],
        }),
        newState,
      })

      await projector.execute(event)

      expect(updatedPositions).toHaveLength(1)
      expect(updatedPositions[0]!.collectionId).toBe('collection-xyz')
      expect(updatedPositions[0]!.positions).toEqual([
        { productId: 'product-3', position: 0 },
        { productId: 'product-1', position: 1 },
        { productId: 'product-2', position: 2 },
      ])
    })

    test('should handle productPositionsWithinCollection.product_added event', async () => {
      const { repositories, updatedPositions } = createMockRepositories()
      const projector = new CollectionProductsProjector(repositories)
      const newState = createMockProductPositionsState({
        collectionId: 'collection-add',
        productIds: ['product-1', 'product-new', 'product-2'],
      })
      const event = new ProductPositionsWithinCollectionProductAddedEvent({
        occurredAt: new Date(),
        aggregateId: 'positions-123',
        correlationId: 'correlation-123',
        version: 1,
        userId: 'user-123',
        priorState: createMockProductPositionsState({
          productIds: ['product-1', 'product-2'],
        }),
        newState,
      })

      await projector.execute(event)

      expect(updatedPositions).toHaveLength(1)
      expect(updatedPositions[0]!.positions).toHaveLength(3)
    })

    test('should handle productPositionsWithinCollection.product_removed event', async () => {
      const { repositories, updatedPositions } = createMockRepositories()
      const projector = new CollectionProductsProjector(repositories)
      const newState = createMockProductPositionsState({
        collectionId: 'collection-remove',
        productIds: ['product-1'],
      })
      const event = new ProductPositionsWithinCollectionProductRemovedEvent({
        occurredAt: new Date(),
        aggregateId: 'positions-123',
        correlationId: 'correlation-123',
        version: 1,
        userId: 'user-123',
        priorState: createMockProductPositionsState({
          productIds: ['product-1', 'product-2'],
        }),
        newState,
      })

      await projector.execute(event)

      expect(updatedPositions).toHaveLength(1)
      expect(updatedPositions[0]!.positions).toEqual([
        { productId: 'product-1', position: 0 },
      ])
    })

    test('should handle productPositionsWithinCollection.archived event', async () => {
      const { repositories, updatedPositions } = createMockRepositories()
      const projector = new CollectionProductsProjector(repositories)
      const newState = createMockProductPositionsState({
        collectionId: 'collection-archived',
        productIds: [],
      })
      const event = new ProductPositionsWithinCollectionArchivedEvent({
        occurredAt: new Date(),
        aggregateId: 'positions-123',
        correlationId: 'correlation-123',
        version: 1,
        userId: 'user-123',
        priorState: createMockProductPositionsState({
          productIds: ['product-1', 'product-2'],
        }),
        newState,
      })

      await projector.execute(event)

      expect(updatedPositions).toHaveLength(1)
      expect(updatedPositions[0]!.positions).toEqual([])
    })
  })

  describe('handleProductChange', () => {
    test('should handle dropship_product.created event', async () => {
      const { repositories, savedFromProductStates } = createMockRepositories()
      const projector = new CollectionProductsProjector(repositories)
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

      expect(savedFromProductStates).toHaveLength(1)
      expect(savedFromProductStates[0]!.productId).toBe('product-123')
      expect(savedFromProductStates[0]!.state.name).toBe('New Product')
    })
  })

  describe('handleCollectionsUpdated', () => {
    test('should delete entries for removed collections and save for new ones', async () => {
      const { repositories, savedFromProductStates, deletedEntries } = createMockRepositories()
      const projector = new CollectionProductsProjector(repositories)
      const newState = createMockDropshipProductState({
        collections: ['collection-2', 'collection-3'],
      })
      const event = new DropshipProductCollectionsUpdatedEvent({
        occurredAt: new Date(),
        aggregateId: 'product-123',
        correlationId: 'correlation-123',
        version: 1,
        userId: 'user-123',
        priorState: createMockDropshipProductState({
          collections: ['collection-1', 'collection-2'],
        }),
        newState,
      })

      await projector.execute(event)

      // Should delete collection-1 (removed)
      expect(deletedEntries).toHaveLength(1)
      expect(deletedEntries[0]!.collectionId).toBe('collection-1')
      expect(deletedEntries[0]!.productId).toBe('product-123')

      // Should save for current collections
      expect(savedFromProductStates).toHaveLength(1)
    })
  })
})
