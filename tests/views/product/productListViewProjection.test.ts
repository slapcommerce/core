import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { TransactionBatch } from '../../../src/infrastructure/transactionBatch'
import { productListViewProjection } from '../../../src/views/product/productListViewProjection'
import { ProductCreatedEvent, ProductArchivedEvent, ProductPublishedEvent, ProductDetailsUpdatedEvent, ProductMetadataUpdatedEvent, ProductClassificationUpdatedEvent, ProductTagsUpdatedEvent, ProductShippingSettingsUpdatedEvent, ProductPageLayoutUpdatedEvent, ProductVariantOptionsUpdatedEvent, ProductFulfillmentTypeUpdatedEvent } from '../../../src/domain/product/events'
import { CollectionCreatedEvent, CollectionArchivedEvent, CollectionMetadataUpdatedEvent } from '../../../src/domain/collection/events'
import { CollectionAggregate } from '../../../src/domain/collection/aggregate'
import { ProductAggregate } from '../../../src/domain/product/aggregate'
import { EventRepository } from '../../../src/infrastructure/repositories/eventRepository'
import { SnapshotRepository } from '../../../src/infrastructure/repositories/snapshotRepository'
import { OutboxRepository } from '../../../src/infrastructure/repositories/outboxRepository'
import { SlugRedirectRepository } from '../../../src/infrastructure/repositories/slugRedirectRepository'
import { ProductListViewRepository } from '../../../src/infrastructure/repositories/productListViewRepository'
import { ProductCollectionRepository } from '../../../src/infrastructure/repositories/productCollectionRepository'
import { ProductVariantRepository } from '../../../src/infrastructure/repositories/productVariantRepository'
import { CollectionsListViewRepository } from '../../../src/infrastructure/repositories/collectionsListViewRepository'
import { ScheduleViewRepository } from '../../../src/infrastructure/repositories/scheduleViewRepository'
import { schemas } from '../../../src/infrastructure/schemas'
import { randomUUIDv7 } from 'bun'
import type { UnitOfWorkRepositories } from '../../../src/infrastructure/projectionService'

function createProductState(overrides?: Partial<any>): any {
  return {
    title: 'Test Product',
    shortDescription: 'A test product',
    slug: 'test-product',
    collectionIds: overrides?.collectionIds ?? [randomUUIDv7()],
    variantIds: [randomUUIDv7()],
    richDescriptionUrl: 'https://example.com/description',
    productType: 'physical',
    fulfillmentType: 'digital' as const,
    vendor: 'Test Vendor',
    variantOptions: [{ name: 'Size', values: ['S', 'M', 'L'] }],
    metaTitle: 'Test Product Meta Title',
    metaDescription: 'Test Product Meta Description',
    tags: ['test', 'product'],
    requiresShipping: true,
    taxable: true,
    pageLayoutId: null,
    status: overrides?.status ?? 'draft',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    publishedAt: null,
    ...overrides,
  }
}

