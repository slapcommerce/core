import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { TransactionBatch } from '../../../src/infrastructure/transactionBatch'
import { productVariantProjection } from '../../../src/views/product/productVariantProjection'
import { VariantCreatedEvent, VariantArchivedEvent, VariantDetailsUpdatedEvent, VariantPriceUpdatedEvent, VariantInventoryUpdatedEvent } from '../../../src/domain/variant/events'
import { ProductCreatedEvent, ProductArchivedEvent, ProductPublishedEvent, ProductDetailsUpdatedEvent } from '../../../src/domain/product/events'
import { VariantAggregate } from '../../../src/domain/variant/aggregate'
import { ProductAggregate } from '../../../src/domain/product/aggregate'
import { EventRepository } from '../../../src/infrastructure/repositories/eventRepository'
import { SnapshotRepository } from '../../../src/infrastructure/repositories/snapshotRepository'
import { OutboxRepository } from '../../../src/infrastructure/repositories/outboxRepository'
import { ProductListViewRepository } from '../../../src/infrastructure/repositories/productListViewRepository'
import { ProductVariantRepository } from '../../../src/infrastructure/repositories/productVariantRepository'
import { ProductCollectionRepository } from '../../../src/infrastructure/repositories/productCollectionRepository'
import { SlugRedirectRepository } from '../../../src/infrastructure/repositories/slugRedirectRepository'
import { CollectionsListViewRepository } from '../../../src/infrastructure/repositories/collectionsListViewRepository'
import { schemas } from '../../../src/infrastructure/schemas'
import { randomUUIDv7 } from 'bun'
import type { UnitOfWorkRepositories } from '../../../src/infrastructure/projectionService'

