import { describe, test, expect } from 'bun:test'
import { randomUUIDv7 } from 'bun'
import { getVariantsView } from '../../src/views/variantsView'
import { createTestDatabase, closeTestDatabase } from '../helpers/database'

describe('getVariantsView', () => {
  test('should return all variants when no params are provided', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const variantId1 = randomUUIDv7()
      const variantId2 = randomUUIDv7()
      const productId1 = randomUUIDv7()
      const productId2 = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()

      db.run(
        `INSERT INTO variant_details_view (aggregate_id, product_id, sku, title, price, inventory, options, barcode, weight, status, correlation_id, version, created_at, updated_at, images)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [variantId1, productId1, 'SKU-001', 'Variant 1', 29.99, 100, JSON.stringify({ Size: 'M' }), '123456', 1.5, 'active', correlationId, 0, now, now, null]
      )
      db.run(
        `INSERT INTO variant_details_view (aggregate_id, product_id, sku, title, price, inventory, options, barcode, weight, status, correlation_id, version, created_at, updated_at, images)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [variantId2, productId2, 'SKU-002', 'Variant 2', 39.99, 50, JSON.stringify({ Size: 'L' }), '654321', 2.0, 'draft', correlationId, 0, now, now, null]
      )

      // Act
      const result = getVariantsView(db)

      // Assert
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(2)
      expect(result[0]!.aggregate_id).toBe(variantId1)
      expect(result[1]!.aggregate_id).toBe(variantId2)
      expect(result[0]!.variant_id).toBe(variantId1)
      expect(result[1]!.variant_id).toBe(variantId2)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should filter by variantId', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const variantId1 = randomUUIDv7()
      const variantId2 = randomUUIDv7()
      const productId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()

      db.run(
        `INSERT INTO variant_details_view (aggregate_id, product_id, sku, title, price, inventory, options, barcode, weight, status, correlation_id, version, created_at, updated_at, images)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [variantId1, productId, 'SKU-001', 'Variant 1', 29.99, 100, JSON.stringify({ Size: 'M' }), '123456', 1.5, 'active', correlationId, 0, now, now, null]
      )
      db.run(
        `INSERT INTO variant_details_view (aggregate_id, product_id, sku, title, price, inventory, options, barcode, weight, status, correlation_id, version, created_at, updated_at, images)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [variantId2, productId, 'SKU-002', 'Variant 2', 39.99, 50, JSON.stringify({ Size: 'L' }), '654321', 2.0, 'draft', correlationId, 0, now, now, null]
      )

      // Act
      const result = getVariantsView(db, { variantId: variantId1 })

      // Assert
      expect(result.length).toBe(1)
      expect(result[0]!.aggregate_id).toBe(variantId1)
      expect(result[0]!.title).toBe('Variant 1')
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should filter by productId', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const variantId1 = randomUUIDv7()
      const variantId2 = randomUUIDv7()
      const productId1 = randomUUIDv7()
      const productId2 = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()

      db.run(
        `INSERT INTO variant_details_view (aggregate_id, product_id, sku, title, price, inventory, options, barcode, weight, status, correlation_id, version, created_at, updated_at, images)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [variantId1, productId1, 'SKU-001', 'Variant 1', 29.99, 100, JSON.stringify({ Size: 'M' }), '123456', 1.5, 'active', correlationId, 0, now, now, null]
      )
      db.run(
        `INSERT INTO variant_details_view (aggregate_id, product_id, sku, title, price, inventory, options, barcode, weight, status, correlation_id, version, created_at, updated_at, images)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [variantId2, productId2, 'SKU-002', 'Variant 2', 39.99, 50, JSON.stringify({ Size: 'L' }), '654321', 2.0, 'draft', correlationId, 0, now, now, null]
      )

      // Act
      const result = getVariantsView(db, { productId: productId1 })

      // Assert
      expect(result.length).toBe(1)
      expect(result[0]!.product_id).toBe(productId1)
      expect(result[0]!.aggregate_id).toBe(variantId1)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should filter by status', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const variantId1 = randomUUIDv7()
      const variantId2 = randomUUIDv7()
      const productId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()

      db.run(
        `INSERT INTO variant_details_view (aggregate_id, product_id, sku, title, price, inventory, options, barcode, weight, status, correlation_id, version, created_at, updated_at, images)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [variantId1, productId, 'SKU-001', 'Active Variant', 29.99, 100, JSON.stringify({ Size: 'M' }), '123456', 1.5, 'active', correlationId, 0, now, now, null]
      )
      db.run(
        `INSERT INTO variant_details_view (aggregate_id, product_id, sku, title, price, inventory, options, barcode, weight, status, correlation_id, version, created_at, updated_at, images)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [variantId2, productId, 'SKU-002', 'Draft Variant', 39.99, 50, JSON.stringify({ Size: 'L' }), '654321', 2.0, 'draft', correlationId, 0, now, now, null]
      )

      // Act
      const result = getVariantsView(db, { status: 'active' })

      // Assert
      expect(result.length).toBe(1)
      expect(result[0]!.status).toBe('active')
      expect(result[0]!.aggregate_id).toBe(variantId1)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should filter by SKU', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const variantId1 = randomUUIDv7()
      const variantId2 = randomUUIDv7()
      const productId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()

      db.run(
        `INSERT INTO variant_details_view (aggregate_id, product_id, sku, title, price, inventory, options, barcode, weight, status, correlation_id, version, created_at, updated_at, images)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [variantId1, productId, 'UNIQUE-SKU-001', 'Variant 1', 29.99, 100, JSON.stringify({ Size: 'M' }), '123456', 1.5, 'active', correlationId, 0, now, now, null]
      )
      db.run(
        `INSERT INTO variant_details_view (aggregate_id, product_id, sku, title, price, inventory, options, barcode, weight, status, correlation_id, version, created_at, updated_at, images)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [variantId2, productId, 'UNIQUE-SKU-002', 'Variant 2', 39.99, 50, JSON.stringify({ Size: 'L' }), '654321', 2.0, 'draft', correlationId, 0, now, now, null]
      )

      // Act
      const result = getVariantsView(db, { sku: 'UNIQUE-SKU-001' })

      // Assert
      expect(result.length).toBe(1)
      expect(result[0]!.sku).toBe('UNIQUE-SKU-001')
      expect(result[0]!.aggregate_id).toBe(variantId1)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should apply limit pagination', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const productId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()

      for (let i = 0; i < 5; i++) {
        const variantId = randomUUIDv7()
        db.run(
          `INSERT INTO variant_details_view (aggregate_id, product_id, sku, title, price, inventory, options, barcode, weight, status, correlation_id, version, created_at, updated_at, images)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [variantId, productId, `SKU-00${i}`, `Variant ${i}`, 29.99, 100, JSON.stringify({ Size: 'M' }), `12345${i}`, 1.5, 'active', correlationId, 0, now, now, null]
        )
      }

      // Act
      const result = getVariantsView(db, { limit: 3 })

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
      const productId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()

      for (let i = 0; i < 5; i++) {
        const variantId = randomUUIDv7()
        db.run(
          `INSERT INTO variant_details_view (aggregate_id, product_id, sku, title, price, inventory, options, barcode, weight, status, correlation_id, version, created_at, updated_at, images)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [variantId, productId, `SKU-00${i}`, `Variant ${i}`, 29.99, 100, JSON.stringify({ Size: 'M' }), `12345${i}`, 1.5, 'active', correlationId, 0, now, now, null]
        )
      }

      // Act
      const result = getVariantsView(db, { offset: 2 })

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
      const productId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()

      for (let i = 0; i < 5; i++) {
        const variantId = randomUUIDv7()
        db.run(
          `INSERT INTO variant_details_view (aggregate_id, product_id, sku, title, price, inventory, options, barcode, weight, status, correlation_id, version, created_at, updated_at, images)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [variantId, productId, `SKU-00${i}`, `Variant ${i}`, 29.99, 100, JSON.stringify({ Size: 'M' }), `12345${i}`, 1.5, 'active', correlationId, 0, now, now, null]
        )
      }

      // Act
      const result = getVariantsView(db, { limit: 2, offset: 1 })

      // Assert
      expect(result.length).toBe(2)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should map data correctly from table', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const variantId = randomUUIDv7()
      const productId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()

      db.run(
        `INSERT INTO variant_details_view (aggregate_id, product_id, sku, title, price, inventory, options, barcode, weight, status, correlation_id, version, created_at, updated_at, images)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [variantId, productId, 'TEST-SKU', 'Test Variant', 49.99, 75, JSON.stringify({ Size: 'XL', Color: 'Blue' }), '999888777', 2.5, 'active', correlationId, 1, now, now, null]
      )

      // Act
      const result = getVariantsView(db, { variantId })

      // Assert
      expect(result.length).toBe(1)
      const variant = result[0]!
      expect(variant.aggregate_id).toBe(variantId)
      expect(variant.variant_id).toBe(variantId)
      expect(variant.product_id).toBe(productId)
      expect(variant.sku).toBe('TEST-SKU')
      expect(variant.title).toBe('Test Variant')
      expect(variant.price).toBe(49.99)
      expect(variant.inventory).toBe(75)
      expect(variant.options).toEqual({ Size: 'XL', Color: 'Blue' })
      expect(variant.barcode).toBe('999888777')
      expect(variant.weight).toBe(2.5)
      expect(variant.status).toBe('active')
      expect(variant.correlation_id).toBe(correlationId)
      expect(variant.version).toBe(1)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should handle variant with images', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const variantId = randomUUIDv7()
      const productId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()
      const images = JSON.stringify([
        {
          imageId: 'img-1',
          urls: {
            thumbnail: { original: 'https://example.com/thumb.jpg', webp: null },
            small: { original: 'https://example.com/small.jpg', webp: null },
            medium: { original: 'https://example.com/medium.jpg', webp: 'https://example.com/medium.webp' },
            large: { original: 'https://example.com/large.jpg', webp: null }
          },
          uploadedAt: '2024-01-01T00:00:00.000Z',
          altText: 'Test variant image'
        }
      ])

      db.run(
        `INSERT INTO variant_details_view (aggregate_id, product_id, sku, title, price, inventory, options, barcode, weight, status, correlation_id, version, created_at, updated_at, images)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [variantId, productId, 'SKU-001', 'Test Variant', 29.99, 100, JSON.stringify({ Size: 'M' }), '123456', 1.5, 'active', correlationId, 0, now, now, images]
      )

      // Act
      const result = getVariantsView(db, { variantId })

      // Assert
      expect(result.length).toBe(1)
      const variant = result[0]!
      expect(variant.images).toBeDefined()
      expect(Array.isArray(variant.images)).toBe(true)
      expect(variant.images).toHaveLength(1)
      expect(variant.images[0]?.imageId).toBe('img-1')
      expect(variant.images[0]?.altText).toBe('Test variant image')
      expect(variant.images[0]?.urls.medium?.original).toBe('https://example.com/medium.jpg')
      expect(variant.images[0]?.urls.medium?.webp).toBe('https://example.com/medium.webp')
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should handle variant with multiple images', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const variantId = randomUUIDv7()
      const productId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()
      const images = JSON.stringify([
        {
          imageId: 'img-1',
          urls: {
            thumbnail: { original: 'https://example.com/img1-thumb.jpg', webp: null },
            small: { original: 'https://example.com/img1-small.jpg', webp: null },
            medium: { original: 'https://example.com/img1-medium.jpg', webp: null },
            large: { original: 'https://example.com/img1-large.jpg', webp: null }
          },
          uploadedAt: '2024-01-01T00:00:00.000Z',
          altText: 'First variant image'
        },
        {
          imageId: 'img-2',
          urls: {
            thumbnail: { original: 'https://example.com/img2-thumb.jpg', webp: null },
            small: { original: 'https://example.com/img2-small.jpg', webp: null },
            medium: { original: 'https://example.com/img2-medium.jpg', webp: null },
            large: { original: 'https://example.com/img2-large.jpg', webp: null }
          },
          uploadedAt: '2024-01-02T00:00:00.000Z',
          altText: 'Second variant image'
        }
      ])

      db.run(
        `INSERT INTO variant_details_view (aggregate_id, product_id, sku, title, price, inventory, options, barcode, weight, status, correlation_id, version, created_at, updated_at, images)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [variantId, productId, 'SKU-001', 'Test Variant', 29.99, 100, JSON.stringify({ Size: 'M' }), '123456', 1.5, 'active', correlationId, 0, now, now, images]
      )

      // Act
      const result = getVariantsView(db, { variantId })

      // Assert
      expect(result.length).toBe(1)
      const variant = result[0]!
      expect(variant.images).toHaveLength(2)
      expect(variant.images[0]?.imageId).toBe('img-1')
      expect(variant.images[0]?.altText).toBe('First variant image')
      expect(variant.images[1]?.imageId).toBe('img-2')
      expect(variant.images[1]?.altText).toBe('Second variant image')
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should handle variant with null images', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const variantId = randomUUIDv7()
      const productId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()

      db.run(
        `INSERT INTO variant_details_view (aggregate_id, product_id, sku, title, price, inventory, options, barcode, weight, status, correlation_id, version, created_at, updated_at, images)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [variantId, productId, 'SKU-001', 'Test Variant', 29.99, 100, JSON.stringify({ Size: 'M' }), '123456', 1.5, 'active', correlationId, 0, now, now, null]
      )

      // Act
      const result = getVariantsView(db, { variantId })

      // Assert
      expect(result.length).toBe(1)
      const variant = result[0]!
      expect(variant.images).toBeDefined()
      expect(Array.isArray(variant.images)).toBe(true)
      expect(variant.images).toHaveLength(0)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should handle variant with empty images array', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const variantId = randomUUIDv7()
      const productId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()

      db.run(
        `INSERT INTO variant_details_view (aggregate_id, product_id, sku, title, price, inventory, options, barcode, weight, status, correlation_id, version, created_at, updated_at, images)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [variantId, productId, 'SKU-001', 'Test Variant', 29.99, 100, JSON.stringify({ Size: 'M' }), '123456', 1.5, 'active', correlationId, 0, now, now, '[]']
      )

      // Act
      const result = getVariantsView(db, { variantId })

      // Assert
      expect(result.length).toBe(1)
      const variant = result[0]!
      expect(variant.images).toBeDefined()
      expect(Array.isArray(variant.images)).toBe(true)
      expect(variant.images).toHaveLength(0)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should handle images with all size variations', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const variantId = randomUUIDv7()
      const productId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()
      const images = JSON.stringify([
        {
          imageId: 'img-1',
          urls: {
            thumbnail: { original: 'https://example.com/thumb.jpg', webp: 'https://example.com/thumb.webp' },
            small: { original: 'https://example.com/small.jpg', webp: 'https://example.com/small.webp' },
            medium: { original: 'https://example.com/medium.jpg', webp: 'https://example.com/medium.webp' },
            large: { original: 'https://example.com/large.jpg', webp: 'https://example.com/large.webp' }
          },
          uploadedAt: '2024-01-01T00:00:00.000Z',
          altText: 'Full variant image'
        }
      ])

      db.run(
        `INSERT INTO variant_details_view (aggregate_id, product_id, sku, title, price, inventory, options, barcode, weight, status, correlation_id, version, created_at, updated_at, images)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [variantId, productId, 'SKU-001', 'Test Variant', 29.99, 100, JSON.stringify({ Size: 'M' }), '123456', 1.5, 'active', correlationId, 0, now, now, images]
      )

      // Act
      const result = getVariantsView(db, { variantId })

      // Assert
      expect(result.length).toBe(1)
      const variant = result[0]!
      const image = variant.images[0]!
      expect(image.urls.thumbnail?.original).toBe('https://example.com/thumb.jpg')
      expect(image.urls.thumbnail?.webp).toBe('https://example.com/thumb.webp')
      expect(image.urls.small?.original).toBe('https://example.com/small.jpg')
      expect(image.urls.small?.webp).toBe('https://example.com/small.webp')
      expect(image.urls.medium?.original).toBe('https://example.com/medium.jpg')
      expect(image.urls.medium?.webp).toBe('https://example.com/medium.webp')
      expect(image.urls.large?.original).toBe('https://example.com/large.jpg')
      expect(image.urls.large?.webp).toBe('https://example.com/large.webp')
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should return empty array when no rows match', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const variantId = randomUUIDv7()
      const productId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()

      db.run(
        `INSERT INTO variant_details_view (aggregate_id, product_id, sku, title, price, inventory, options, barcode, weight, status, correlation_id, version, created_at, updated_at, images)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [variantId, productId, 'SKU-001', 'Test Variant', 29.99, 100, JSON.stringify({ Size: 'M' }), '123456', 1.5, 'active', correlationId, 0, now, now, null]
      )

      // Act
      const result = getVariantsView(db, { variantId: randomUUIDv7() })

      // Assert
      expect(result.length).toBe(0)
      expect(Array.isArray(result)).toBe(true)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should combine multiple filters', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const variantId1 = randomUUIDv7()
      const variantId2 = randomUUIDv7()
      const variantId3 = randomUUIDv7()
      const productId1 = randomUUIDv7()
      const productId2 = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()

      db.run(
        `INSERT INTO variant_details_view (aggregate_id, product_id, sku, title, price, inventory, options, barcode, weight, status, correlation_id, version, created_at, updated_at, images)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [variantId1, productId1, 'SKU-001', 'Variant 1', 29.99, 100, JSON.stringify({ Size: 'M' }), '123456', 1.5, 'active', correlationId, 0, now, now, null]
      )
      db.run(
        `INSERT INTO variant_details_view (aggregate_id, product_id, sku, title, price, inventory, options, barcode, weight, status, correlation_id, version, created_at, updated_at, images)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [variantId2, productId1, 'SKU-002', 'Variant 2', 39.99, 50, JSON.stringify({ Size: 'L' }), '654321', 2.0, 'active', correlationId, 0, now, now, null]
      )
      db.run(
        `INSERT INTO variant_details_view (aggregate_id, product_id, sku, title, price, inventory, options, barcode, weight, status, correlation_id, version, created_at, updated_at, images)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [variantId3, productId2, 'SKU-003', 'Variant 3', 19.99, 200, JSON.stringify({ Size: 'S' }), '111222', 1.0, 'draft', correlationId, 0, now, now, null]
      )

      // Act
      const result = getVariantsView(db, { productId: productId1, status: 'active', limit: 1 })

      // Assert
      expect(result.length).toBe(1)
      expect(result[0]!.product_id).toBe(productId1)
      expect(result[0]!.status).toBe('active')
    } finally {
      closeTestDatabase(db)
    }
  })
})
