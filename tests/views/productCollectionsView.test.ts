import { describe, test, expect } from 'bun:test'
import { randomUUIDv7 } from 'bun'
import { getProductCollectionsView } from '../../src/views/productCollectionsView'
import { createTestDatabase, closeTestDatabase } from '../helpers/database'

describe('getProductCollectionsView', () => {

  test('should return all rows when no params are provided', () => {
    // Arrange
    const db = createTestDatabase()
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
        [productId1, collectionId1, 'Product 1', 'product-1', 'Vendor 1', 'physical', 'Product 1 description', JSON.stringify(['tag1']), now, 'draft', correlationId, 0, now]
      )
      db.run(
        `INSERT INTO product_collections (aggregate_id, collection_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId2, collectionId2, 'Product 2', 'product-2', 'Vendor 2', 'digital', 'Product 2 description', JSON.stringify(['tag2']), now, 'active', correlationId, 0, now]
      )

      // Act
      const result = getProductCollectionsView(db)

      // Assert
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(2)
      expect(result[0]?.aggregate_id).toBe(productId1)
      expect(result[1]?.aggregate_id).toBe(productId2)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should filter by collectionId', () => {
    // Arrange
    const db = createTestDatabase()
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
        [productId1, collectionId1, 'Product 1', 'product-1', 'Vendor 1', 'physical', 'Product 1 description', JSON.stringify(['tag1']), now, 'draft', correlationId, 0, now]
      )
      db.run(
        `INSERT INTO product_collections (aggregate_id, collection_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId2, collectionId2, 'Product 2', 'product-2', 'Vendor 2', 'digital', 'Product 2 description', JSON.stringify(['tag2']), now, 'active', correlationId, 0, now]
      )

      // Act
      const result = getProductCollectionsView(db, { collectionId: collectionId1 })

      // Assert
      expect(result.length).toBe(1)
      expect(result[0]?.collection_id).toBe(collectionId1)
      expect(result[0]?.aggregate_id).toBe(productId1)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should filter by aggregateId', () => {
    // Arrange
    const db = createTestDatabase()
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
        [productId1, collectionId1, 'Product 1', 'product-1', 'Vendor 1', 'physical', 'Product 1 description', JSON.stringify(['tag1']), now, 'draft', correlationId, 0, now]
      )
      db.run(
        `INSERT INTO product_collections (aggregate_id, collection_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId2, collectionId2, 'Product 2', 'product-2', 'Vendor 2', 'digital', 'Product 2 description', JSON.stringify(['tag2']), now, 'active', correlationId, 0, now]
      )

      // Act
      const result = getProductCollectionsView(db, { aggregateId: productId1 })

      // Assert
      expect(result.length).toBe(1)
      expect(result[0]?.aggregate_id).toBe(productId1)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should filter by status draft', () => {
    // Arrange
    const db = createTestDatabase()
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
        [productId1, collectionId1, 'Product 1', 'product-1', 'Vendor 1', 'physical', 'Product 1 description', JSON.stringify(['tag1']), now, 'draft', correlationId, 0, now]
      )
      db.run(
        `INSERT INTO product_collections (aggregate_id, collection_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId2, collectionId2, 'Product 2', 'product-2', 'Vendor 2', 'digital', 'Product 2 description', JSON.stringify(['tag2']), now, 'active', correlationId, 0, now]
      )

      // Act
      const result = getProductCollectionsView(db, { status: 'draft' })

      // Assert
      expect(result.length).toBe(1)
      expect(result[0]?.status).toBe('draft')
      expect(result[0]?.aggregate_id).toBe(productId1)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should filter by status active', () => {
    // Arrange
    const db = createTestDatabase()
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
        [productId1, collectionId1, 'Product 1', 'product-1', 'Vendor 1', 'physical', 'Product 1 description', JSON.stringify(['tag1']), now, 'draft', correlationId, 0, now]
      )
      db.run(
        `INSERT INTO product_collections (aggregate_id, collection_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId2, collectionId2, 'Product 2', 'product-2', 'Vendor 2', 'digital', 'Product 2 description', JSON.stringify(['tag2']), now, 'active', correlationId, 0, now]
      )

      // Act
      const result = getProductCollectionsView(db, { status: 'active' })

      // Assert
      expect(result.length).toBe(1)
      expect(result[0]?.status).toBe('active')
      expect(result[0]?.aggregate_id).toBe(productId2)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should filter by status archived', () => {
    // Arrange
    const db = createTestDatabase()
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
      [productId1, collectionId1, 'Product 1', 'product-1', 'Vendor 1', 'physical', 'Product 1 description', JSON.stringify(['tag1']), now, 'active', correlationId, 0, now]
    )
    db.run(
      `INSERT INTO product_collections (aggregate_id, collection_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId2, collectionId2, 'Product 2', 'product-2', 'Vendor 2', 'digital', 'Product 2 description', JSON.stringify(['tag2']), now, 'archived', correlationId, 0, now]
    )

      // Act
      const result = getProductCollectionsView(db, { status: 'archived' })

      // Assert
      expect(result.length).toBe(1)
      expect(result[0]?.status).toBe('archived')
      expect(result[0]?.aggregate_id).toBe(productId2)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should apply limit pagination', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()
      
      for (let i = 0; i < 5; i++) {
        const productId = randomUUIDv7()
        const collectionId = randomUUIDv7()
        db.run(
        `INSERT INTO product_collections (aggregate_id, collection_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [productId, collectionId, `Product ${i}`, `product-${i}`, 'Vendor', 'physical', `Product ${i} description`, JSON.stringify(['tag']), now, 'draft', correlationId, 0, now]
        )
      }

      // Act
      const result = getProductCollectionsView(db, { limit: 3 })

      // Assert
      expect(result.length).toBe(3)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should apply offset pagination', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()
      const productIds: string[] = []
      
      for (let i = 0; i < 5; i++) {
        const productId = randomUUIDv7()
        const collectionId = randomUUIDv7()
        productIds.push(productId)
        db.run(
        `INSERT INTO product_collections (aggregate_id, collection_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [productId, collectionId, `Product ${i}`, `product-${i}`, 'Vendor', 'physical', `Product ${i} description`, JSON.stringify(['tag']), now, 'draft', correlationId, 0, now]
        )
      }

      // Act
      const result = getProductCollectionsView(db, { offset: 2 })

      // Assert
      expect(result.length).toBe(3) // Should return remaining 3 after offset
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should apply limit and offset together', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()
      
      for (let i = 0; i < 5; i++) {
        const productId = randomUUIDv7()
        const collectionId = randomUUIDv7()
        db.run(
        `INSERT INTO product_collections (aggregate_id, collection_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [productId, collectionId, `Product ${i}`, `product-${i}`, 'Vendor', 'physical', `Product ${i} description`, JSON.stringify(['tag']), now, 'draft', correlationId, 0, now]
        )
      }

      // Act
      const result = getProductCollectionsView(db, { limit: 2, offset: 1 })

      // Assert
      expect(result.length).toBe(2)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should combine multiple filters', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const productId1 = randomUUIDv7()
      const productId2 = randomUUIDv7()
      const productId3 = randomUUIDv7()
      const collectionId1 = randomUUIDv7()
      const collectionId2 = randomUUIDv7()
      const collectionId3 = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()
      
      db.run(
        `INSERT INTO product_collections (aggregate_id, collection_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId1, collectionId1, 'Product 1', 'product-1', 'Vendor 1', 'physical', 'Product 1 description', JSON.stringify(['tag1']), now, 'draft', correlationId, 0, now]
      )
      db.run(
        `INSERT INTO product_collections (aggregate_id, collection_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId2, collectionId2, 'Product 2', 'product-2', 'Vendor 2', 'digital', 'Product 2 description', JSON.stringify(['tag2']), now, 'active', correlationId, 0, now]
      )
    db.run(
      `INSERT INTO product_collections (aggregate_id, collection_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId3, collectionId3, 'Product 3', 'product-3', 'Vendor 3', 'physical', 'Product 3 description', JSON.stringify(['tag3']), now, 'draft', correlationId, 0, now]
    )

      // Act
      const result = getProductCollectionsView(db, { collectionId: collectionId1, status: 'draft' })

      // Assert
      expect(result.length).toBe(1)
      expect(result[0]?.collection_id).toBe(collectionId1)
      expect(result[0]?.status).toBe('draft')
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should parse JSON tags field correctly', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const productId = randomUUIDv7()
      const collectionId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()
      const tags = ['tag1', 'tag2', 'tag3']
      
      db.run(
        `INSERT INTO product_collections (aggregate_id, collection_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId, collectionId, 'Product', 'product', 'Vendor', 'physical', 'Product description', JSON.stringify(tags), now, 'draft', correlationId, 0, now]
      )

      // Act
      const result = getProductCollectionsView(db, { aggregateId: productId })

      // Assert
      expect(result.length).toBe(1)
      expect(Array.isArray(result[0]?.tags)).toBe(true)
      expect(result[0]?.tags).toEqual(tags)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should return empty array when no rows match', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const productId = randomUUIDv7()
      const collectionId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()
      
      db.run(
        `INSERT INTO product_collections (aggregate_id, collection_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId, collectionId, 'Product', 'product', 'Vendor', 'physical', 'Product description', JSON.stringify(['tag']), now, 'draft', correlationId, 0, now]
      )

      // Act
      const result = getProductCollectionsView(db, { collectionId: randomUUIDv7() })

      // Assert
      expect(result.length).toBe(0)
      expect(Array.isArray(result)).toBe(true)
    } finally {
      closeTestDatabase(db)
    }
  })
})

