import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDatabase, closeTestDatabase } from '../../helpers/database'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { ProductVariantProjection } from '../../../src/projections/product/productVariantProjection'
import { ProductAggregate } from '../../../src/domain/product/aggregate'
import { VariantAggregate } from '../../../src/domain/variant/aggregate'
import { ProductUpdateProductTaxDetailsEvent } from '../../../src/domain/product/events'

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

function createValidVariantParams(id: string = 'variant-1', productId: string = 'product-123') {
  return {
    id,
    correlationId: 'variant-correlation',
    userId: 'user-123',
    productId,
    sku: `SKU-${id}`,
    price: 10.00,
    inventory: 100,
    options: { Size: 'M' },
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
  await unitOfWork.withTransaction(async ({ snapshotRepository, productListViewRepository }) => {
    const product = ProductAggregate.create(params)
    snapshotRepository.saveSnapshot({
      aggregate_id: product.id,
      correlation_id: params.correlationId,
      version: product.version,
      payload: product.toSnapshot(),
    })

    // Also save to product_list_view for the projection to use
    const snapshot = product.toSnapshot()
    productListViewRepository.save({
      aggregate_id: product.id,
      title: snapshot.title,
      slug: snapshot.slug,
      vendor: snapshot.vendor,
      product_type: snapshot.productType,
      short_description: snapshot.shortDescription,
      tags: snapshot.tags,
      created_at: snapshot.createdAt,
      status: snapshot.status,
      correlation_id: params.correlationId,
      taxable: snapshot.taxable ? 1 : 0,
      fulfillment_type: snapshot.fulfillmentType,
      dropship_safety_buffer: snapshot.dropshipSafetyBuffer ?? null,
      variant_options: snapshot.variantOptions,
      version: product.version,
      updated_at: snapshot.updatedAt,
      collection_ids: snapshot.collectionIds,
      meta_title: snapshot.metaTitle,
      meta_description: snapshot.metaDescription,
    })
  })
}

async function createVariantInDatabase(unitOfWork: UnitOfWork, params: ReturnType<typeof createValidVariantParams>) {
  await unitOfWork.withTransaction(async ({ snapshotRepository }) => {
    const variant = VariantAggregate.create(params)
    snapshotRepository.saveSnapshot({
      aggregate_id: variant.id,
      correlation_id: params.correlationId,
      version: variant.version,
      payload: variant.toSnapshot(),
    })
  })
}

describe('ProductVariantProjection', () => {
  test('should update product-variant relationships when tax details updated', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      productParams.variantIds = ['variant-1']
      await createProductInDatabase(unitOfWork, productParams)
      await createVariantInDatabase(unitOfWork, createValidVariantParams('variant-1', productParams.id))

      let event: ProductUpdateProductTaxDetailsEvent
      await unitOfWork.withTransaction(async ({ snapshotRepository }) => {
        const snapshot = snapshotRepository.getSnapshot(productParams.id)!
        const aggregate = ProductAggregate.loadFromSnapshot(snapshot)
        aggregate.updateProductTaxDetails(false, 'NEW-TAX-ID', 'user-123')
        event = aggregate.uncommittedEvents[0] as ProductUpdateProductTaxDetailsEvent
      })

      // Act
      await unitOfWork.withTransaction(async (repositories) => {
        const projection = new ProductVariantProjection(repositories)
        await projection.execute(event)
      })

      // Assert
      const productVariants = db.query(`
        SELECT * FROM product_variants
        WHERE aggregate_id = ?
      `).all(productParams.id) as any[]

      expect(productVariants).toHaveLength(1)
      expect(productVariants[0].variant_id).toBe('variant-1')
      expect(productVariants[0].aggregate_id).toBe(productParams.id)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should preserve variant relationships', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      productParams.variantIds = ['variant-1', 'variant-2']
      await createProductInDatabase(unitOfWork, productParams)
      await createVariantInDatabase(unitOfWork, createValidVariantParams('variant-1', productParams.id))
      await createVariantInDatabase(unitOfWork, createValidVariantParams('variant-2', productParams.id))

      let event: ProductUpdateProductTaxDetailsEvent
      await unitOfWork.withTransaction(async ({ snapshotRepository }) => {
        const snapshot = snapshotRepository.getSnapshot(productParams.id)!
        const aggregate = ProductAggregate.loadFromSnapshot(snapshot)
        aggregate.updateProductTaxDetails(false, 'NEW-TAX-ID', 'user-123')
        event = aggregate.uncommittedEvents[0] as ProductUpdateProductTaxDetailsEvent
      })

      // Act
      await unitOfWork.withTransaction(async (repositories) => {
        const projection = new ProductVariantProjection(repositories)
        await projection.execute(event)
      })

      // Assert
      const productVariants = db.query(`
        SELECT variant_id FROM product_variants
        WHERE aggregate_id = ?
        ORDER BY variant_id
      `).all(productParams.id) as any[]

      expect(productVariants).toHaveLength(2)
      expect(productVariants[0].variant_id).toBe('variant-1')
      expect(productVariants[1].variant_id).toBe('variant-2')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should skip archived variants', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      productParams.variantIds = ['variant-1', 'variant-2']
      await createProductInDatabase(unitOfWork, productParams)
      await createVariantInDatabase(unitOfWork, createValidVariantParams('variant-1', productParams.id))

      // Create variant-2 and archive it
      await unitOfWork.withTransaction(async ({ snapshotRepository }) => {
        const variant = VariantAggregate.create(createValidVariantParams('variant-2', productParams.id))
        variant.archive('user-123')
        snapshotRepository.saveSnapshot({
          aggregate_id: variant.id,
          correlation_id: 'variant-correlation',
          version: variant.version,
          payload: variant.toSnapshot(),
        })
      })

      let event: ProductUpdateProductTaxDetailsEvent
      await unitOfWork.withTransaction(async ({ snapshotRepository }) => {
        const snapshot = snapshotRepository.getSnapshot(productParams.id)!
        const aggregate = ProductAggregate.loadFromSnapshot(snapshot)
        aggregate.updateProductTaxDetails(false, 'NEW-TAX-ID', 'user-123')
        event = aggregate.uncommittedEvents[0] as ProductUpdateProductTaxDetailsEvent
      })

      // Act
      await unitOfWork.withTransaction(async (repositories) => {
        const projection = new ProductVariantProjection(repositories)
        await projection.execute(event)
      })

      // Assert - Should only have variant-1, not archived variant-2
      const productVariants = db.query(`
        SELECT variant_id FROM product_variants
        WHERE aggregate_id = ?
      `).all(productParams.id) as any[]

      expect(productVariants).toHaveLength(1)
      expect(productVariants[0].variant_id).toBe('variant-1')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should handle products with no variants', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      productParams.variantIds = []
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
        const projection = new ProductVariantProjection(repositories)
        await projection.execute(event)
      })

      // Assert
      const productVariants = db.query(`
        SELECT * FROM product_variants
        WHERE aggregate_id = ?
      `).all(productParams.id) as any[]

      expect(productVariants).toHaveLength(0)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should handle products with multiple variants', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      productParams.variantIds = ['variant-1', 'variant-2', 'variant-3']
      await createProductInDatabase(unitOfWork, productParams)
      await createVariantInDatabase(unitOfWork, createValidVariantParams('variant-1', productParams.id))
      await createVariantInDatabase(unitOfWork, createValidVariantParams('variant-2', productParams.id))
      await createVariantInDatabase(unitOfWork, createValidVariantParams('variant-3', productParams.id))

      let event: ProductUpdateProductTaxDetailsEvent
      await unitOfWork.withTransaction(async ({ snapshotRepository }) => {
        const snapshot = snapshotRepository.getSnapshot(productParams.id)!
        const aggregate = ProductAggregate.loadFromSnapshot(snapshot)
        aggregate.updateProductTaxDetails(false, 'NEW-TAX-ID', 'user-123')
        event = aggregate.uncommittedEvents[0] as ProductUpdateProductTaxDetailsEvent
      })

      // Act
      await unitOfWork.withTransaction(async (repositories) => {
        const projection = new ProductVariantProjection(repositories)
        await projection.execute(event)
      })

      // Assert
      const productVariants = db.query(`
        SELECT variant_id FROM product_variants
        WHERE aggregate_id = ?
        ORDER BY variant_id
      `).all(productParams.id) as any[]

      expect(productVariants).toHaveLength(3)
      expect(productVariants[0].variant_id).toBe('variant-1')
      expect(productVariants[1].variant_id).toBe('variant-2')
      expect(productVariants[2].variant_id).toBe('variant-3')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should delete existing relationships before inserting new ones', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      productParams.variantIds = ['variant-1']
      await createProductInDatabase(unitOfWork, productParams)
      await createVariantInDatabase(unitOfWork, createValidVariantParams('variant-1', productParams.id))
      await createVariantInDatabase(unitOfWork, createValidVariantParams('variant-2', productParams.id))

      // Insert initial relationship
      await unitOfWork.withTransaction(async (repositories) => {
        db.query(`
          INSERT INTO product_variants (aggregate_id, variant_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at, meta_title, meta_description)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          productParams.id,
          'variant-old',
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

      // Update product to have different variant
      let event: ProductUpdateProductTaxDetailsEvent
      await unitOfWork.withTransaction(async ({ snapshotRepository }) => {
        const snapshot = snapshotRepository.getSnapshot(productParams.id)!
        const aggregate = ProductAggregate.loadFromSnapshot(snapshot)
        aggregate.updateProductTaxDetails(false, 'NEW-TAX-ID', 'user-123')
        event = aggregate.uncommittedEvents[0] as ProductUpdateProductTaxDetailsEvent
      })

      // Act
      await unitOfWork.withTransaction(async (repositories) => {
        const projection = new ProductVariantProjection(repositories)
        await projection.execute(event)
      })

      // Assert - Should delete old and insert new
      const productVariants = db.query(`
        SELECT variant_id FROM product_variants
        WHERE aggregate_id = ?
      `).all(productParams.id) as any[]

      expect(productVariants).toHaveLength(1)
      expect(productVariants[0].variant_id).toBe('variant-1')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should skip variants that do not exist', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      productParams.variantIds = ['variant-1', 'non-existent-variant']
      await createProductInDatabase(unitOfWork, productParams)
      await createVariantInDatabase(unitOfWork, createValidVariantParams('variant-1', productParams.id))

      let event: ProductUpdateProductTaxDetailsEvent
      await unitOfWork.withTransaction(async ({ snapshotRepository }) => {
        const snapshot = snapshotRepository.getSnapshot(productParams.id)!
        const aggregate = ProductAggregate.loadFromSnapshot(snapshot)
        aggregate.updateProductTaxDetails(false, 'NEW-TAX-ID', 'user-123')
        event = aggregate.uncommittedEvents[0] as ProductUpdateProductTaxDetailsEvent
      })

      // Act
      await unitOfWork.withTransaction(async (repositories) => {
        const projection = new ProductVariantProjection(repositories)
        await projection.execute(event)
      })

      // Assert - Should only create relationship for existing variant
      const productVariants = db.query(`
        SELECT variant_id FROM product_variants
        WHERE aggregate_id = ?
      `).all(productParams.id) as any[]

      expect(productVariants).toHaveLength(1)
      expect(productVariants[0].variant_id).toBe('variant-1')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should include product metadata in variant relationships', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      productParams.variantIds = ['variant-1']
      await createProductInDatabase(unitOfWork, productParams)
      await createVariantInDatabase(unitOfWork, createValidVariantParams('variant-1', productParams.id))

      let event: ProductUpdateProductTaxDetailsEvent
      await unitOfWork.withTransaction(async ({ snapshotRepository }) => {
        const snapshot = snapshotRepository.getSnapshot(productParams.id)!
        const aggregate = ProductAggregate.loadFromSnapshot(snapshot)
        aggregate.updateProductTaxDetails(false, 'NEW-TAX-ID', 'user-123')
        event = aggregate.uncommittedEvents[0] as ProductUpdateProductTaxDetailsEvent
      })

      // Act
      await unitOfWork.withTransaction(async (repositories) => {
        const projection = new ProductVariantProjection(repositories)
        await projection.execute(event)
      })

      // Assert
      const productVariant = db.query(`
        SELECT * FROM product_variants
        WHERE aggregate_id = ? AND variant_id = ?
      `).get(productParams.id, 'variant-1') as any

      expect(productVariant.title).toBe(productParams.title)
      expect(productVariant.slug).toBe(productParams.slug)
      expect(productVariant.vendor).toBe(productParams.vendor)
      expect(productVariant.product_type).toBe(productParams.productType)
      expect(productVariant.status).toBe('draft')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should handle product not found gracefully', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      // Don't create product in database
      const product = ProductAggregate.create(createValidProductParams())
      product.updateProductTaxDetails(false, 'NEW-TAX-ID', 'user-123')

      const event = product.uncommittedEvents[1] as ProductUpdateProductTaxDetailsEvent

      // Act - Should not throw
      await unitOfWork.withTransaction(async (repositories) => {
        const projection = new ProductVariantProjection(repositories)
        await projection.execute(event)
      })

      // Assert - No relationships created
      const productVariants = db.query(`
        SELECT * FROM product_variants
        WHERE aggregate_id = ?
      `).all(product.id) as any[]

      expect(productVariants).toHaveLength(0)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
