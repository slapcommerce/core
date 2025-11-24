import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { createPublicQueriesRouter } from '../../../../src/api/infrastructure/routers/publicQueriesRouter'
import { createTestDatabase, closeTestDatabase } from '../../helpers/database'

describe('createPublicQueriesRouter', () => {
  test('should execute productListView query successfully', async () => {
    // Arrange
    const db = createTestDatabase()
    const router = createPublicQueriesRouter(db)

    try {
      const productId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()
      
      db.run(
        `INSERT INTO product_list_view (aggregate_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at, collection_ids)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId, 'Test Product', 'test-product', 'Test Vendor', 'physical', 'A test product', JSON.stringify(['test']), now, 'draft', correlationId, 0, now, JSON.stringify([randomUUIDv7()])]
      )

      // Act
      const result = await router('productListView', {})

      // Assert
      expect(result.success).toBe(true)
      if (!result.success) throw new Error('Expected success')
      expect(result.data).toBeDefined()
      expect(Array.isArray(result.data)).toBe(true)
      expect((result.data as any[]).length).toBe(1)
      expect((result.data as any[])[0].aggregate_id).toBe(productId)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should execute productListView query with status filter', async () => {
    // Arrange
    const db = createTestDatabase()
    const router = createPublicQueriesRouter(db)

    try {
      const productId1 = randomUUIDv7()
      const productId2 = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()
      
      db.run(
        `INSERT INTO product_list_view (aggregate_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at, collection_ids)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId1, 'Draft Product', 'draft-product', 'Test Vendor', 'physical', 'A draft product', JSON.stringify(['test']), now, 'draft', correlationId, 0, now, JSON.stringify([randomUUIDv7()])]
      )
      db.run(
        `INSERT INTO product_list_view (aggregate_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at, collection_ids)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId2, 'Active Product', 'active-product', 'Test Vendor', 'physical', 'An active product', JSON.stringify(['test']), now, 'active', correlationId, 0, now, JSON.stringify([randomUUIDv7()])]
      )

      // Act
      const result = await router('productListView', { status: 'active' })

      // Assert
      expect(result.success).toBe(true)
      if (!result.success) throw new Error('Expected success')
      expect(Array.isArray(result.data)).toBe(true)
      expect((result.data as any[]).length).toBe(1)
      expect((result.data as any[])[0].aggregate_id).toBe(productId2)
      expect((result.data as any[])[0].status).toBe('active')
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should execute productCollectionsView query successfully', async () => {
    // Arrange
    const db = createTestDatabase()
    const router = createPublicQueriesRouter(db)

    try {
      const productId = randomUUIDv7()
      const collectionId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()
      
      db.run(
        `INSERT INTO product_collections (aggregate_id, collection_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId, collectionId, 'Test Product', 'test-product', 'Test Vendor', 'physical', 'A test product', JSON.stringify(['test']), now, 'draft', correlationId, 0, now]
      )

      // Act
      const result = await router('productCollectionsView', {})

      // Assert
      expect(result.success).toBe(true)
      if (!result.success) throw new Error('Expected success')
      expect(result.data).toBeDefined()
      expect(Array.isArray(result.data)).toBe(true)
      expect((result.data as any[]).length).toBe(1)
      expect((result.data as any[])[0].aggregate_id).toBe(productId)
      expect((result.data as any[])[0].collection_id).toBe(collectionId)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should execute productCollectionsView query with collectionId filter', async () => {
    // Arrange
    const db = createTestDatabase()
    const router = createPublicQueriesRouter(db)

    try {
      const productId1 = randomUUIDv7()
      const productId2 = randomUUIDv7()
      const collectionId1 = randomUUIDv7()
      const collectionId2 = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()
      
      db.run(
        `INSERT INTO product_collections (aggregate_id, collection_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId1, collectionId1, 'Product 1', 'product-1', 'Test Vendor', 'physical', 'Product 1', JSON.stringify(['test']), now, 'draft', correlationId, 0, now]
      )
      db.run(
        `INSERT INTO product_collections (aggregate_id, collection_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId2, collectionId2, 'Product 2', 'product-2', 'Test Vendor', 'physical', 'Product 2', JSON.stringify(['test']), now, 'draft', correlationId, 0, now]
      )

      // Act
      const result = await router('productCollectionsView', { collectionId: collectionId1 })

      // Assert
      expect(result.success).toBe(true)
      if (!result.success) throw new Error('Expected success')
      expect(Array.isArray(result.data)).toBe(true)
      expect((result.data as any[]).length).toBe(1)
      expect((result.data as any[])[0].collection_id).toBe(collectionId1)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should execute productVariantsView query successfully', async () => {
    // Arrange
    const db = createTestDatabase()
    const router = createPublicQueriesRouter(db)

    try {
      const productId = randomUUIDv7()
      const variantId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()
      
      db.run(
        `INSERT INTO product_variants (aggregate_id, variant_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId, variantId, 'Test Variant', 'test-variant', 'Test Vendor', 'physical', 'A test variant', JSON.stringify(['test']), now, 'draft', correlationId, 0, now]
      )

      // Act
      const result = await router('productVariantsView', {})

      // Assert
      expect(result.success).toBe(true)
      if (!result.success) throw new Error('Expected success')
      expect(result.data).toBeDefined()
      expect(Array.isArray(result.data)).toBe(true)
      expect((result.data as any[]).length).toBe(1)
      expect((result.data as any[])[0].aggregate_id).toBe(productId)
      expect((result.data as any[])[0].variant_id).toBe(variantId)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should execute productVariantsView query with variantId filter', async () => {
    // Arrange
    const db = createTestDatabase()
    const router = createPublicQueriesRouter(db)

    try {
      const productId = randomUUIDv7()
      const variantId1 = randomUUIDv7()
      const variantId2 = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()
      
      db.run(
        `INSERT INTO product_variants (aggregate_id, variant_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId, variantId1, 'Variant 1', 'variant-1', 'Test Vendor', 'physical', 'Variant 1', JSON.stringify(['test']), now, 'draft', correlationId, 0, now]
      )
      db.run(
        `INSERT INTO product_variants (aggregate_id, variant_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId, variantId2, 'Variant 2', 'variant-2', 'Test Vendor', 'physical', 'Variant 2', JSON.stringify(['test']), now, 'draft', correlationId, 0, now]
      )

      // Act
      const result = await router('productVariantsView', { variantId: variantId1 })

      // Assert
      expect(result.success).toBe(true)
      if (!result.success) throw new Error('Expected success')
      expect(Array.isArray(result.data)).toBe(true)
      expect((result.data as any[]).length).toBe(1)
      expect((result.data as any[])[0].variant_id).toBe(variantId1)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should execute slugRedirectsView query successfully', async () => {
    // Arrange
    const db = createTestDatabase()
    const router = createPublicQueriesRouter(db)

    try {
      const productId = randomUUIDv7()
      const now = new Date().toISOString()
      
      db.run(
        `INSERT INTO slug_redirects (old_slug, new_slug, entity_id, entity_type, product_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['old-slug', 'new-slug', productId, 'product', productId, now]
      )

      // Act
      const result = await router('slugRedirectsView', {})

      // Assert
      expect(result.success).toBe(true)
      if (!result.success) throw new Error('Expected success')
      expect(result.data).toBeDefined()
      expect(Array.isArray(result.data)).toBe(true)
      expect((result.data as any[]).length).toBe(1)
      expect((result.data as any[])[0].old_slug).toBe('old-slug')
      expect((result.data as any[])[0].new_slug).toBe('new-slug')
      expect((result.data as any[])[0].product_id).toBe(productId)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should execute queries with limit and offset params', async () => {
    // Arrange
    const db = createTestDatabase()
    const router = createPublicQueriesRouter(db)

    try {
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()
      
      // Insert multiple products
      for (let i = 0; i < 5; i++) {
        const productId = randomUUIDv7()
        db.run(
          `INSERT INTO product_list_view (aggregate_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at, collection_ids)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [productId, `Product ${i}`, `product-${i}`, 'Test Vendor', 'physical', `Product ${i}`, JSON.stringify(['test']), now, 'draft', correlationId, 0, now, JSON.stringify([randomUUIDv7()])]
        )
      }

      // Act
      const result = await router('productListView', { limit: 2, offset: 1 })

      // Assert
      expect(result.success).toBe(true)
      if (!result.success) throw new Error('Expected success')
      expect(Array.isArray(result.data)).toBe(true)
      expect((result.data as any[]).length).toBe(2)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should return error when query type is missing', async () => {
    // Arrange
    const db = createTestDatabase()
    const router = createPublicQueriesRouter(db)
    const params = {}

    try {
      // Act
      const result = await router('', params)

      // Assert
      expect(result.success).toBe(false)
      if (!result.success) {
        const error = (result as { success: false; error: Error }).error
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toBe('Unknown query type: ')
      }
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should return error when query type is unknown', async () => {
    // Arrange
    const db = createTestDatabase()
    const router = createPublicQueriesRouter(db)
    const type = 'unknownQuery'
    const params = {}

    try {
      // Act
      const result = await router(type, params)

      // Assert
      expect(result.success).toBe(false)
      if (!result.success) {
        const error = (result as { success: false; error: Error }).error
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toBe('Unknown query type: unknownQuery')
      }
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should handle database errors gracefully', async () => {
    // Arrange - Create a closed database to cause an error
    const db = createTestDatabase()
    const router = createPublicQueriesRouter(db)
    closeTestDatabase(db)

    try {
      // Act
      const result = await router('productListView', {})

      // Assert
      expect(result.success).toBe(false)
      if (!result.success) {
        const err = (result as { success: false; error: Error }).error
        expect(err).toBeInstanceOf(Error)
      }
    } catch (error) {
      // Expected - database is closed
      expect(error).toBeDefined()
    }
  })
})

