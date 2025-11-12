import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { getSlugRedirectsView } from '../../src/views/slugRedirectsView'
import { schemas } from '../../src/infrastructure/schemas'

describe('getSlugRedirectsView', () => {
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
    const now = new Date().toISOString()
    
    db.run(
      `INSERT INTO slug_redirects (old_slug, new_slug, product_id, created_at)
       VALUES (?, ?, ?, ?)`,
      ['old-slug-1', 'new-slug-1', productId1, now]
    )
    db.run(
      `INSERT INTO slug_redirects (old_slug, new_slug, product_id, created_at)
       VALUES (?, ?, ?, ?)`,
      ['old-slug-2', 'new-slug-2', productId2, now]
    )

    // Act
    const result = getSlugRedirectsView(db)

    // Assert
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(2)
    expect(result[0].old_slug).toBe('old-slug-1')
    expect(result[1].old_slug).toBe('old-slug-2')
  })

  test('should filter by oldSlug', () => {
    // Arrange
    const productId1 = randomUUIDv7()
    const productId2 = randomUUIDv7()
    const now = new Date().toISOString()
    
    db.run(
      `INSERT INTO slug_redirects (old_slug, new_slug, product_id, created_at)
       VALUES (?, ?, ?, ?)`,
      ['old-slug-1', 'new-slug-1', productId1, now]
    )
    db.run(
      `INSERT INTO slug_redirects (old_slug, new_slug, product_id, created_at)
       VALUES (?, ?, ?, ?)`,
      ['old-slug-2', 'new-slug-2', productId2, now]
    )

    // Act
    const result = getSlugRedirectsView(db, { oldSlug: 'old-slug-1' })

    // Assert
    expect(result.length).toBe(1)
    expect(result[0].old_slug).toBe('old-slug-1')
    expect(result[0].new_slug).toBe('new-slug-1')
    expect(result[0].product_id).toBe(productId1)
  })

  test('should filter by newSlug', () => {
    // Arrange
    const productId1 = randomUUIDv7()
    const productId2 = randomUUIDv7()
    const now = new Date().toISOString()
    
    db.run(
      `INSERT INTO slug_redirects (old_slug, new_slug, product_id, created_at)
       VALUES (?, ?, ?, ?)`,
      ['old-slug-1', 'new-slug-1', productId1, now]
    )
    db.run(
      `INSERT INTO slug_redirects (old_slug, new_slug, product_id, created_at)
       VALUES (?, ?, ?, ?)`,
      ['old-slug-2', 'new-slug-2', productId2, now]
    )

    // Act
    const result = getSlugRedirectsView(db, { newSlug: 'new-slug-2' })

    // Assert
    expect(result.length).toBe(1)
    expect(result[0].old_slug).toBe('old-slug-2')
    expect(result[0].new_slug).toBe('new-slug-2')
    expect(result[0].product_id).toBe(productId2)
  })

  test('should filter by productId', () => {
    // Arrange
    const productId1 = randomUUIDv7()
    const productId2 = randomUUIDv7()
    const now = new Date().toISOString()
    
    db.run(
      `INSERT INTO slug_redirects (old_slug, new_slug, product_id, created_at)
       VALUES (?, ?, ?, ?)`,
      ['old-slug-1', 'new-slug-1', productId1, now]
    )
    db.run(
      `INSERT INTO slug_redirects (old_slug, new_slug, product_id, created_at)
       VALUES (?, ?, ?, ?)`,
      ['old-slug-2', 'new-slug-2', productId2, now]
    )

    // Act
    const result = getSlugRedirectsView(db, { productId: productId1 })

    // Assert
    expect(result.length).toBe(1)
    expect(result[0].product_id).toBe(productId1)
    expect(result[0].old_slug).toBe('old-slug-1')
  })

  test('should apply limit pagination', () => {
    // Arrange
    const productId = randomUUIDv7()
    const now = new Date().toISOString()
    
    for (let i = 0; i < 5; i++) {
      db.run(
        `INSERT INTO slug_redirects (old_slug, new_slug, product_id, created_at)
         VALUES (?, ?, ?, ?)`,
        [`old-slug-${i}`, `new-slug-${i}`, productId, now]
      )
    }

    // Act
    const result = getSlugRedirectsView(db, { limit: 3 })

    // Assert
    expect(result.length).toBe(3)
  })

  test('should apply offset pagination', () => {
    // Arrange
    const productId = randomUUIDv7()
    const now = new Date().toISOString()
    
    for (let i = 0; i < 5; i++) {
      db.run(
        `INSERT INTO slug_redirects (old_slug, new_slug, product_id, created_at)
         VALUES (?, ?, ?, ?)`,
        [`old-slug-${i}`, `new-slug-${i}`, productId, now]
      )
    }

    // Act
    const result = getSlugRedirectsView(db, { offset: 2 })

    // Assert
    expect(result.length).toBe(3) // Should return remaining 3 after offset
  })

  test('should apply limit and offset together', () => {
    // Arrange
    const productId = randomUUIDv7()
    const now = new Date().toISOString()
    
    for (let i = 0; i < 5; i++) {
      db.run(
        `INSERT INTO slug_redirects (old_slug, new_slug, product_id, created_at)
         VALUES (?, ?, ?, ?)`,
        [`old-slug-${i}`, `new-slug-${i}`, productId, now]
      )
    }

    // Act
    const result = getSlugRedirectsView(db, { limit: 2, offset: 1 })

    // Assert
    expect(result.length).toBe(2)
  })

  test('should combine multiple filters', () => {
    // Arrange
    const productId1 = randomUUIDv7()
    const productId2 = randomUUIDv7()
    const now = new Date().toISOString()
    
    db.run(
      `INSERT INTO slug_redirects (old_slug, new_slug, product_id, created_at)
       VALUES (?, ?, ?, ?)`,
      ['old-slug-1', 'new-slug-1', productId1, now]
    )
    db.run(
      `INSERT INTO slug_redirects (old_slug, new_slug, product_id, created_at)
       VALUES (?, ?, ?, ?)`,
      ['old-slug-2', 'new-slug-1', productId2, now]
    )
    db.run(
      `INSERT INTO slug_redirects (old_slug, new_slug, product_id, created_at)
       VALUES (?, ?, ?, ?)`,
      ['old-slug-3', 'new-slug-3', productId1, now]
    )

    // Act
    const result = getSlugRedirectsView(db, { productId: productId1, newSlug: 'new-slug-1' })

    // Assert
    expect(result.length).toBe(1)
    expect(result[0].product_id).toBe(productId1)
    expect(result[0].new_slug).toBe('new-slug-1')
    expect(result[0].old_slug).toBe('old-slug-1')
  })

  test('should return empty array when no rows match', () => {
    // Arrange
    const productId = randomUUIDv7()
    const now = new Date().toISOString()
    
    db.run(
      `INSERT INTO slug_redirects (old_slug, new_slug, product_id, created_at)
       VALUES (?, ?, ?, ?)`,
      ['old-slug', 'new-slug', productId, now]
    )

    // Act
    const result = getSlugRedirectsView(db, { oldSlug: 'non-existent-slug' })

    // Assert
    expect(result.length).toBe(0)
    expect(Array.isArray(result)).toBe(true)
  })
})

