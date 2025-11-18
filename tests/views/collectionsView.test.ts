import { describe, test, expect } from 'bun:test'
import { randomUUIDv7 } from 'bun'
import { getCollectionsView } from '../../src/views/collectionsView'
import { createTestDatabase, closeTestDatabase } from '../helpers/database'

describe('getCollectionsView', () => {
  test('should return all collections when no params are provided', () => {
    // Arrange
    const db = createTestDatabase()
    try {
    const collectionId1 = randomUUIDv7()
    const collectionId2 = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const now = new Date().toISOString()
    
    db.run(
      `INSERT INTO collections_list_view (aggregate_id, name, slug, description, status, correlation_id, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [collectionId1, 'Collection 1', 'collection-1', 'Description 1', 'active', correlationId, 0, now, now]
    )
    db.run(
      `INSERT INTO collections_list_view (aggregate_id, name, slug, description, status, correlation_id, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [collectionId2, 'Collection 2', 'collection-2', 'Description 2', 'active', correlationId, 0, now, now]
    )

    // Act
    const result = getCollectionsView(db)

    // Assert
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(2)
    expect(result[0]!.aggregate_id).toBe(collectionId1)
    expect(result[1]!.aggregate_id).toBe(collectionId2)
    expect(result[0]!.title).toBe('Collection 1')
    expect(result[1]!.title).toBe('Collection 2')
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should filter by collectionId', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const collectionId1 = randomUUIDv7()
    const collectionId2 = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const now = new Date().toISOString()
    
    db.run(
      `INSERT INTO collections_list_view (aggregate_id, name, slug, description, status, correlation_id, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [collectionId1, 'Collection 1', 'collection-1', 'Description 1', 'active', correlationId, 0, now, now]
    )
    db.run(
      `INSERT INTO collections_list_view (aggregate_id, name, slug, description, status, correlation_id, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [collectionId2, 'Collection 2', 'collection-2', 'Description 2', 'active', correlationId, 0, now, now]
    )

    // Act
    const result = getCollectionsView(db, { collectionId: collectionId1 })

    // Assert
    expect(result.length).toBe(1)
    expect(result[0]!.aggregate_id).toBe(collectionId1)
    expect(result[0]!.title).toBe('Collection 1')
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should filter by status active', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const collectionId1 = randomUUIDv7()
    const collectionId2 = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const now = new Date().toISOString()
    
    db.run(
      `INSERT INTO collections_list_view (aggregate_id, name, slug, description, status, correlation_id, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [collectionId1, 'Active Collection', 'active-collection', 'Active description', 'active', correlationId, 0, now, now]
    )
    db.run(
      `INSERT INTO collections_list_view (aggregate_id, name, slug, description, status, correlation_id, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [collectionId2, 'Archived Collection', 'archived-collection', 'Archived description', 'archived', correlationId, 0, now, now]
    )

    // Act
    const result = getCollectionsView(db, { status: 'active' })

    // Assert
    expect(result.length).toBe(1)
    expect(result[0]!.status).toBe('active')
    expect(result[0]!.aggregate_id).toBe(collectionId1)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should filter by status archived', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const collectionId1 = randomUUIDv7()
    const collectionId2 = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const now = new Date().toISOString()
    
    db.run(
      `INSERT INTO collections_list_view (aggregate_id, name, slug, description, status, correlation_id, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [collectionId1, 'Active Collection', 'active-collection', 'Active description', 'active', correlationId, 0, now, now]
    )
    db.run(
      `INSERT INTO collections_list_view (aggregate_id, name, slug, description, status, correlation_id, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [collectionId2, 'Archived Collection', 'archived-collection', 'Archived description', 'archived', correlationId, 0, now, now]
    )

    // Act
    const result = getCollectionsView(db, { status: 'archived' })

    // Assert
    expect(result.length).toBe(1)
    expect(result[0]!.status).toBe('archived')
    expect(result[0]!.aggregate_id).toBe(collectionId2)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should map draft status to active', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const collectionId1 = randomUUIDv7()
    const collectionId2 = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const now = new Date().toISOString()
    
    db.run(
      `INSERT INTO collections_list_view (aggregate_id, name, slug, description, status, correlation_id, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [collectionId1, 'Active Collection', 'active-collection', 'Active description', 'active', correlationId, 0, now, now]
    )
    db.run(
      `INSERT INTO collections_list_view (aggregate_id, name, slug, description, status, correlation_id, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [collectionId2, 'Archived Collection', 'archived-collection', 'Archived description', 'archived', correlationId, 0, now, now]
    )

    // Act
    const result = getCollectionsView(db, { status: 'draft' })

    // Assert
    expect(result.length).toBe(1)
    expect(result[0]!.status).toBe('active')
    expect(result[0]!.aggregate_id).toBe(collectionId1)
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
      const collectionId = randomUUIDv7()
      db.run(
        `INSERT INTO collections_list_view (aggregate_id, name, slug, description, status, correlation_id, version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [collectionId, `Collection ${i}`, `collection-${i}`, `Description ${i}`, 'active', correlationId, 0, now, now]
      )
    }

    // Act
    const result = getCollectionsView(db, { limit: 3 })

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
      const collectionId = randomUUIDv7()
      db.run(
        `INSERT INTO collections_list_view (aggregate_id, name, slug, description, status, correlation_id, version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [collectionId, `Collection ${i}`, `collection-${i}`, `Description ${i}`, 'active', correlationId, 0, now, now]
      )
    }

    // Act
    const result = getCollectionsView(db, { offset: 2 })

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
      const collectionId = randomUUIDv7()
      db.run(
        `INSERT INTO collections_list_view (aggregate_id, name, slug, description, status, correlation_id, version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [collectionId, `Collection ${i}`, `collection-${i}`, `Description ${i}`, 'active', correlationId, 0, now, now]
      )
    }

    // Act
    const result = getCollectionsView(db, { limit: 2, offset: 1 })

    // Assert
    expect(result.length).toBe(2)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should map data correctly from table to Collection type', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const collectionId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const now = new Date().toISOString()
    
    db.run(
      `INSERT INTO collections_list_view (aggregate_id, name, slug, description, status, correlation_id, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [collectionId, 'Test Collection', 'test-collection', 'Test description', 'active', correlationId, 1, now, now]
    )

    // Act
    const result = getCollectionsView(db, { collectionId })

    // Assert
    expect(result.length).toBe(1)
    const collection = result[0]!
    expect(collection.aggregate_id).toBe(collectionId)
    expect(collection.collection_id).toBe(collectionId)
    expect(collection.title).toBe('Test Collection') // name mapped to title
    expect(collection.slug).toBe('test-collection')
    expect(collection.short_description).toBe('Test description') // description mapped to short_description
    expect(collection.status).toBe('active')
    expect(collection.correlation_id).toBe(correlationId)
    expect(collection.version).toBe(1)
    expect(collection.vendor).toBe('') // Collections don't have vendor
    expect(collection.product_type).toBe('') // Collections don't have product_type
    expect(collection.tags).toEqual([]) // Collections don't have tags
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should handle null description', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const collectionId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const now = new Date().toISOString()
    
    db.run(
      `INSERT INTO collections_list_view (aggregate_id, name, slug, description, status, correlation_id, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [collectionId, 'Test Collection', 'test-collection', null, 'active', correlationId, 0, now, now]
    )

    // Act
    const result = getCollectionsView(db, { collectionId })

    // Assert
    expect(result.length).toBe(1)
    expect(result[0]!.short_description).toBe('')
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should return empty array when no rows match', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const collectionId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const now = new Date().toISOString()
    
    db.run(
      `INSERT INTO collections_list_view (aggregate_id, name, slug, description, status, correlation_id, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [collectionId, 'Test Collection', 'test-collection', 'Description', 'active', correlationId, 0, now, now]
    )

    // Act
    const result = getCollectionsView(db, { collectionId: randomUUIDv7() })

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
      const collectionId1 = randomUUIDv7()
    const collectionId2 = randomUUIDv7()
    const collectionId3 = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const now = new Date().toISOString()

    db.run(
      `INSERT INTO collections_list_view (aggregate_id, name, slug, description, status, correlation_id, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [collectionId1, 'Collection 1', 'collection-1', 'Description 1', 'active', correlationId, 0, now, now]
    )
    db.run(
      `INSERT INTO collections_list_view (aggregate_id, name, slug, description, status, correlation_id, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [collectionId2, 'Collection 2', 'collection-2', 'Description 2', 'active', correlationId, 0, now, now]
    )
    db.run(
      `INSERT INTO collections_list_view (aggregate_id, name, slug, description, status, correlation_id, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [collectionId3, 'Collection 3', 'collection-3', 'Description 3', 'archived', correlationId, 0, now, now]
    )

    // Act
    const result = getCollectionsView(db, { status: 'active', limit: 1 })

    // Assert
    expect(result.length).toBe(1)
    expect(result[0]!.status).toBe('active')
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should handle collection with images', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const collectionId = randomUUIDv7()
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
          altText: 'Test image'
        }
      ])

      db.run(
        `INSERT INTO collections_list_view (aggregate_id, name, slug, description, status, correlation_id, version, created_at, updated_at, images)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [collectionId, 'Test Collection', 'test-collection', 'Test description', 'active', correlationId, 0, now, now, images]
      )

      // Act
      const result = getCollectionsView(db, { collectionId })

      // Assert
      expect(result.length).toBe(1)
      const collection = result[0]!
      expect(collection.images).toBeDefined()
      expect(Array.isArray(collection.images)).toBe(true)
      expect(collection.images).toHaveLength(1)
      expect(collection.images[0]?.imageId).toBe('img-1')
      expect(collection.images[0]?.altText).toBe('Test image')
      expect(collection.images[0]?.urls.medium?.original).toBe('https://example.com/medium.jpg')
      expect(collection.images[0]?.urls.medium?.webp).toBe('https://example.com/medium.webp')
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should handle collection with multiple images', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const collectionId = randomUUIDv7()
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
          altText: 'First image'
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
          altText: 'Second image'
        }
      ])

      db.run(
        `INSERT INTO collections_list_view (aggregate_id, name, slug, description, status, correlation_id, version, created_at, updated_at, images)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [collectionId, 'Test Collection', 'test-collection', 'Test description', 'active', correlationId, 0, now, now, images]
      )

      // Act
      const result = getCollectionsView(db, { collectionId })

      // Assert
      expect(result.length).toBe(1)
      const collection = result[0]!
      expect(collection.images).toHaveLength(2)
      expect(collection.images[0]?.imageId).toBe('img-1')
      expect(collection.images[0]?.altText).toBe('First image')
      expect(collection.images[1]?.imageId).toBe('img-2')
      expect(collection.images[1]?.altText).toBe('Second image')
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should handle collection with null images', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const collectionId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()

      db.run(
        `INSERT INTO collections_list_view (aggregate_id, name, slug, description, status, correlation_id, version, created_at, updated_at, images)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [collectionId, 'Test Collection', 'test-collection', 'Test description', 'active', correlationId, 0, now, now, null]
      )

      // Act
      const result = getCollectionsView(db, { collectionId })

      // Assert
      expect(result.length).toBe(1)
      const collection = result[0]!
      expect(collection.images).toBeDefined()
      expect(Array.isArray(collection.images)).toBe(true)
      expect(collection.images).toHaveLength(0)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should handle collection with empty images array', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const collectionId = randomUUIDv7()
      const correlationId = randomUUIDv7()
      const now = new Date().toISOString()

      db.run(
        `INSERT INTO collections_list_view (aggregate_id, name, slug, description, status, correlation_id, version, created_at, updated_at, images)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [collectionId, 'Test Collection', 'test-collection', 'Test description', 'active', correlationId, 0, now, now, '[]']
      )

      // Act
      const result = getCollectionsView(db, { collectionId })

      // Assert
      expect(result.length).toBe(1)
      const collection = result[0]!
      expect(collection.images).toBeDefined()
      expect(Array.isArray(collection.images)).toBe(true)
      expect(collection.images).toHaveLength(0)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should handle images with all size variations', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const collectionId = randomUUIDv7()
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
          altText: 'Full test image'
        }
      ])

      db.run(
        `INSERT INTO collections_list_view (aggregate_id, name, slug, description, status, correlation_id, version, created_at, updated_at, images)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [collectionId, 'Test Collection', 'test-collection', 'Test description', 'active', correlationId, 0, now, now, images]
      )

      // Act
      const result = getCollectionsView(db, { collectionId })

      // Assert
      expect(result.length).toBe(1)
      const collection = result[0]!
      const image = collection.images[0]!
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
})

