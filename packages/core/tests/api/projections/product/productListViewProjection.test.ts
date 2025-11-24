import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDatabase, closeTestDatabase } from '../../helpers/database'
import { TransactionBatcher } from '../../../../src/api/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../../src/api/infrastructure/unitOfWork'
import { ProductListViewProjection } from '../../../../src/api/projections/product/productListViewProjection'
import { ProductAggregate } from '../../../../src/api/domain/product/aggregate'
import { CollectionAggregate } from '../../../../src/api/domain/collection/aggregate'
import { ProductUpdateProductTaxDetailsEvent } from '../../../../src/api/domain/product/events'

function createValidProductParams() {
  return {
    id: 'product-123',
    correlationId: 'correlation-123',
    userId: 'user-123',
    title: 'Test Product',
    shortDescription: 'A test product',
    slug: 'test-product',
    collectionIds: ['collection-1'],
    variantIds: ['variant-1'],
    richDescriptionUrl: 'https://example.com/description',
    productType: 'physical',
    fulfillmentType: 'digital' as const,
    vendor: 'Test Vendor',
    variantOptions: [{ name: 'Size', values: ['S', 'M', 'L'] }],
    metaTitle: 'Test Product Meta',
    metaDescription: 'Test product description',
    tags: ['tag1', 'tag2'],
    taxable: true,
    taxId: 'TAX123',
    dropshipSafetyBuffer: 2,
  }
}

function createValidCollectionParams(id: string = 'collection-1') {
  return {
    id,
    correlationId: 'collection-correlation',
    userId: 'user-123',
    name: 'Test Collection',
    slug: 'test-collection',
    description: 'A test collection',
    productIds: [],
    metaTitle: 'Test Collection Meta',
    metaDescription: 'Test collection description',
    tags: [],
  }
}

async function setupTestEnvironment() {
  const db = createTestDatabase()
  const batcher = new TransactionBatcher(db, {
    flushIntervalMs: 50,
    batchSizeThreshold: 10,
    maxQueueDepth: 100
  })
  batcher.start()
  const unitOfWork = new UnitOfWork(db, batcher)
  return { db, batcher, unitOfWork }
}

async function createProductInDatabase(unitOfWork: UnitOfWork, params: ReturnType<typeof createValidProductParams>) {
  await unitOfWork.withTransaction(async ({ snapshotRepository }) => {
    const product = ProductAggregate.create(params)
    snapshotRepository.saveSnapshot({
      aggregate_id: product.id,
      correlation_id: params.correlationId,
      version: product.version,
      payload: product.toSnapshot(),
    })
  })
}

async function createCollectionInDatabase(unitOfWork: UnitOfWork, params: ReturnType<typeof createValidCollectionParams>) {
  await unitOfWork.withTransaction(async ({ snapshotRepository }) => {
    const collection = CollectionAggregate.create(params)
    snapshotRepository.saveSnapshot({
      aggregate_id: collection.id,
      correlation_id: params.correlationId,
      version: collection.version,
      payload: collection.toSnapshot(),
    })
  })
}

