import { describe, test, expect } from 'bun:test'
import { randomUUIDv7 } from 'bun'
import { getSlugRedirectsView } from '../../src/views/slugRedirectsView'
import { createTestDatabase, closeTestDatabase } from '../helpers/database'

describe('getSlugRedirectsView', () => {
  test('should return all rows when no params are provided', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const productId1 = randomUUIDv7()
    const productId2 = randomUUIDv7()
    const now = new Date().toISOString()
    
    db.run(
      `INSERT INTO slug_redirects (old_slug, new_slug, entity_id, entity_type, product_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['old-slug-1', 'new-slug-1', productId1, 'product', productId1, now]
    )
    db.run(
      `INSERT INTO slug_redirects (old_slug, new_slug, entity_id, entity_type, product_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['old-slug-2', 'new-slug-2', productId2, 'product', productId2, now]
    )

    // Act
    const result = getSlugRedirectsView(db)

    // Assert
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(2)
    expect(result[0]!.old_slug).toBe('old-slug-1')
    expect(result[1]!.old_slug).toBe('old-slug-2')
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should filter by oldSlug', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const productId1 = randomUUIDv7()
    const productId2 = randomUUIDv7()
    const now = new Date().toISOString()
    
    db.run(
      `INSERT INTO slug_redirects (old_slug, new_slug, entity_id, entity_type, product_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['old-slug-1', 'new-slug-1', productId1, 'product', productId1, now]
    )
    db.run(
      `INSERT INTO slug_redirects (old_slug, new_slug, entity_id, entity_type, product_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['old-slug-2', 'new-slug-2', productId2, 'product', productId2, now]
    )

    // Act
    const result = getSlugRedirectsView(db, { oldSlug: 'old-slug-1' })

    // Assert
    expect(result.length).toBe(1)
    expect(result[0]!.old_slug).toBe('old-slug-1')
    expect(result[0]!.new_slug).toBe('new-slug-1')
    expect(result[0]!.product_id).toBe(productId1)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should filter by newSlug', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const productId1 = randomUUIDv7()
    const productId2 = randomUUIDv7()
    const now = new Date().toISOString()
    
    db.run(
      `INSERT INTO slug_redirects (old_slug, new_slug, entity_id, entity_type, product_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['old-slug-1', 'new-slug-1', productId1, 'product', productId1, now]
    )
    db.run(
      `INSERT INTO slug_redirects (old_slug, new_slug, entity_id, entity_type, product_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['old-slug-2', 'new-slug-2', productId2, 'product', productId2, now]
    )

    // Act
    const result = getSlugRedirectsView(db, { newSlug: 'new-slug-2' })

    // Assert
    expect(result.length).toBe(1)
    expect(result[0]!.old_slug).toBe('old-slug-2')
    expect(result[0]!.new_slug).toBe('new-slug-2')
    expect(result[0]!.product_id).toBe(productId2)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should filter by productId', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const productId1 = randomUUIDv7()
    const productId2 = randomUUIDv7()
    const now = new Date().toISOString()
    
    db.run(
      `INSERT INTO slug_redirects (old_slug, new_slug, entity_id, entity_type, product_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['old-slug-1', 'new-slug-1', productId1, 'product', productId1, now]
    )
    db.run(
      `INSERT INTO slug_redirects (old_slug, new_slug, entity_id, entity_type, product_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['old-slug-2', 'new-slug-2', productId2, 'product', productId2, now]
    )

    // Act
    const result = getSlugRedirectsView(db, { productId: productId1 })

    // Assert
    expect(result.length).toBe(1)
    expect(result[0]!.product_id).toBe(productId1)
    expect(result[0]!.old_slug).toBe('old-slug-1')
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should apply limit pagination', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const productId = randomUUIDv7()
    const now = new Date().toISOString()
    
    for (let i = 0; i < 5; i++) {
      db.run(
        `INSERT INTO slug_redirects (old_slug, new_slug, entity_id, entity_type, product_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [`old-slug-${i}`, `new-slug-${i}`, productId, 'product', productId, now]
      )
    }

    // Act
    const result = getSlugRedirectsView(db, { limit: 3 })

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
    const now = new Date().toISOString()
    
    for (let i = 0; i < 5; i++) {
      db.run(
        `INSERT INTO slug_redirects (old_slug, new_slug, entity_id, entity_type, product_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [`old-slug-${i}`, `new-slug-${i}`, productId, 'product', productId, now]
      )
    }

    // Act
    const result = getSlugRedirectsView(db, { offset: 2 })

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
    const now = new Date().toISOString()
    
    for (let i = 0; i < 5; i++) {
      db.run(
        `INSERT INTO slug_redirects (old_slug, new_slug, entity_id, entity_type, product_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [`old-slug-${i}`, `new-slug-${i}`, productId, 'product', productId, now]
      )
    }

    // Act
    const result = getSlugRedirectsView(db, { limit: 2, offset: 1 })

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
    const now = new Date().toISOString()
    
    db.run(
      `INSERT INTO slug_redirects (old_slug, new_slug, entity_id, entity_type, product_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['old-slug-1', 'new-slug-1', productId1, 'product', productId1, now]
    )
    db.run(
      `INSERT INTO slug_redirects (old_slug, new_slug, entity_id, entity_type, product_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['old-slug-2', 'new-slug-1', productId2, 'product', productId2, now]
    )
    db.run(
      `INSERT INTO slug_redirects (old_slug, new_slug, entity_id, entity_type, product_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['old-slug-3', 'new-slug-3', productId1, 'product', productId1, now]
    )

    // Act
    const result = getSlugRedirectsView(db, { productId: productId1, newSlug: 'new-slug-1' })

    // Assert
    expect(result.length).toBe(1)
    expect(result[0]!.product_id).toBe(productId1)
    expect(result[0]!.new_slug).toBe('new-slug-1')
    expect(result[0]!.old_slug).toBe('old-slug-1')
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should return empty array when no rows match', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const productId = randomUUIDv7()
    const now = new Date().toISOString()
    
    db.run(
      `INSERT INTO slug_redirects (old_slug, new_slug, entity_id, entity_type, product_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['old-slug', 'new-slug', productId, 'product', productId, now]
    )

    // Act
    const result = getSlugRedirectsView(db, { oldSlug: 'non-existent-slug' })

    // Assert
    expect(result.length).toBe(0)
    expect(Array.isArray(result)).toBe(true)
    } finally {
      closeTestDatabase(db)
    }
  })
})