function createProductState(overrides?: Partial<any>): any {
  return {
    title: 'Test Product',
    shortDescription: 'A test product',
    slug: 'test-product',
    collectionIds: [randomUUIDv7()],
    variantIds: overrides?.variantIds ?? [],
    richDescriptionUrl: 'https://example.com/description',
    productType: 'physical',
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

function createVariantState(overrides?: Partial<any>): any {
  return {
    productId: randomUUIDv7(),
    sku: 'SKU-123',
    title: 'Test Variant',
    price: 29.99,
    inventory: 100,
    options: { Size: 'L' },
    barcode: '123456789',
    weight: 1.5,
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
  
  if (state.status === 'archived') {
    productAggregate.archive()
  } else if (state.status === 'active') {
    productAggregate.publish()
  }

  const snapshot = productAggregate.toSnapshot()
  db.run(
    `INSERT OR REPLACE INTO snapshots (aggregate_id, correlation_id, version, payload)
     VALUES (?, ?, ?, ?)`,
    [productId, correlationId, version, JSON.stringify(snapshot)]
  )
  
  // Also save to product_list_view for projection lookup
  const productListViewRepo = new ProductListViewRepository(db, new TransactionBatch())
  productListViewRepo.save({
    aggregate_id: productId,
    title: state.title,
    slug: state.slug,
    vendor: state.vendor,
    product_type: state.productType,
    short_description: state.shortDescription,
    tags: state.tags,
    created_at: state.createdAt,
    status: state.status,
    correlation_id: correlationId,
    version: version,
    updated_at: state.updatedAt,
    collection_ids: state.collectionIds,
    meta_title: state.metaTitle,
    meta_description: state.metaDescription,
  })
  flushBatch(db, productListViewRepo['batch'] as TransactionBatch)
}

function saveVariantSnapshot(
  db: Database,
  variantId: string,
  correlationId: string,
  state: any,
  version: number = 0
) {
  const variantAggregate = VariantAggregate.create({
    id: variantId,
    correlationId,
    productId: state.productId,
    sku: state.sku,
    title: state.title,
    price: state.price,
    inventory: state.inventory,
    options: state.options,
    barcode: state.barcode,
    weight: state.weight,
  })
  
  if (state.status === 'archived') {
    variantAggregate.archive()
  }

  const snapshot = variantAggregate.toSnapshot()
  db.run(
    `INSERT OR REPLACE INTO snapshots (aggregate_id, correlation_id, version, payload)
     VALUES (?, ?, ?, ?)`,
    [variantId, correlationId, version, JSON.stringify(snapshot)]
  )
}

describe('productVariantProjection', () => {
  test('should create projection when variant.created event is handled', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const productId = randomUUIDv7()
    const variantId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    
    saveProductSnapshot(db, productId, correlationId, createProductState({ variantIds: [variantId] }))
    
    const priorState = {} as any
    const newState = createVariantState({ productId })
    const event = new VariantCreatedEvent({
      occurredAt: new Date(),
      aggregateId: variantId,
      correlationId,
      version: 0,
      priorState,
      newState,
    })

    // Act
    await productVariantProjection(event, repositories)
    await flushBatch(db, batch)

    // Assert product_variants table
    const productVariants = db.query(
      'SELECT * FROM product_variants WHERE variant_id = ?'
    ).all(variantId) as any[]
    expect(productVariants).toHaveLength(1)
    expect(productVariants[0].variant_id).toBe(variantId)
    expect(productVariants[0].aggregate_id).toBe(productId)
    expect(productVariants[0].title).toBe('Test Product')
    
    db.close()
  })

  test('should delete projection when variant.archived event is handled', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const productId = randomUUIDv7()
    const variantId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    
    saveProductSnapshot(db, productId, correlationId, createProductState({ variantIds: [variantId] }))
    
    // Create initial projection
    const productVariantRepo = new ProductVariantRepository(db, batch)
    productVariantRepo.save({
      aggregate_id: productId,
      title: 'Test Product',
      slug: 'test-product',
      vendor: 'Test Vendor',
      product_type: 'physical',
      short_description: 'A test product',
      tags: ['test'],
      created_at: new Date(),
      status: 'draft',
      correlation_id: correlationId,
      version: 0,
      updated_at: new Date(),
      collection_ids: [],
      meta_title: '',
      meta_description: '',
    }, variantId)
    await flushBatch(db, batch)
    
    const priorState = createVariantState({ productId, status: 'active' })
    const newState = createVariantState({ productId, status: 'archived' })
    const event = new VariantArchivedEvent({
      occurredAt: new Date(),
      aggregateId: variantId,
      correlationId,
      version: 1,
      priorState,
      newState,
    })

    // Act
    await productVariantProjection(event, repositories)
    await flushBatch(db, batch)

    // Assert product_variants table - should be deleted
    const productVariants = db.query(
      'SELECT * FROM product_variants WHERE variant_id = ?'
    ).all(variantId) as any[]
    expect(productVariants).toHaveLength(0)
    
    db.close()
  })

  test('should update projection when variant.details_updated event is handled', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const productId = randomUUIDv7()
    const variantId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    
    saveProductSnapshot(db, productId, correlationId, createProductState({ variantIds: [variantId] }))
    
    const priorState = createVariantState({ productId, title: 'Old Title' })
    const newState = createVariantState({ productId, title: 'New Title' })
    const event = new VariantDetailsUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: variantId,
      correlationId,
      version: 1,
      priorState,
      newState,
    })

    // Act
    await productVariantProjection(event, repositories)
    await flushBatch(db, batch)

    // Assert product_variants table was updated
    const productVariants = db.query(
      'SELECT * FROM product_variants WHERE variant_id = ?'
    ).all(variantId) as any[]
    expect(productVariants).toHaveLength(1)
    expect(productVariants[0].aggregate_id).toBe(productId)
    
    db.close()
  })

  test('should update projection when product.created event is handled', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const productId = randomUUIDv7()
    const variantId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    
    // Save variant snapshot first
    saveVariantSnapshot(db, variantId, correlationId, createVariantState({ productId, status: 'active' }))
    
    // Save product snapshot and product_list_view entry
    saveProductSnapshot(db, productId, correlationId, createProductState({ variantIds: [variantId] }))
    
    const priorState = {} as any
    const newState = createProductState({ variantIds: [variantId] })
    const event = new ProductCreatedEvent({
      occurredAt: new Date(),
      aggregateId: productId,
      correlationId,
      version: 0,
      priorState,
      newState,
    })

    // Act
    await productVariantProjection(event, repositories)
    await flushBatch(db, batch)

    // Assert product_variants table
    const productVariants = db.query(
      'SELECT * FROM product_variants WHERE aggregate_id = ?'
    ).all(productId) as any[]
    expect(productVariants).toHaveLength(1)
    expect(productVariants[0].variant_id).toBe(variantId)
    expect(productVariants[0].aggregate_id).toBe(productId)
    
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
    const variantId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    
    // Save variant snapshot first
    saveVariantSnapshot(db, variantId, correlationId, createVariantState({ productId, status: 'active' }))
    
    // Save product snapshot and product_list_view with old title
    saveProductSnapshot(db, productId, correlationId, createProductState({ variantIds: [variantId], title: 'Old Title' }))
    
    // Update product_list_view with new title to simulate productListViewProjection running first
    const productListViewRepo = new ProductListViewRepository(db, new TransactionBatch())
    const newState = createProductState({ variantIds: [variantId], title: 'New Title' })
    productListViewRepo.save({
      aggregate_id: productId,
      title: newState.title,
      slug: newState.slug,
      vendor: newState.vendor,
      product_type: newState.productType,
      short_description: newState.shortDescription,
      tags: newState.tags,
      created_at: newState.createdAt,
      status: newState.status,
      correlation_id: correlationId,
      version: 1,
      updated_at: newState.updatedAt,
      collection_ids: newState.collectionIds,
      meta_title: newState.metaTitle,
      meta_description: newState.metaDescription,
    })
    await flushBatch(db, productListViewRepo['batch'] as TransactionBatch)
    
    const priorState = createProductState({ variantIds: [variantId], title: 'Old Title' })
    const event = new ProductDetailsUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: productId,
      correlationId,
      version: 1,
      priorState,
      newState,
    })

    // Act
    await productVariantProjection(event, repositories)
    await flushBatch(db, batch)

    // Assert product_variants table was updated
    const productVariants = db.query(
      'SELECT * FROM product_variants WHERE aggregate_id = ?'
    ).all(productId) as any[]
    expect(productVariants).toHaveLength(1)
    expect(productVariants[0].title).toBe('New Title')
    
    db.close()
  })

  test('should not create projection for archived variant when product is created', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const productId = randomUUIDv7()
    const variantId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    
    saveVariantSnapshot(db, variantId, correlationId, createVariantState({ productId, status: 'archived' }))
    
    const priorState = {} as any
    const newState = createProductState({ variantIds: [variantId] })
    const event = new ProductCreatedEvent({
      occurredAt: new Date(),
      aggregateId: productId,
      correlationId,
      version: 0,
      priorState,
      newState,
    })

    // Act
    await productVariantProjection(event, repositories)
    await flushBatch(db, batch)

    // Assert product_variants table - archived variant should not be included
    const productVariants = db.query(
      'SELECT * FROM product_variants WHERE aggregate_id = ?'
    ).all(productId) as any[]
    expect(productVariants).toHaveLength(0)
    
    db.close()
  })
})