describe('ProductListViewProjection', () => {
  test('should update product list view when tax details updated', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      productParams.taxable = true
      productParams.taxId = 'OLD-TAX-ID'
      await createProductInDatabase(unitOfWork, productParams)
      await createCollectionInDatabase(unitOfWork, createValidCollectionParams('collection-1'))

      // Create the product aggregate and update tax details
      let event: ProductUpdateProductTaxDetailsEvent
      await unitOfWork.withTransaction(async ({ snapshotRepository }) => {
        const snapshot = snapshotRepository.getSnapshot(productParams.id)!
        const aggregate = ProductAggregate.loadFromSnapshot(snapshot)
        aggregate.updateProductTaxDetails(false, 'NEW-TAX-ID', 'user-123')
        event = aggregate.uncommittedEvents[0] as ProductUpdateProductTaxDetailsEvent
      })

      // Act - Apply the projection
      await unitOfWork.withTransaction(async (repositories) => {
        const projection = new ProductListViewProjection(repositories)
        await projection.execute(event)
      })

      // Assert
      const productView = db.query(`
        SELECT * FROM product_list_view
        WHERE aggregate_id = ?
      `).get(productParams.id) as any

      expect(productView).not.toBeNull()
      expect(productView.taxable).toBe(0) // false stored as 0
      expect(productView.aggregate_id).toBe(productParams.id)
      expect(productView.title).toBe(productParams.title)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should update taxable field in view', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      productParams.taxable = true
      await createProductInDatabase(unitOfWork, productParams)
      await createCollectionInDatabase(unitOfWork, createValidCollectionParams('collection-1'))

      let event: ProductUpdateProductTaxDetailsEvent
      await unitOfWork.withTransaction(async ({ snapshotRepository }) => {
        const snapshot = snapshotRepository.getSnapshot(productParams.id)!
        const aggregate = ProductAggregate.loadFromSnapshot(snapshot)
        aggregate.updateProductTaxDetails(false, 'NEW-TAX-ID', 'user-123')
        event = aggregate.uncommittedEvents[0] as ProductUpdateProductTaxDetailsEvent
      })

      // Act
      await unitOfWork.withTransaction(async (repositories) => {
        const projection = new ProductListViewProjection(repositories)
        await projection.execute(event)
      })

      // Assert
      const productView = db.query(`
        SELECT taxable FROM product_list_view
        WHERE aggregate_id = ?
      `).get(productParams.id) as any

      expect(productView.taxable).toBe(0) // false
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should preserve other product fields', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      await createProductInDatabase(unitOfWork, productParams)
      await createCollectionInDatabase(unitOfWork, createValidCollectionParams('collection-1'))

      let event: ProductUpdateProductTaxDetailsEvent
      await unitOfWork.withTransaction(async ({ snapshotRepository }) => {
        const snapshot = snapshotRepository.getSnapshot(productParams.id)!
        const aggregate = ProductAggregate.loadFromSnapshot(snapshot)
        aggregate.updateProductTaxDetails(false, 'NEW-TAX-ID', 'user-123')
        event = aggregate.uncommittedEvents[0] as ProductUpdateProductTaxDetailsEvent
      })

      // Act
      await unitOfWork.withTransaction(async (repositories) => {
        const projection = new ProductListViewProjection(repositories)
        await projection.execute(event)
      })

      // Assert
      const productView = db.query(`
        SELECT * FROM product_list_view
        WHERE aggregate_id = ?
      `).get(productParams.id) as any

      expect(productView.title).toBe(productParams.title)
      expect(productView.slug).toBe(productParams.slug)
      expect(productView.vendor).toBe(productParams.vendor)
      expect(productView.product_type).toBe(productParams.productType)
      expect(productView.short_description).toBe(productParams.shortDescription)
      expect(productView.status).toBe('draft')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should update product-collection relationships', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      productParams.collectionIds = ['collection-1']
      await createProductInDatabase(unitOfWork, productParams)
      await createCollectionInDatabase(unitOfWork, createValidCollectionParams('collection-1'))

      let event: ProductUpdateProductTaxDetailsEvent
      await unitOfWork.withTransaction(async ({ snapshotRepository }) => {
        const snapshot = snapshotRepository.getSnapshot(productParams.id)!
        const aggregate = ProductAggregate.loadFromSnapshot(snapshot)
        aggregate.updateProductTaxDetails(false, 'NEW-TAX-ID', 'user-123')
        event = aggregate.uncommittedEvents[0] as ProductUpdateProductTaxDetailsEvent
      })

      // Act
      await unitOfWork.withTransaction(async (repositories) => {
        const projection = new ProductListViewProjection(repositories)
        await projection.execute(event)
      })

      // Assert
      const productCollections = db.query(`
        SELECT * FROM product_collections
        WHERE aggregate_id = ?
      `).all(productParams.id) as any[]

      expect(productCollections).toHaveLength(1)
      expect(productCollections[0].collection_id).toBe('collection-1')
      expect(productCollections[0].aggregate_id).toBe(productParams.id)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should handle products with multiple collections', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      productParams.collectionIds = ['collection-1', 'collection-2', 'collection-3']
      await createProductInDatabase(unitOfWork, productParams)
      await createCollectionInDatabase(unitOfWork, createValidCollectionParams('collection-1'))
      await createCollectionInDatabase(unitOfWork, createValidCollectionParams('collection-2'))
      await createCollectionInDatabase(unitOfWork, createValidCollectionParams('collection-3'))

      let event: ProductUpdateProductTaxDetailsEvent
      await unitOfWork.withTransaction(async ({ snapshotRepository }) => {
        const snapshot = snapshotRepository.getSnapshot(productParams.id)!
        const aggregate = ProductAggregate.loadFromSnapshot(snapshot)
        aggregate.updateProductTaxDetails(false, 'NEW-TAX-ID', 'user-123')
        event = aggregate.uncommittedEvents[0] as ProductUpdateProductTaxDetailsEvent
      })

      // Act
      await unitOfWork.withTransaction(async (repositories) => {
        const projection = new ProductListViewProjection(repositories)
        await projection.execute(event)
      })

      // Assert
      const productCollections = db.query(`
        SELECT collection_id FROM product_collections
        WHERE aggregate_id = ?
        ORDER BY collection_id
      `).all(productParams.id) as any[]

      expect(productCollections).toHaveLength(3)
      expect(productCollections[0].collection_id).toBe('collection-1')
      expect(productCollections[1].collection_id).toBe('collection-2')
      expect(productCollections[2].collection_id).toBe('collection-3')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should handle products with collections that get removed', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      productParams.collectionIds = ['collection-1']
      await createProductInDatabase(unitOfWork, productParams)
      await createCollectionInDatabase(unitOfWork, createValidCollectionParams('collection-1'))

      // Now update product to remove all collections (set to a single non-existent one)
      let event: ProductUpdateProductTaxDetailsEvent
      await unitOfWork.withTransaction(async ({ snapshotRepository }) => {
        const snapshot = snapshotRepository.getSnapshot(productParams.id)!
        const aggregate = ProductAggregate.loadFromSnapshot(snapshot)
        // Update collections first to remove them
        aggregate.updateCollections([], 'user-123')
        aggregate.updateProductTaxDetails(false, 'NEW-TAX-ID', 'user-123')
        event = aggregate.uncommittedEvents[1] as ProductUpdateProductTaxDetailsEvent
      })

      // Act
      await unitOfWork.withTransaction(async (repositories) => {
        const projection = new ProductListViewProjection(repositories)
        await projection.execute(event)
      })

      // Assert - Should still update product_list_view
      const productView = db.query(`
        SELECT * FROM product_list_view
        WHERE aggregate_id = ?
      `).get(productParams.id) as any

      expect(productView).not.toBeNull()
      expect(productView.taxable).toBe(0)

      // Should have no product-collection relationships
      const productCollections = db.query(`
        SELECT * FROM product_collections
        WHERE aggregate_id = ?
      `).all(productParams.id) as any[]

      expect(productCollections).toHaveLength(0)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should handle collections that do not exist', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      productParams.collectionIds = ['non-existent-collection']
      await createProductInDatabase(unitOfWork, productParams)

      let event: ProductUpdateProductTaxDetailsEvent
      await unitOfWork.withTransaction(async ({ snapshotRepository }) => {
        const snapshot = snapshotRepository.getSnapshot(productParams.id)!
        const aggregate = ProductAggregate.loadFromSnapshot(snapshot)
        aggregate.updateProductTaxDetails(false, 'NEW-TAX-ID', 'user-123')
        event = aggregate.uncommittedEvents[0] as ProductUpdateProductTaxDetailsEvent
      })

      // Act
      await unitOfWork.withTransaction(async (repositories) => {
        const projection = new ProductListViewProjection(repositories)
        await projection.execute(event)
      })

      // Assert - Should still update product_list_view
      const productView = db.query(`
        SELECT * FROM product_list_view
        WHERE aggregate_id = ?
      `).get(productParams.id) as any

      expect(productView).not.toBeNull()

      // Should have no product-collection relationships for non-existent collections
      const productCollections = db.query(`
        SELECT * FROM product_collections
        WHERE aggregate_id = ?
      `).all(productParams.id) as any[]

      expect(productCollections).toHaveLength(0)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should update version in view', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      await createProductInDatabase(unitOfWork, productParams)
      await createCollectionInDatabase(unitOfWork, createValidCollectionParams('collection-1'))

      let event: ProductUpdateProductTaxDetailsEvent
      await unitOfWork.withTransaction(async ({ snapshotRepository }) => {
        const snapshot = snapshotRepository.getSnapshot(productParams.id)!
        const aggregate = ProductAggregate.loadFromSnapshot(snapshot)
        aggregate.updateProductTaxDetails(false, 'NEW-TAX-ID', 'user-123')
        event = aggregate.uncommittedEvents[0] as ProductUpdateProductTaxDetailsEvent
      })

      // Act
      await unitOfWork.withTransaction(async (repositories) => {
        const projection = new ProductListViewProjection(repositories)
        await projection.execute(event)
      })

      // Assert
      const productView = db.query(`
        SELECT version FROM product_list_view
        WHERE aggregate_id = ?
      `).get(productParams.id) as any

      expect(productView.version).toBe(1) // Version incremented from 0 to 1
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should replace existing product-collection relationships', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      productParams.collectionIds = ['collection-1']
      await createProductInDatabase(unitOfWork, productParams)
      await createCollectionInDatabase(unitOfWork, createValidCollectionParams('collection-1'))
      await createCollectionInDatabase(unitOfWork, createValidCollectionParams('collection-2'))

      // First, insert initial product-collection relationships
      await unitOfWork.withTransaction(async (repositories) => {
        db.query(`
          INSERT INTO product_collections (aggregate_id, collection_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at, meta_title, meta_description)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          productParams.id,
          'collection-1',
          'Test',
          'test',
          'Vendor',
          'physical',
          'desc',
          '[]',
          new Date().toISOString(),
          'draft',
          'corr',
          0,
          new Date().toISOString(),
          'meta',
          'meta'
        )
      })

      // Update product to have different collection
      let taxEvent: ProductUpdateProductTaxDetailsEvent
      await unitOfWork.withTransaction(async ({ snapshotRepository }) => {
        const snapshot = snapshotRepository.getSnapshot(productParams.id)!
        const aggregate = ProductAggregate.loadFromSnapshot(snapshot)
        // Update collections first
        aggregate.updateCollections(['collection-2'], 'user-123')
        // Then update tax details
        aggregate.updateProductTaxDetails(false, 'NEW-TAX-ID', 'user-123')
        taxEvent = aggregate.uncommittedEvents[1] as ProductUpdateProductTaxDetailsEvent
      })

      // Act
      await unitOfWork.withTransaction(async (repositories) => {
        const projection = new ProductListViewProjection(repositories)
        await projection.execute(taxEvent)
      })

      // Assert - Should delete old relationships and create new ones
      const productCollections = db.query(`
        SELECT collection_id FROM product_collections
        WHERE aggregate_id = ?
      `).all(productParams.id) as any[]

      expect(productCollections).toHaveLength(1)
      expect(productCollections[0].collection_id).toBe('collection-2')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
