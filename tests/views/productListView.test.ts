import { describe, test, expect } from 'bun:test'
import { randomUUIDv7 } from 'bun'
import { getProductListView } from '../../src/views/productListView'
import { createTestDatabase, closeTestDatabase } from '../helpers/database'

describe('getProductListView', () => {
  test('should return all rows when no params are provided', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const productId1 = randomUUIDv7()
      const productId2 = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()
      
      db.run(
      `INSERT INTO product_list_view (aggregate_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at, collection_ids)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId1, 'Product 1', 'product-1', 'Vendor 1', 'physical', 'Product 1 description', JSON.stringify(['tag1']), now, 'draft', correlationId, 0, now, JSON.stringify([randomUUIDv7()])]
    )
    db.run(
      `INSERT INTO product_list_view (aggregate_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at, collection_ids)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId2, 'Product 2', 'product-2', 'Vendor 2', 'digital', 'Product 2 description', JSON.stringify(['tag2']), now, 'active', correlationId, 0, now, JSON.stringify([randomUUIDv7()])]
    )

    // Act
    const result = getProductListView(db)

    // Assert
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(2)
    expect(result[0]!.aggregate_id).toBe(productId1)
    expect(result[1]!.aggregate_id).toBe(productId2)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should filter by status', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const productId1 = randomUUIDv7()
      const productId2 = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()
      
      db.run(
        `INSERT INTO product_list_view (aggregate_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at, collection_ids)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId1, 'Draft Product', 'draft-product', 'Vendor', 'physical', 'Draft product', JSON.stringify(['tag']), now, 'draft', correlationId, 0, now, JSON.stringify([randomUUIDv7()])]
      )
      db.run(
        `INSERT INTO product_list_view (aggregate_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at, collection_ids)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId2, 'Active Product', 'active-product', 'Vendor', 'physical', 'Active product', JSON.stringify(['tag']), now, 'active', correlationId, 0, now, JSON.stringify([randomUUIDv7()])]
      )

      // Act
      const result = getProductListView(db, { status: 'active' })

      // Assert
      expect(result.length).toBe(1)
      expect(result[0]!.status).toBe('active')
      expect(result[0]!.aggregate_id).toBe(productId2)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should filter by vendor', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const productId1 = randomUUIDv7()
      const productId2 = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()
      
      db.run(
      `INSERT INTO product_list_view (aggregate_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at, collection_ids)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId1, 'Product 1', 'product-1', 'Vendor A', 'physical', 'Product 1', JSON.stringify(['tag']), now, 'draft', correlationId, 0, now, JSON.stringify([randomUUIDv7()])]
    )
    db.run(
      `INSERT INTO product_list_view (aggregate_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at, collection_ids)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId2, 'Product 2', 'product-2', 'Vendor B', 'physical', 'Product 2', JSON.stringify(['tag']), now, 'draft', correlationId, 0, now, JSON.stringify([randomUUIDv7()])]
    )

    // Act
    const result = getProductListView(db, { vendor: 'Vendor A' })

    // Assert
    expect(result.length).toBe(1)
    expect(result[0]!.vendor).toBe('Vendor A')
    expect(result[0]!.aggregate_id).toBe(productId1)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should filter by productType', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const productId1 = randomUUIDv7()
      const productId2 = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()
      
      db.run(
      `INSERT INTO product_list_view (aggregate_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at, collection_ids)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId1, 'Physical Product', 'physical-product', 'Vendor', 'physical', 'Physical product', JSON.stringify(['tag']), now, 'draft', correlationId, 0, now, JSON.stringify([randomUUIDv7()])]
    )
    db.run(
      `INSERT INTO product_list_view (aggregate_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at, collection_ids)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId2, 'Digital Product', 'digital-product', 'Vendor', 'digital', 'Digital product', JSON.stringify(['tag']), now, 'draft', correlationId, 0, now, JSON.stringify([randomUUIDv7()])]
    )

    // Act
    const result = getProductListView(db, { productType: 'digital' })

    // Assert
    expect(result.length).toBe(1)
    expect(result[0]!.product_type).toBe('digital')
    expect(result[0]!.aggregate_id).toBe(productId2)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should filter by collectionId using json_each', () => {
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
      `INSERT INTO product_list_view (aggregate_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at, collection_ids)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId1, 'Product 1', 'product-1', 'Vendor', 'physical', 'Product 1', JSON.stringify(['tag']), now, 'draft', correlationId, 0, now, JSON.stringify([collectionId1, randomUUIDv7()])]
    )
    db.run(
      `INSERT INTO product_list_view (aggregate_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at, collection_ids)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId2, 'Product 2', 'product-2', 'Vendor', 'physical', 'Product 2', JSON.stringify(['tag']), now, 'draft', correlationId, 0, now, JSON.stringify([collectionId2])]
    )

    // Act
    const result = getProductListView(db, { collectionId: collectionId1 })

    // Assert
    expect(result.length).toBe(1)
    expect(result[0]!.aggregate_id).toBe(productId1)
    expect(result[0]!.collection_ids).toContain(collectionId1)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should filter by collectionId with additional filters', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const productId1 = randomUUIDv7()
    const productId2 = randomUUIDv7()
    const collectionId1 = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const now = new Date().toISOString()
    
    db.run(
      `INSERT INTO product_list_view (aggregate_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at, collection_ids)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId1, 'Product 1', 'product-1', 'Vendor A', 'physical', 'Product 1', JSON.stringify(['tag']), now, 'active', correlationId, 0, now, JSON.stringify([collectionId1])]
    )
    db.run(
      `INSERT INTO product_list_view (aggregate_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at, collection_ids)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId2, 'Product 2', 'product-2', 'Vendor B', 'physical', 'Product 2', JSON.stringify(['tag']), now, 'draft', correlationId, 0, now, JSON.stringify([collectionId1])]
    )

    // Act
    const result = getProductListView(db, { collectionId: collectionId1, status: 'active' })

    // Assert
    expect(result.length).toBe(1)
    expect(result[0]!.aggregate_id).toBe(productId1)
    expect(result[0]!.status).toBe('active')
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
        db.run(
        `INSERT INTO product_list_view (aggregate_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at, collection_ids)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId, `Product ${i}`, `product-${i}`, 'Vendor', 'physical', `Product ${i}`, JSON.stringify(['tag']), now, 'draft', correlationId, 0, now, JSON.stringify([randomUUIDv7()])]
      )
    }

    // Act
    const result = getProductListView(db, { limit: 3 })

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
      
      for (let i = 0; i < 5; i++) {
        const productId = randomUUIDv7()
        db.run(
        `INSERT INTO product_list_view (aggregate_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at, collection_ids)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId, `Product ${i}`, `product-${i}`, 'Vendor', 'physical', `Product ${i}`, JSON.stringify(['tag']), now, 'draft', correlationId, 0, now, JSON.stringify([randomUUIDv7()])]
      )
    }

    // Act
    const result = getProductListView(db, { offset: 2 })

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
        db.run(
        `INSERT INTO product_list_view (aggregate_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at, collection_ids)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId, `Product ${i}`, `product-${i}`, 'Vendor', 'physical', `Product ${i}`, JSON.stringify(['tag']), now, 'draft', correlationId, 0, now, JSON.stringify([randomUUIDv7()])]
      )
    }

    // Act
    const result = getProductListView(db, { limit: 2, offset: 1 })

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
    const correlationId = randomUUIDv7()
    const now = new Date().toISOString()
    
    db.run(
      `INSERT INTO product_list_view (aggregate_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at, collection_ids)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId1, 'Product 1', 'product-1', 'Vendor A', 'physical', 'Product 1', JSON.stringify(['tag1']), now, 'draft', correlationId, 0, now, JSON.stringify([randomUUIDv7()])]
    )
    db.run(
      `INSERT INTO product_list_view (aggregate_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at, collection_ids)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId2, 'Product 2', 'product-2', 'Vendor A', 'digital', 'Product 2', JSON.stringify(['tag2']), now, 'draft', correlationId, 0, now, JSON.stringify([randomUUIDv7()])]
    )
    db.run(
      `INSERT INTO product_list_view (aggregate_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at, collection_ids)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId3, 'Product 3', 'product-3', 'Vendor B', 'physical', 'Product 3', JSON.stringify(['tag3']), now, 'draft', correlationId, 0, now, JSON.stringify([randomUUIDv7()])]
    )

    // Act
    const result = getProductListView(db, { vendor: 'Vendor A', productType: 'physical' })

    // Assert
    expect(result.length).toBe(1)
    expect(result[0]!.vendor).toBe('Vendor A')
    expect(result[0]!.product_type).toBe('physical')
    expect(result[0]!.aggregate_id).toBe(productId1)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should parse JSON tags field correctly', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const productId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()
      const tags = ['tag1', 'tag2', 'tag3']
      
      db.run(
        `INSERT INTO product_list_view (aggregate_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at, collection_ids)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId, 'Product', 'product', 'Vendor', 'physical', 'Product description', JSON.stringify(tags), now, 'draft', correlationId, 0, now, JSON.stringify([randomUUIDv7()])]
      )

      // Act
      const result = getProductListView(db, { vendor: 'Vendor' })

      // Assert
      expect(result.length).toBe(1)
      expect(Array.isArray(result[0]!.tags)).toBe(true)
      expect(result[0]!.tags).toEqual(tags)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should parse JSON collection_ids field correctly', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const productId = randomUUIDv7()
      const collectionId1 = randomUUIDv7()
      const collectionId2 = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()
      const collectionIds = [collectionId1, collectionId2]
      
      db.run(
        `INSERT INTO product_list_view (aggregate_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at, collection_ids)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId, 'Product', 'product', 'Vendor', 'physical', 'Product description', JSON.stringify(['tag']), now, 'draft', correlationId, 0, now, JSON.stringify(collectionIds)]
      )

      // Act
      const result = getProductListView(db, { vendor: 'Vendor' })

      // Assert
      expect(result.length).toBe(1)
      expect(Array.isArray(result[0]!.collection_ids)).toBe(true)
      expect(result[0]!.collection_ids).toEqual(collectionIds)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should return empty array when no rows match', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const productId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()
      
      db.run(
        `INSERT INTO product_list_view (aggregate_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at, collection_ids)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId, 'Product', 'product', 'Vendor', 'physical', 'Product description', JSON.stringify(['tag']), now, 'draft', correlationId, 0, now, JSON.stringify([randomUUIDv7()])]
      )

      // Act
      const result = getProductListView(db, { vendor: 'NonExistent Vendor' })

      // Assert
      expect(result.length).toBe(0)
      expect(Array.isArray(result)).toBe(true)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should handle "undefined" string in JSON fields gracefully', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const productId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()
      
      // Insert "undefined" (as a string) into JSON columns
      db.run(
        `INSERT INTO product_list_view (aggregate_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at, collection_ids, variant_options)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId, 'Product', 'product', 'Vendor', 'physical', 'Product description', "undefined", now, 'draft', correlationId, 0, now, "undefined", "undefined"]
      )

      // Act
      const result = getProductListView(db)

      // Assert
      expect(result.length).toBe(1)
      expect(result[0]!.tags).toEqual([])
      expect(result[0]!.collection_ids).toEqual([])
      expect(result[0]!.variant_options).toEqual([])
    } finally {
      closeTestDatabase(db)
    }
  })
})