function createCollectionState(overrides?: Partial<any>): any {
  return {
    name: 'Test Collection',
    description: 'A test collection',
    slug: 'test-collection',
    status: 'active' as const,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

function createRepositories(db: Database, batch: TransactionBatch): UnitOfWorkRepositories {
  return {
    eventRepository: new EventRepository(db, batch),
    snapshotRepository: new SnapshotRepository(db, batch),
    outboxRepository: new OutboxRepository(db, batch),
    productListViewRepository: new ProductListViewRepository(db, batch),
    productCollectionRepository: new ProductCollectionRepository(db, batch),
    productVariantRepository: new ProductVariantRepository(db, batch),
    slugRedirectRepository: new SlugRedirectRepository(db, batch),
    collectionsListViewRepository: new CollectionsListViewRepository(db, batch),
    scheduleViewRepository: new ScheduleViewRepository(db, batch),
  }
}

async function flushBatch(db: Database, batch: TransactionBatch): Promise<void> {
  try {
    db.run('BEGIN TRANSACTION')
    for (const command of batch.commands) {
      command.statement.run(...command.params)
    }
    db.run('COMMIT')
    batch.resolve()
  } catch (error) {
    try {
      db.run('ROLLBACK')
    } catch {
      // Ignore rollback errors
    }
    batch.reject(error instanceof Error ? error : new Error(String(error)))
    throw error
  }
}

function saveCollectionSnapshot(
  db: Database,
  collectionId: string,
  correlationId: string,
  state: any,
  version: number = 0
) {
  const collectionAggregate = CollectionAggregate.create({
    id: collectionId,
    correlationId,
    userId: 'user-123',
    name: state.name,
    description: state.description,
    slug: state.slug,
  })
  // Apply state if needed
  if (state.status === 'archived') {
    collectionAggregate.archive('user-123')
  }
  if (state.name !== 'Test Collection' || state.slug !== 'test-collection') {
    collectionAggregate.updateMetadata(state.name, state.description, state.slug, 'user-123')
  }

  const snapshot = collectionAggregate.toSnapshot()
  db.run(
    `INSERT OR REPLACE INTO snapshots (aggregate_id, correlation_id, version, payload)
     VALUES (?, ?, ?, ?)`,
    [collectionId, correlationId, version, JSON.stringify(snapshot)]
  )
}

function saveProductSnapshot(
  db: Database,
  productId: string,
  correlationId: string,
  state: any,
  version: number = 0
) {
  const productAggregate = ProductAggregate.create({
    id: productId,
    correlationId,
    userId: 'user-123',
    title: state.title,
    shortDescription: state.shortDescription,
    slug: state.slug,
    collectionIds: state.collectionIds,
    variantIds: state.variantIds,
    richDescriptionUrl: state.richDescriptionUrl,
    productType: state.productType,
    vendor: state.vendor,
    variantOptions: state.variantOptions,
    metaTitle: state.metaTitle,
    metaDescription: state.metaDescription,
    tags: state.tags,
    requiresShipping: state.requiresShipping,
    taxable: state.taxable,
    pageLayoutId: state.pageLayoutId,
  })

  // Apply state changes if needed
  if (state.status === 'archived') {
    productAggregate.archive('user-123')
  } else if (state.status === 'active') {
    productAggregate.publish('user-123')
  }

  const snapshot = productAggregate.toSnapshot()
  db.run(
    `INSERT OR REPLACE INTO snapshots (aggregate_id, correlation_id, version, payload)
     VALUES (?, ?, ?, ?)`,
    [productId, correlationId, version, JSON.stringify(snapshot)]
  )
}

describe('productListViewProjection', () => {
  test('should create projection when product.created event is handled', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const productId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const collectionId = randomUUIDv7()
    
    saveCollectionSnapshot(db, collectionId, randomUUIDv7(), createCollectionState())
    
    const priorState = {} as any
    const newState = createProductState({ collectionIds: [collectionId] })
    const event = new ProductCreatedEvent({
      occurredAt: new Date(),
      aggregateId: productId,
      correlationId,
      version: 0,
      userId: 'user-123',
      priorState,
      newState,
    })

    // Act
    await productListViewProjection(event, repositories)
    await flushBatch(db, batch)

    // Assert product_collections table
    const productCollections = db.query(
      'SELECT * FROM product_collections WHERE aggregate_id = ?'
    ).all(productId) as any[]
    expect(productCollections).toHaveLength(1)
    expect(productCollections[0].collection_id).toBe(collectionId)
    expect(productCollections[0].title).toBe('Test Product')
    
    db.close()
  })

  test('should create projection with multiple collections', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const productId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const collectionId1 = randomUUIDv7()
    const collectionId2 = randomUUIDv7()
    
    saveCollectionSnapshot(db, collectionId1, randomUUIDv7(), createCollectionState({ name: 'Collection 1' }))
    saveCollectionSnapshot(db, collectionId2, randomUUIDv7(), createCollectionState({ name: 'Collection 2' }))
    
    const priorState = {} as any
    const newState = createProductState({ collectionIds: [collectionId1, collectionId2] })
    const event = new ProductCreatedEvent({
      occurredAt: new Date(),
      aggregateId: productId,
      correlationId,
      version: 0,
      userId: 'user-123',
      priorState,
      newState,
    })

    // Act
    await productListViewProjection(event, repositories)
    await flushBatch(db, batch)

    // Assert product_collections table has 2 rows
    const productCollections = db.query(
      'SELECT * FROM product_collections WHERE aggregate_id = ?'
    ).all(productId) as any[]
    expect(productCollections).toHaveLength(2)
    expect(productCollections.map((pc: any) => pc.collection_id).sort()).toEqual([collectionId1, collectionId2].sort())
    
    db.close()
  })

  test('should filter out invalid collection IDs', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const productId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const validCollectionId = randomUUIDv7()
    const invalidCollectionId = randomUUIDv7() // No snapshot for this
    
    saveCollectionSnapshot(db, validCollectionId, randomUUIDv7(), createCollectionState())
    
    const priorState = {} as any
    const newState = createProductState({ collectionIds: [validCollectionId, invalidCollectionId] })
    const event = new ProductCreatedEvent({
      occurredAt: new Date(),
      aggregateId: productId,
      correlationId,
      version: 0,
      userId: 'user-123',
      priorState,
      newState,
    })

    // Act
    await productListViewProjection(event, repositories)
    await flushBatch(db, batch)

    // Assert
    // Assert product_collections table only has valid collection
    const productCollections = db.query(
      'SELECT * FROM product_collections WHERE aggregate_id = ?'
    ).all(productId) as any[]
    expect(productCollections).toHaveLength(1)
    expect(productCollections[0].collection_id).toBe(validCollectionId)
    
    db.close()
  })

  test('should handle product with no collections', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const productId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    
    const priorState = {} as any
    const newState = createProductState({ collectionIds: [] })
    const event = new ProductCreatedEvent({
      occurredAt: new Date(),
      aggregateId: productId,
      correlationId,
      version: 0,
      userId: 'user-123',
      priorState,
      newState,
    })

    // Act
    await productListViewProjection(event, repositories)
    await flushBatch(db, batch)

    // Assert
    // Assert product_collections table is empty
    const productCollections = db.query(
      'SELECT * FROM product_collections WHERE aggregate_id = ?'
    ).all(productId) as any[]
    expect(productCollections).toHaveLength(0)
    
    db.close()
  })

  test('should update projection when product.archived event is handled', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const productId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const collectionId = randomUUIDv7()
    
    saveCollectionSnapshot(db, collectionId, randomUUIDv7(), createCollectionState())
    
    // Create initial projection
    const priorState = {} as any
    const newState = createProductState({ collectionIds: [collectionId], status: 'draft' })
    const createEvent = new ProductCreatedEvent({
      occurredAt: new Date('2024-01-01'),
      aggregateId: productId,
      correlationId,
      version: 0,
      userId: 'user-123',
      priorState,
      newState,
    })
    await productListViewProjection(createEvent, repositories)
    await flushBatch(db, batch)
    
    // Now archive it
    const batch2 = new TransactionBatch()
    const repositories2 = createRepositories(db, batch2)
    const archivedState = createProductState({ collectionIds: [collectionId], status: 'archived' })
    const archiveEvent = new ProductArchivedEvent({
      occurredAt: new Date('2024-01-02'),
      aggregateId: productId,
      correlationId,
      version: 1,
      userId: 'user-123',
      priorState: newState,
      newState: archivedState,
    })

    // Act
    await productListViewProjection(archiveEvent, repositories2)
    await flushBatch(db, batch2)

    // Assert
    // Assert product_collections table still has the entry
    const productCollections = db.query(
      'SELECT * FROM product_collections WHERE aggregate_id = ?'
    ).all(productId) as any[]
    expect(productCollections).toHaveLength(1)
    expect(productCollections[0].status).toBe('archived')
    
    db.close()
  })

  test('should update projection when product.published event is handled', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const productId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const collectionId = randomUUIDv7()
    
    saveCollectionSnapshot(db, collectionId, randomUUIDv7(), createCollectionState())
    
    // Create initial projection
    const priorState = {} as any
    const newState = createProductState({ collectionIds: [collectionId], status: 'draft' })
    const createEvent = new ProductCreatedEvent({
      occurredAt: new Date('2024-01-01'),
      aggregateId: productId,
      correlationId,
      version: 0,
      userId: 'user-123',
      priorState,
      newState,
    })
    await productListViewProjection(createEvent, repositories)
    await flushBatch(db, batch)
    
    // Now publish it
    const batch2 = new TransactionBatch()
    const repositories2 = createRepositories(db, batch2)
    const publishedState = createProductState({ 
      collectionIds: [collectionId], 
      status: 'active',
      publishedAt: new Date('2024-01-02')
    })
    const publishEvent = new ProductPublishedEvent({
      occurredAt: new Date('2024-01-02'),
      aggregateId: productId,
      correlationId,
      version: 1,
      userId: 'user-123',
      priorState: newState,
      newState: publishedState,
    })

    // Act
    await productListViewProjection(publishEvent, repositories2)
    await flushBatch(db, batch2)

    // Assert
    // Assert product_collections table still has the entry
    const productCollections = db.query(
      'SELECT * FROM product_collections WHERE aggregate_id = ?'
    ).all(productId) as any[]
    expect(productCollections).toHaveLength(1)
    expect(productCollections[0].status).toBe('active')
    
    db.close()
  })

  test('should update product_collections when product changes collections', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const productId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const collectionId1 = randomUUIDv7()
    const collectionId2 = randomUUIDv7()
    
    saveCollectionSnapshot(db, collectionId1, randomUUIDv7(), createCollectionState({ name: 'Collection 1' }))
    saveCollectionSnapshot(db, collectionId2, randomUUIDv7(), createCollectionState({ name: 'Collection 2' }))
    
    // Create product with collection 1
    const priorState = {} as any
    const newState = createProductState({ collectionIds: [collectionId1] })
    const createEvent = new ProductCreatedEvent({
      occurredAt: new Date('2024-01-01'),
      aggregateId: productId,
      correlationId,
      version: 0,
      userId: 'user-123',
      priorState,
      newState,
    })
    await productListViewProjection(createEvent, repositories)
    await flushBatch(db, batch)
    
    // Update to collection 2
    const batch2 = new TransactionBatch()
    const repositories2 = createRepositories(db, batch2)
    const updatedState = createProductState({ collectionIds: [collectionId2] })
    const updateEvent = new ProductPublishedEvent({
      occurredAt: new Date('2024-01-02'),
      aggregateId: productId,
      correlationId,
      version: 1,
      userId: 'user-123',
      priorState: newState,
      newState: updatedState,
    })

    // Act
    await productListViewProjection(updateEvent, repositories2)
    await flushBatch(db, batch2)

    // Assert - product_collections should only have collection 2
    const productCollections = db.query(
      'SELECT * FROM product_collections WHERE aggregate_id = ?'
    ).all(productId) as any[]
    expect(productCollections).toHaveLength(1)
    expect(productCollections[0].collection_id).toBe(collectionId2)
    
    db.close()
  })

  test('should update all product projections when collection.created event is handled', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const collectionId = randomUUIDv7()
    const productId1 = randomUUIDv7()
    const productId2 = randomUUIDv7()
    const correlationId1 = randomUUIDv7()
    const correlationId2 = randomUUIDv7()
    
    // Create two products in the collection
    const product1State = createProductState({ collectionIds: [collectionId] })
    const product2State = createProductState({ collectionIds: [collectionId] })
    
    const product1Event = new ProductCreatedEvent({
      occurredAt: new Date('2024-01-01'),
      aggregateId: productId1,
      correlationId: correlationId1,
      version: 0,
      userId: 'user-123',
      priorState: {} as any,
      newState: product1State,
    })

    const product2Event = new ProductCreatedEvent({
      occurredAt: new Date('2024-01-01'),
      aggregateId: productId2,
      correlationId: correlationId2,
      version: 0,
      userId: 'user-123',
      priorState: {} as any,
      newState: product2State,
    })
    
    // Save collection snapshot first
    saveCollectionSnapshot(db, collectionId, randomUUIDv7(), createCollectionState({ name: 'Old Name' }))
    
    await productListViewProjection(product1Event, repositories)
    await productListViewProjection(product2Event, repositories)
    await flushBatch(db, batch)
    
    // Now create the collection (this should update product projections)
    // Update snapshot to new state BEFORE creating event
    const collectionState = createCollectionState({ name: 'New Collection Name' })
    saveCollectionSnapshot(db, collectionId, randomUUIDv7(), collectionState, 0)
    
    const batch2 = new TransactionBatch()
    const repositories2 = createRepositories(db, batch2)
    const collectionEvent = new CollectionCreatedEvent({
      occurredAt: new Date('2024-01-02'),
      aggregateId: collectionId,
      correlationId: randomUUIDv7(),
      version: 0,
      userId: 'user-123',
      priorState: {} as any,
      newState: collectionState,
    })

    // Act
    await productListViewProjection(collectionEvent, repositories2)
    await flushBatch(db, batch2)

    // Assert - Both product projections should be updated
    // Both products should have their product_collections entries updated
    const productCollections1 = db.query(
      'SELECT * FROM product_collections WHERE aggregate_id = ?'
    ).all(productId1) as any[]
    const productCollections2 = db.query(
      'SELECT * FROM product_collections WHERE aggregate_id = ?'
    ).all(productId2) as any[]
    
    expect(productCollections1.length).toBeGreaterThan(0)
    expect(productCollections2.length).toBeGreaterThan(0)
    
    db.close()
  })

  test('should update all product projections when collection.metadata_updated event is handled', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const collectionId = randomUUIDv7()
    const productId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    
    // Create product in collection
    saveCollectionSnapshot(db, collectionId, randomUUIDv7(), createCollectionState({ name: 'Old Name', slug: 'old-slug' }))
    
    const productState = createProductState({ collectionIds: [collectionId] })
    const productEvent = new ProductCreatedEvent({
      occurredAt: new Date('2024-01-01'),
      aggregateId: productId,
      correlationId,
      version: 0,
      userId: 'user-123',
      priorState: {} as any,
      newState: productState,
    })
    
    await productListViewProjection(productEvent, repositories)
    await flushBatch(db, batch)
    
    // Update collection metadata
    // Update snapshot BEFORE creating event
    const updatedCollectionState = createCollectionState({ name: 'Updated Name', slug: 'updated-slug' })
    saveCollectionSnapshot(db, collectionId, randomUUIDv7(), updatedCollectionState, 1)
    
    const batch2 = new TransactionBatch()
    const repositories2 = createRepositories(db, batch2)
    const updateEvent = new CollectionMetadataUpdatedEvent({
      occurredAt: new Date('2024-01-02'),
      aggregateId: collectionId,
      correlationId: randomUUIDv7(),
      version: 1,
      priorState: createCollectionState({ name: 'Old Name', slug: 'old-slug' }),
      newState: updatedCollectionState,
    })

    // Act
    await productListViewProjection(updateEvent, repositories2)
    await flushBatch(db, batch2)

    // Assert
    // Product collections should be updated
    const productCollections = db.query(
      'SELECT * FROM product_collections WHERE aggregate_id = ?'
    ).all(productId) as any[]
    expect(productCollections.length).toBeGreaterThan(0)
    
    db.close()
  })

  test('should update all product projections when collection.archived event is handled', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const collectionId = randomUUIDv7()
    const productId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    
    // Create product in collection
    saveCollectionSnapshot(db, collectionId, randomUUIDv7(), createCollectionState({ status: 'active' }))
    
    const productState = createProductState({ collectionIds: [collectionId] })
    const productEvent = new ProductCreatedEvent({
      occurredAt: new Date('2024-01-01'),
      aggregateId: productId,
      correlationId,
      version: 0,
      userId: 'user-123',
      priorState: {} as any,
      newState: productState,
    })
    
    await productListViewProjection(productEvent, repositories)
    await flushBatch(db, batch)
    
    // Archive collection
    // Update snapshot BEFORE creating event
    const archivedCollectionState = createCollectionState({ status: 'archived' })
    saveCollectionSnapshot(db, collectionId, randomUUIDv7(), archivedCollectionState, 1)
    
    const batch2 = new TransactionBatch()
    const repositories2 = createRepositories(db, batch2)
    const archiveEvent = new CollectionArchivedEvent({
      occurredAt: new Date('2024-01-02'),
      aggregateId: collectionId,
      correlationId: randomUUIDv7(),
      version: 1,
      priorState: createCollectionState({ status: 'active' }),
      newState: archivedCollectionState,
    })

    // Act
    await productListViewProjection(archiveEvent, repositories2)
    await flushBatch(db, batch2)

    // Assert
    // Product collections should still exist
    const productCollections = db.query(
      'SELECT * FROM product_collections WHERE aggregate_id = ?'
    ).all(productId) as any[]
    expect(productCollections.length).toBeGreaterThan(0)
    
    db.close()
  })

  test('should not update projections when collection snapshot does not exist', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const collectionId = randomUUIDv7()
    const productId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    
    // Create product in collection (but collection snapshot doesn't exist)
    const productState = createProductState({ collectionIds: [collectionId] })
    const productEvent = new ProductCreatedEvent({
      occurredAt: new Date('2024-01-01'),
      aggregateId: productId,
      correlationId,
      version: 0,
      userId: 'user-123',
      priorState: {} as any,
      newState: productState,
    })
    
    await productListViewProjection(productEvent, repositories)
    await flushBatch(db, batch)
    
    // Try to update collection (but no snapshot)
    const batch2 = new TransactionBatch()
    const repositories2 = createRepositories(db, batch2)
    const updateEvent = new CollectionMetadataUpdatedEvent({
      occurredAt: new Date('2024-01-02'),
      aggregateId: collectionId,
      correlationId: randomUUIDv7(),
      version: 1,
      priorState: createCollectionState(),
      newState: createCollectionState({ name: 'Updated Name' }),
    })

    // Act
    await productListViewProjection(updateEvent, repositories2)
    await flushBatch(db, batch2)

    // Assert - Projection should not be updated (no products found in collection)
    // Since collection snapshot doesn't exist, no product_collections entry was created when product was created
    // (we only save valid collections), so there should be 0 entries
    const productCollections = db.query(
      'SELECT * FROM product_collections WHERE aggregate_id = ?'
    ).all(productId) as any[]
    expect(productCollections.length).toBe(0)
    
    db.close()
  })

  test('should ignore unknown event types', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const unknownEvent = {
      eventName: 'unknown.event',
      aggregateId: randomUUIDv7(),
      correlationId: randomUUIDv7(),
      version: 0,
      occurredAt: new Date(),
      payload: {},
    } as any

    // Act & Assert - Should not throw
    await productListViewProjection(unknownEvent, repositories)
    await flushBatch(db, batch)

    // Assert - No product_collections should be created
    const productCollections = db.query('SELECT * FROM product_collections').all() as any[]
    expect(productCollections).toHaveLength(0)
    
    db.close()
  })

  test('should retroactively create relationships when collection.created event is handled for products that referenced it', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    
    const collectionId = randomUUIDv7()
    const productId1 = randomUUIDv7()
    const productId2 = randomUUIDv7()
    const correlationId1 = randomUUIDv7()
    const correlationId2 = randomUUIDv7()
    
    // Create products that reference a collection that doesn't exist yet
    // Create products via events so product_list_view gets populated
    const batch1 = new TransactionBatch()
    const repositories1 = createRepositories(db, batch1)
    
    const product1State = createProductState({ collectionIds: [collectionId], title: 'Product 1' })
    const product1Event = new ProductCreatedEvent({
      occurredAt: new Date('2024-01-01'),
      aggregateId: productId1,
      correlationId: correlationId1,
      version: 0,
      priorState: {} as any,
      newState: product1State,
    })
    await productListViewProjection(product1Event, repositories1)
    await flushBatch(db, batch1)
    
    const batch2 = new TransactionBatch()
    const repositories2 = createRepositories(db, batch2)
    const product2State = createProductState({ collectionIds: [collectionId], title: 'Product 2' })
    const product2Event = new ProductCreatedEvent({
      occurredAt: new Date('2024-01-01'),
      aggregateId: productId2,
      correlationId: correlationId2,
      version: 0,
      priorState: {} as any,
      newState: product2State,
    })
    await productListViewProjection(product2Event, repositories2)
    await flushBatch(db, batch2)
    
    // Verify no relationships exist yet (collection doesn't exist)
    const beforeCollections = db.query('SELECT * FROM product_collections').all() as any[]
    expect(beforeCollections).toHaveLength(0)
    
    // Now create the collection
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    const collectionState = createCollectionState({ name: 'New Collection' })
    saveCollectionSnapshot(db, collectionId, randomUUIDv7(), collectionState, 0)
    
    const collectionEvent = new CollectionCreatedEvent({
      occurredAt: new Date('2024-01-02'),
      aggregateId: collectionId,
      correlationId: randomUUIDv7(),
      version: 0,
      userId: 'user-123',
      priorState: {} as any,
      newState: collectionState,
    })

    // Act
    await productListViewProjection(collectionEvent, repositories)
    await flushBatch(db, batch)

    // Assert - Both products should now have relationships created retroactively
    const productCollections1 = db.query(
      'SELECT * FROM product_collections WHERE aggregate_id = ? AND collection_id = ?'
    ).all(productId1, collectionId) as any[]
    const productCollections2 = db.query(
      'SELECT * FROM product_collections WHERE aggregate_id = ? AND collection_id = ?'
    ).all(productId2, collectionId) as any[]
    
    expect(productCollections1).toHaveLength(1)
    expect(productCollections1[0].title).toBe('Product 1')
    expect(productCollections2).toHaveLength(1)
    expect(productCollections2[0].title).toBe('Product 2')
    
    db.close()
  })

  test('should retroactively create relationships when collection.metadata_updated event is handled', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    
    const collectionId = randomUUIDv7()
    const productId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    
    // Create product that references a collection that doesn't exist yet
    // Create product via event so product_list_view gets populated
    const batch1 = new TransactionBatch()
    const repositories1 = createRepositories(db, batch1)
    const productState = createProductState({ collectionIds: [collectionId], title: 'Test Product' })
    const productEvent = new ProductCreatedEvent({
      occurredAt: new Date('2024-01-01'),
      aggregateId: productId,
      correlationId,
      version: 0,
      userId: 'user-123',
      priorState: {} as any,
      newState: productState,
    })
    await productListViewProjection(productEvent, repositories1)
    await flushBatch(db, batch1)
    
    // Verify no relationships exist yet
    const beforeCollections = db.query('SELECT * FROM product_collections').all() as any[]
    expect(beforeCollections).toHaveLength(0)
    
    // Create collection snapshot and update metadata
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    const updatedCollectionState = createCollectionState({ name: 'Updated Collection', slug: 'updated-slug' })
    saveCollectionSnapshot(db, collectionId, randomUUIDv7(), updatedCollectionState, 1)
    
    const updateEvent = new CollectionMetadataUpdatedEvent({
      occurredAt: new Date('2024-01-02'),
      aggregateId: collectionId,
      correlationId: randomUUIDv7(),
      version: 1,
      priorState: createCollectionState({ name: 'Old Collection', slug: 'old-slug' }),
      newState: updatedCollectionState,
    })

    // Act
    await productListViewProjection(updateEvent, repositories)
    await flushBatch(db, batch)

    // Assert - Product should now have relationship created retroactively
    const productCollections = db.query(
      'SELECT * FROM product_collections WHERE aggregate_id = ? AND collection_id = ?'
    ).all(productId, collectionId) as any[]
    
    expect(productCollections).toHaveLength(1)
    expect(productCollections[0].title).toBe('Test Product')
    
    db.close()
  })

  test('should not create relationships for products that do not reference the collection', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    
    const collectionId = randomUUIDv7()
    const otherCollectionId = randomUUIDv7()
    const productId1 = randomUUIDv7() // References collectionId
    const productId2 = randomUUIDv7() // References otherCollectionId
    const correlationId1 = randomUUIDv7()
    const correlationId2 = randomUUIDv7()
    
    // Create products with different collection references via events
    const batch1 = new TransactionBatch()
    const repositories1 = createRepositories(db, batch1)
    const product1State = createProductState({ collectionIds: [collectionId], title: 'Product 1' })
    const product1Event = new ProductCreatedEvent({
      occurredAt: new Date('2024-01-01'),
      aggregateId: productId1,
      correlationId: correlationId1,
      version: 0,
      priorState: {} as any,
      newState: product1State,
    })
    await productListViewProjection(product1Event, repositories1)
    await flushBatch(db, batch1)
    
    const batch2 = new TransactionBatch()
    const repositories2 = createRepositories(db, batch2)
    const product2State = createProductState({ collectionIds: [otherCollectionId], title: 'Product 2' })
    const product2Event = new ProductCreatedEvent({
      occurredAt: new Date('2024-01-01'),
      aggregateId: productId2,
      correlationId: correlationId2,
      version: 0,
      priorState: {} as any,
      newState: product2State,
    })
    await productListViewProjection(product2Event, repositories2)
    await flushBatch(db, batch2)
    
    // Create the collection
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    const collectionState = createCollectionState({ name: 'New Collection' })
    saveCollectionSnapshot(db, collectionId, randomUUIDv7(), collectionState, 0)
    
    const collectionEvent = new CollectionCreatedEvent({
      occurredAt: new Date('2024-01-02'),
      aggregateId: collectionId,
      correlationId: randomUUIDv7(),
      version: 0,
      userId: 'user-123',
      priorState: {} as any,
      newState: collectionState,
    })

    // Act
    await productListViewProjection(collectionEvent, repositories)
    await flushBatch(db, batch)

    // Assert - Only product1 should have relationship, product2 should not
    const productCollections1 = db.query(
      'SELECT * FROM product_collections WHERE aggregate_id = ? AND collection_id = ?'
    ).all(productId1, collectionId) as any[]
    const productCollections2 = db.query(
      'SELECT * FROM product_collections WHERE aggregate_id = ? AND collection_id = ?'
    ).all(productId2, collectionId) as any[]
    
    expect(productCollections1).toHaveLength(1)
    expect(productCollections1[0].title).toBe('Product 1')
    expect(productCollections2).toHaveLength(0)
    
    db.close()
  })

  test('should update projection when product.details_updated event is handled', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const productId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const collectionId = randomUUIDv7()
    
    saveCollectionSnapshot(db, collectionId, randomUUIDv7(), createCollectionState())
    
    // First create the product
    const createPriorState = {} as any
    const createNewState = createProductState({ collectionIds: [collectionId] })
    const createEvent = new ProductCreatedEvent({
      occurredAt: new Date('2024-01-01'),
      aggregateId: productId,
      correlationId,
      version: 0,
      priorState: createPriorState,
      newState: createNewState,
    })
    await productListViewProjection(createEvent, repositories)
    await flushBatch(db, batch)

    // Now update details
    const batch2 = new TransactionBatch()
    const repositories2 = createRepositories(db, batch2)
    const updatePriorState = createProductState({ collectionIds: [collectionId] })
    const updateNewState = createProductState({
      collectionIds: [collectionId],
      title: 'Updated Title',
      shortDescription: 'Updated Description',
      richDescriptionUrl: 'https://example.com/updated',
      updatedAt: new Date('2024-01-02'),
    })
    const updateEvent = new ProductDetailsUpdatedEvent({
      occurredAt: new Date('2024-01-02'),
      aggregateId: productId,
      correlationId,
      version: 1,
      priorState: updatePriorState,
      newState: updateNewState,
    })

    // Act
    await productListViewProjection(updateEvent, repositories2)
    await flushBatch(db, batch2)

    // Assert
    const product = db.query(
      'SELECT * FROM product_list_view WHERE aggregate_id = ?'
    ).get(productId) as any
    expect(product).toBeDefined()
    expect(product.title).toBe('Updated Title')
    expect(product.short_description).toBe('Updated Description')
    expect(product.version).toBe(1)
    
    db.close()
  })

  test('should update projection when product.metadata_updated event is handled', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const productId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const collectionId = randomUUIDv7()
    
    saveCollectionSnapshot(db, collectionId, randomUUIDv7(), createCollectionState())
    
    // First create the product
    const createPriorState = {} as any
    const createNewState = createProductState({ collectionIds: [collectionId] })
    const createEvent = new ProductCreatedEvent({
      occurredAt: new Date('2024-01-01'),
      aggregateId: productId,
      correlationId,
      version: 0,
      priorState: createPriorState,
      newState: createNewState,
    })
    await productListViewProjection(createEvent, repositories)
    await flushBatch(db, batch)

    // Now update metadata
    const batch2 = new TransactionBatch()
    const repositories2 = createRepositories(db, batch2)
    const updatePriorState = createProductState({ collectionIds: [collectionId] })
    const updateNewState = createProductState({
      collectionIds: [collectionId],
      metaTitle: 'Updated Meta Title',
      metaDescription: 'Updated Meta Description',
      updatedAt: new Date('2024-01-02'),
    })
    const updateEvent = new ProductMetadataUpdatedEvent({
      occurredAt: new Date('2024-01-02'),
      aggregateId: productId,
      correlationId,
      version: 1,
      priorState: updatePriorState,
      newState: updateNewState,
    })

    // Act
    await productListViewProjection(updateEvent, repositories2)
    await flushBatch(db, batch2)

    // Assert
    const product = db.query(
      'SELECT * FROM product_list_view WHERE aggregate_id = ?'
    ).get(productId) as any
    expect(product).toBeDefined()
    expect(product.version).toBe(1)
    
    db.close()
  })

  test('should update projection when product.classification_updated event is handled', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const productId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const collectionId = randomUUIDv7()
    
    saveCollectionSnapshot(db, collectionId, randomUUIDv7(), createCollectionState())
    
    // First create the product
    const createPriorState = {} as any
    const createNewState = createProductState({ collectionIds: [collectionId] })
    const createEvent = new ProductCreatedEvent({
      occurredAt: new Date('2024-01-01'),
      aggregateId: productId,
      correlationId,
      version: 0,
      priorState: createPriorState,
      newState: createNewState,
    })
    await productListViewProjection(createEvent, repositories)
    await flushBatch(db, batch)

    // Now update classification
    const batch2 = new TransactionBatch()
    const repositories2 = createRepositories(db, batch2)
    const updatePriorState = createProductState({ collectionIds: [collectionId] })
    const updateNewState = createProductState({
      collectionIds: [collectionId],
      productType: 'Updated Type',
      vendor: 'Updated Vendor',
      updatedAt: new Date('2024-01-02'),
    })
    const updateEvent = new ProductClassificationUpdatedEvent({
      occurredAt: new Date('2024-01-02'),
      aggregateId: productId,
      correlationId,
      version: 1,
      priorState: updatePriorState,
      newState: updateNewState,
    })

    // Act
    await productListViewProjection(updateEvent, repositories2)
    await flushBatch(db, batch2)

    // Assert
    const product = db.query(
      'SELECT * FROM product_list_view WHERE aggregate_id = ?'
    ).get(productId) as any
    expect(product).toBeDefined()
    expect(product.product_type).toBe('Updated Type')
    expect(product.vendor).toBe('Updated Vendor')
    expect(product.version).toBe(1)
    
    db.close()
  })

  test('should update projection when product.tags_updated event is handled', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const productId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const collectionId = randomUUIDv7()
    
    saveCollectionSnapshot(db, collectionId, randomUUIDv7(), createCollectionState())
    
    // First create the product
    const createPriorState = {} as any
    const createNewState = createProductState({ collectionIds: [collectionId] })
    const createEvent = new ProductCreatedEvent({
      occurredAt: new Date('2024-01-01'),
      aggregateId: productId,
      correlationId,
      version: 0,
      priorState: createPriorState,
      newState: createNewState,
    })
    await productListViewProjection(createEvent, repositories)
    await flushBatch(db, batch)

    // Now update tags
    const batch2 = new TransactionBatch()
    const repositories2 = createRepositories(db, batch2)
    const updatePriorState = createProductState({ collectionIds: [collectionId] })
    const updateNewState = createProductState({
      collectionIds: [collectionId],
      tags: ['tag1', 'tag2', 'tag3'],
      updatedAt: new Date('2024-01-02'),
    })
    const updateEvent = new ProductTagsUpdatedEvent({
      occurredAt: new Date('2024-01-02'),
      aggregateId: productId,
      correlationId,
      version: 1,
      priorState: updatePriorState,
      newState: updateNewState,
    })

    // Act
    await productListViewProjection(updateEvent, repositories2)
    await flushBatch(db, batch2)

    // Assert
    const product = db.query(
      'SELECT * FROM product_list_view WHERE aggregate_id = ?'
    ).get(productId) as any
    expect(product).toBeDefined()
    expect(JSON.parse(product.tags)).toEqual(['tag1', 'tag2', 'tag3'])
    expect(product.version).toBe(1)
    
    db.close()
  })

  test('should update projection when product.shipping_settings_updated event is handled', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const productId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const collectionId = randomUUIDv7()
    
    saveCollectionSnapshot(db, collectionId, randomUUIDv7(), createCollectionState())
    
    // First create the product
    const createPriorState = {} as any
    const createNewState = createProductState({ collectionIds: [collectionId] })
    const createEvent = new ProductCreatedEvent({
      occurredAt: new Date('2024-01-01'),
      aggregateId: productId,
      correlationId,
      version: 0,
      priorState: createPriorState,
      newState: createNewState,
    })
    await productListViewProjection(createEvent, repositories)
    await flushBatch(db, batch)

    // Now update shipping settings
    const batch2 = new TransactionBatch()
    const repositories2 = createRepositories(db, batch2)
    const updatePriorState = createProductState({ collectionIds: [collectionId] })
    const updateNewState = createProductState({
      collectionIds: [collectionId],
      requiresShipping: false,
      taxable: false,
      updatedAt: new Date('2024-01-02'),
    })
    const updateEvent = new ProductShippingSettingsUpdatedEvent({
      occurredAt: new Date('2024-01-02'),
      aggregateId: productId,
      correlationId,
      version: 1,
      priorState: updatePriorState,
      newState: updateNewState,
    })

    // Act
    await productListViewProjection(updateEvent, repositories2)
    await flushBatch(db, batch2)

    // Assert
    const product = db.query(
      'SELECT * FROM product_list_view WHERE aggregate_id = ?'
    ).get(productId) as any
    expect(product).toBeDefined()
    expect(product.version).toBe(1)
    
    db.close()
  })

  test('should update projection when product.page_layout_updated event is handled', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const productId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const collectionId = randomUUIDv7()
    
    saveCollectionSnapshot(db, collectionId, randomUUIDv7(), createCollectionState())
    
    // First create the product
    const createPriorState = {} as any
    const createNewState = createProductState({ collectionIds: [collectionId] })
    const createEvent = new ProductCreatedEvent({
      occurredAt: new Date('2024-01-01'),
      aggregateId: productId,
      correlationId,
      version: 0,
      priorState: createPriorState,
      newState: createNewState,
    })
    await productListViewProjection(createEvent, repositories)
    await flushBatch(db, batch)

    // Now update page layout
    const batch2 = new TransactionBatch()
    const repositories2 = createRepositories(db, batch2)
    const updatePriorState = createProductState({ collectionIds: [collectionId] })
    const updateNewState = createProductState({
      collectionIds: [collectionId],
      pageLayoutId: 'layout-123',
      updatedAt: new Date('2024-01-02'),
    })
    const updateEvent = new ProductPageLayoutUpdatedEvent({
      occurredAt: new Date('2024-01-02'),
      aggregateId: productId,
      correlationId,
      version: 1,
      priorState: updatePriorState,
      newState: updateNewState,
    })

    // Act
    await productListViewProjection(updateEvent, repositories2)
    await flushBatch(db, batch2)

    // Assert
    const product = db.query(
      'SELECT * FROM product_list_view WHERE aggregate_id = ?'
    ).get(productId) as any
    expect(product).toBeDefined()
    expect(product.version).toBe(1)
    
    db.close()
  })

  test('should update version correctly through multiple product events', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const productId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const collectionId = randomUUIDv7()
    
    saveCollectionSnapshot(db, collectionId, randomUUIDv7(), createCollectionState())
    
    // Create product (version 0)
    const createPriorState = {} as any
    const createNewState = createProductState({ collectionIds: [collectionId] })
    const createEvent = new ProductCreatedEvent({
      occurredAt: new Date('2024-01-01'),
      aggregateId: productId,
      correlationId,
      version: 0,
      priorState: createPriorState,
      newState: createNewState,
    })
    await productListViewProjection(createEvent, repositories)
    await flushBatch(db, batch)

    // Update details (version 1)
    const batch2 = new TransactionBatch()
    const repositories2 = createRepositories(db, batch2)
    const detailsPriorState = createProductState({ collectionIds: [collectionId] })
    const detailsNewState = createProductState({
      collectionIds: [collectionId],
      title: 'Updated Title',
      updatedAt: new Date('2024-01-02'),
    })
    const detailsEvent = new ProductDetailsUpdatedEvent({
      occurredAt: new Date('2024-01-02'),
      aggregateId: productId,
      correlationId,
      version: 1,
      priorState: detailsPriorState,
      newState: detailsNewState,
    })
    await productListViewProjection(detailsEvent, repositories2)
    await flushBatch(db, batch2)

    // Update classification (version 2)
    const batch3 = new TransactionBatch()
    const repositories3 = createRepositories(db, batch3)
    const classificationPriorState = createProductState({
      collectionIds: [collectionId],
      title: 'Updated Title',
    })
    const classificationNewState = createProductState({
      collectionIds: [collectionId],
      title: 'Updated Title',
      productType: 'New Type',
      vendor: 'New Vendor',
      updatedAt: new Date('2024-01-03'),
    })
    const classificationEvent = new ProductClassificationUpdatedEvent({
      occurredAt: new Date('2024-01-03'),
      aggregateId: productId,
      correlationId,
      version: 2,
      priorState: classificationPriorState,
      newState: classificationNewState,
    })
    await productListViewProjection(classificationEvent, repositories3)
    await flushBatch(db, batch3)

    // Update tags (version 3)
    const batch4 = new TransactionBatch()
    const repositories4 = createRepositories(db, batch4)
    const tagsPriorState = createProductState({
      collectionIds: [collectionId],
      title: 'Updated Title',
      productType: 'New Type',
      vendor: 'New Vendor',
    })
    const tagsNewState = createProductState({
      collectionIds: [collectionId],
      title: 'Updated Title',
      productType: 'New Type',
      vendor: 'New Vendor',
      tags: ['tag1', 'tag2'],
      updatedAt: new Date('2024-01-04'),
    })
    const tagsEvent = new ProductTagsUpdatedEvent({
      occurredAt: new Date('2024-01-04'),
      aggregateId: productId,
      correlationId,
      version: 3,
      priorState: tagsPriorState,
      newState: tagsNewState,
    })
    await productListViewProjection(tagsEvent, repositories4)
    await flushBatch(db, batch4)

    // Act - Update metadata (version 4)
    const batch5 = new TransactionBatch()
    const repositories5 = createRepositories(db, batch5)
    const metadataPriorState = createProductState({
      collectionIds: [collectionId],
      title: 'Updated Title',
      productType: 'New Type',
      vendor: 'New Vendor',
      tags: ['tag1', 'tag2'],
    })
    const metadataNewState = createProductState({
      collectionIds: [collectionId],
      title: 'Updated Title',
      productType: 'New Type',
      vendor: 'New Vendor',
      tags: ['tag1', 'tag2'],
      metaTitle: 'Meta Title',
      metaDescription: 'Meta Description',
      updatedAt: new Date('2024-01-05'),
    })
    const metadataEvent = new ProductMetadataUpdatedEvent({
      occurredAt: new Date('2024-01-05'),
      aggregateId: productId,
      correlationId,
      version: 4,
      priorState: metadataPriorState,
      newState: metadataNewState,
    })
    await productListViewProjection(metadataEvent, repositories5)
    await flushBatch(db, batch5)

    // Assert
    const product = db.query(
      'SELECT * FROM product_list_view WHERE aggregate_id = ?'
    ).get(productId) as any
    expect(product).toBeDefined()
    expect(product.version).toBe(4)
    expect(product.title).toBe('Updated Title')
    expect(product.product_type).toBe('New Type')
    expect(product.vendor).toBe('New Vendor')
    expect(JSON.parse(product.tags)).toEqual(['tag1', 'tag2'])
    
    db.close()
  })

  test('should update projection when product.variant_options_updated event is handled', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const productId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const collectionId = randomUUIDv7()
    
    saveCollectionSnapshot(db, collectionId, randomUUIDv7(), createCollectionState())
    
    // First create the product
    const createPriorState = {} as any
    const createNewState = createProductState({ collectionIds: [collectionId] })
    const createEvent = new ProductCreatedEvent({
      occurredAt: new Date('2024-01-01'),
      aggregateId: productId,
      correlationId,
      version: 0,
      priorState: createPriorState,
      newState: createNewState,
    })
    await productListViewProjection(createEvent, repositories)
    await flushBatch(db, batch)

    // Now update variant options
    const batch2 = new TransactionBatch()
    const repositories2 = createRepositories(db, batch2)
    const updatePriorState = createProductState({ collectionIds: [collectionId] })
    const updateNewState = createProductState({
      collectionIds: [collectionId],
      variantOptions: [{ name: 'Color', values: ['Red', 'Blue'] }],
      updatedAt: new Date('2024-01-02'),
    })
    const updateEvent = new ProductVariantOptionsUpdatedEvent({
      occurredAt: new Date('2024-01-02'),
      aggregateId: productId,
      correlationId,
      version: 1,
      priorState: updatePriorState,
      newState: updateNewState,
    })

    // Act
    await productListViewProjection(updateEvent, repositories2)
    await flushBatch(db, batch2)

    // Assert
    const product = db.query(
      'SELECT * FROM product_list_view WHERE aggregate_id = ?'
    ).get(productId) as any
    expect(product).toBeDefined()
    expect(JSON.parse(product.variant_options)).toEqual([{ name: 'Color', values: ['Red', 'Blue'] }])
    expect(product.version).toBe(1)
    
    db.close()
  })

  test('should update projection when product.fulfillment_type_updated event is handled', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const productId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const collectionId = randomUUIDv7()
    
    saveCollectionSnapshot(db, collectionId, randomUUIDv7(), createCollectionState())
    
    // First create the product
    const createPriorState = {} as any
    const createNewState = createProductState({ collectionIds: [collectionId] })
    const createEvent = new ProductCreatedEvent({
      occurredAt: new Date('2024-01-01'),
      aggregateId: productId,
      correlationId,
      version: 0,
      priorState: createPriorState,
      newState: createNewState,
    })
    await productListViewProjection(createEvent, repositories)
    await flushBatch(db, batch)

    // Now update fulfillment type
    const batch2 = new TransactionBatch()
    const repositories2 = createRepositories(db, batch2)
    const updatePriorState = createProductState({ collectionIds: [collectionId] })
    const updateNewState = createProductState({
      collectionIds: [collectionId],
      fulfillmentType: 'dropship',
      dropshipSafetyBuffer: 5,
      updatedAt: new Date('2024-01-02'),
    })
    const updateEvent = new ProductFulfillmentTypeUpdatedEvent({
      occurredAt: new Date('2024-01-02'),
      aggregateId: productId,
      correlationId,
      version: 1,
      priorState: updatePriorState,
      newState: updateNewState,
    })

    // Act
    await productListViewProjection(updateEvent, repositories2)
    await flushBatch(db, batch2)

    // Assert
    const product = db.query(
      'SELECT * FROM product_list_view WHERE aggregate_id = ?'
    ).get(productId) as any
    expect(product).toBeDefined()
    expect(product.fulfillment_type).toBe('dropship')
    expect(product.dropship_safety_buffer).toBe(5)
    expect(product.version).toBe(1)
    
    db.close()
  })
})

