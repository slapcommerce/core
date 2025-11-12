import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { getProductVariantsView } from '../../src/views/productVariantsView'
import { schemas } from '../../src/infrastructure/schemas'

describe('getProductVariantsView', () => {
  let db: Database

  beforeEach(() => {
    db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
  })

  afterEach(() => {
    db.close()
  })

  test('should return all rows when no params are provided', () => {
    // Arrange
    const productId1 = randomUUIDv7()
    const productId2 = randomUUIDv7()
    const variantId1 = randomUUIDv7()
    const variantId2 = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const now = new Date().toISOString()
    
    db.run(
      `INSERT INTO product_variants (aggregate_id, variant_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId1, variantId1, 'Variant 1', 'variant-1', 'Vendor 1', 'physical', 'Variant 1 description', JSON.stringify(['tag1']), now, 'draft', correlationId, 0, now]
    )
    db.run(
      `INSERT INTO product_variants (aggregate_id, variant_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId2, variantId2, 'Variant 2', 'variant-2', 'Vendor 2', 'digital', 'Variant 2 description', JSON.stringify(['tag2']), now, 'active', correlationId, 0, now]
    )

    // Act
    const result = getProductVariantsView(db)

    // Assert
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(2)
    expect(result[0].aggregate_id).toBe(productId1)
    expect(result[1].aggregate_id).toBe(productId2)
  })

  test('should filter by productId', () => {
    // Arrange
    const productId1 = randomUUIDv7()
    const productId2 = randomUUIDv7()
    const variantId1 = randomUUIDv7()
    const variantId2 = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const now = new Date().toISOString()
    
    db.run(
      `INSERT INTO product_variants (aggregate_id, variant_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId1, variantId1, 'Variant 1', 'variant-1', 'Vendor', 'physical', 'Variant 1 description', JSON.stringify(['tag']), now, 'draft', correlationId, 0, now]
    )
    db.run(
      `INSERT INTO product_variants (aggregate_id, variant_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId2, variantId2, 'Variant 2', 'variant-2', 'Vendor', 'physical', 'Variant 2 description', JSON.stringify(['tag']), now, 'draft', correlationId, 0, now]
    )

    // Act
    const result = getProductVariantsView(db, { productId: productId1 })

    // Assert
    expect(result.length).toBe(1)
    expect(result[0].aggregate_id).toBe(productId1)
    expect(result[0].variant_id).toBe(variantId1)
  })

  test('should filter by variantId', () => {
    // Arrange
    const productId = randomUUIDv7()
    const variantId1 = randomUUIDv7()
    const variantId2 = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const now = new Date().toISOString()
    
    db.run(
      `INSERT INTO product_variants (aggregate_id, variant_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId, variantId1, 'Variant 1', 'variant-1', 'Vendor', 'physical', 'Variant 1 description', JSON.stringify(['tag']), now, 'draft', correlationId, 0, now]
    )
    db.run(
      `INSERT INTO product_variants (aggregate_id, variant_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId, variantId2, 'Variant 2', 'variant-2', 'Vendor', 'physical', 'Variant 2 description', JSON.stringify(['tag']), now, 'draft', correlationId, 0, now]
    )

    // Act
    const result = getProductVariantsView(db, { variantId: variantId1 })

    // Assert
    expect(result.length).toBe(1)
    expect(result[0].variant_id).toBe(variantId1)
    expect(result[0].aggregate_id).toBe(productId)
  })

  test('should filter by status draft', () => {
    // Arrange
    const productId1 = randomUUIDv7()
    const productId2 = randomUUIDv7()
    const variantId1 = randomUUIDv7()
    const variantId2 = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const now = new Date().toISOString()
    
    db.run(
      `INSERT INTO product_variants (aggregate_id, variant_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId1, variantId1, 'Variant 1', 'variant-1', 'Vendor', 'physical', 'Variant 1 description', JSON.stringify(['tag']), now, 'draft', correlationId, 0, now]
    )
    db.run(
      `INSERT INTO product_variants (aggregate_id, variant_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId2, variantId2, 'Variant 2', 'variant-2', 'Vendor', 'physical', 'Variant 2 description', JSON.stringify(['tag']), now, 'active', correlationId, 0, now]
    )

    // Act
    const result = getProductVariantsView(db, { status: 'draft' })

    // Assert
    expect(result.length).toBe(1)
    expect(result[0].status).toBe('draft')
    expect(result[0].aggregate_id).toBe(productId1)
  })

  test('should filter by status active', () => {
    // Arrange
    const productId1 = randomUUIDv7()
    const productId2 = randomUUIDv7()
    const variantId1 = randomUUIDv7()
    const variantId2 = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const now = new Date().toISOString()
    
    db.run(
      `INSERT INTO product_variants (aggregate_id, variant_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId1, variantId1, 'Variant 1', 'variant-1', 'Vendor', 'physical', 'Variant 1 description', JSON.stringify(['tag']), now, 'draft', correlationId, 0, now]
    )
    db.run(
      `INSERT INTO product_variants (aggregate_id, variant_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId2, variantId2, 'Variant 2', 'variant-2', 'Vendor', 'physical', 'Variant 2 description', JSON.stringify(['tag']), now, 'active', correlationId, 0, now]
    )

    // Act
    const result = getProductVariantsView(db, { status: 'active' })

    // Assert
    expect(result.length).toBe(1)
    expect(result[0].status).toBe('active')
    expect(result[0].aggregate_id).toBe(productId2)
  })

  test('should filter by status archived', () => {
    // Arrange
    const productId1 = randomUUIDv7()
    const productId2 = randomUUIDv7()
    const variantId1 = randomUUIDv7()
    const variantId2 = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const now = new Date().toISOString()
    
    db.run(
      `INSERT INTO product_variants (aggregate_id, variant_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId1, variantId1, 'Variant 1', 'variant-1', 'Vendor', 'physical', 'Variant 1 description', JSON.stringify(['tag']), now, 'active', correlationId, 0, now]
    )
    db.run(
      `INSERT INTO product_variants (aggregate_id, variant_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId2, variantId2, 'Variant 2', 'variant-2', 'Vendor', 'physical', 'Variant 2 description', JSON.stringify(['tag']), now, 'archived', correlationId, 0, now]
    )

    // Act
    const result = getProductVariantsView(db, { status: 'archived' })

    // Assert
    expect(result.length).toBe(1)
    expect(result[0].status).toBe('archived')
    expect(result[0].aggregate_id).toBe(productId2)
  })

  test('should apply limit pagination', () => {
    // Arrange
    const productId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const now = new Date().toISOString()
    
    for (let i = 0; i < 5; i++) {
      const variantId = randomUUIDv7()
      db.run(
        `INSERT INTO product_variants (aggregate_id, variant_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId, variantId, `Variant ${i}`, `variant-${i}`, 'Vendor', 'physical', `Variant ${i} description`, JSON.stringify(['tag']), now, 'draft', correlationId, 0, now]
      )
    }

    // Act
    const result = getProductVariantsView(db, { limit: 3 })

    // Assert
    expect(result.length).toBe(3)
  })

  test('should apply offset pagination', () => {
    // Arrange
    const productId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const now = new Date().toISOString()
    
    for (let i = 0; i < 5; i++) {
      const variantId = randomUUIDv7()
      db.run(
        `INSERT INTO product_variants (aggregate_id, variant_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId, variantId, `Variant ${i}`, `variant-${i}`, 'Vendor', 'physical', `Variant ${i} description`, JSON.stringify(['tag']), now, 'draft', correlationId, 0, now]
      )
    }

    // Act
    const result = getProductVariantsView(db, { offset: 2 })

    // Assert
    expect(result.length).toBe(3) // Should return remaining 3 after offset
  })

  test('should apply limit and offset together', () => {
    // Arrange
    const productId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const now = new Date().toISOString()
    
    for (let i = 0; i < 5; i++) {
      const variantId = randomUUIDv7()
      db.run(
        `INSERT INTO product_variants (aggregate_id, variant_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId, variantId, `Variant ${i}`, `variant-${i}`, 'Vendor', 'physical', `Variant ${i} description`, JSON.stringify(['tag']), now, 'draft', correlationId, 0, now]
      )
    }

    // Act
    const result = getProductVariantsView(db, { limit: 2, offset: 1 })

    // Assert
    expect(result.length).toBe(2)
  })

  test('should combine multiple filters', () => {
    // Arrange
    const productId1 = randomUUIDv7()
    const productId2 = randomUUIDv7()
    const variantId1 = randomUUIDv7()
    const variantId2 = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const now = new Date().toISOString()
    
    db.run(
      `INSERT INTO product_variants (aggregate_id, variant_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId1, variantId1, 'Variant 1', 'variant-1', 'Vendor', 'physical', 'Variant 1 description', JSON.stringify(['tag']), now, 'draft', correlationId, 0, now]
    )
    db.run(
      `INSERT INTO product_variants (aggregate_id, variant_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId2, variantId2, 'Variant 2', 'variant-2', 'Vendor', 'physical', 'Variant 2 description', JSON.stringify(['tag']), now, 'active', correlationId, 0, now]
    )

    // Act
    const result = getProductVariantsView(db, { productId: productId1, status: 'draft' })

    // Assert
    expect(result.length).toBe(1)
    expect(result[0].aggregate_id).toBe(productId1)
    expect(result[0].status).toBe('draft')
  })

  test('should parse JSON tags field correctly', () => {
    // Arrange
    const productId = randomUUIDv7()
    const variantId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const now = new Date().toISOString()
    const tags = ['tag1', 'tag2', 'tag3']
    
    db.run(
      `INSERT INTO product_variants (aggregate_id, variant_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId, variantId, 'Variant', 'variant', 'Vendor', 'physical', 'Variant description', JSON.stringify(tags), now, 'draft', correlationId, 0, now]
    )

    // Act
    const result = getProductVariantsView(db, { variantId })

    // Assert
    expect(result.length).toBe(1)
    expect(Array.isArray(result[0].tags)).toBe(true)
    expect(result[0].tags).toEqual(tags)
  })

  test('should return empty array when no rows match', () => {
    // Arrange
    const productId = randomUUIDv7()
    const variantId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const now = new Date().toISOString()
    
    db.run(
      `INSERT INTO product_variants (aggregate_id, variant_id, title, slug, vendor, product_type, short_description, tags, created_at, status, correlation_id, version, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId, variantId, 'Variant', 'variant', 'Vendor', 'physical', 'Variant description', JSON.stringify(['tag']), now, 'draft', correlationId, 0, now]
    )

    // Act
    const result = getProductVariantsView(db, { variantId: randomUUIDv7() })

    // Assert
    expect(result.length).toBe(0)
    expect(Array.isArray(result)).toBe(true)
  })
})

