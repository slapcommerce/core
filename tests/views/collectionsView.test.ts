import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { getCollectionsView } from '../../src/views/collectionsView'
import { schemas } from '../../src/infrastructure/schemas'

describe('getCollectionsView', () => {
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

  test('should return all collections when no params are provided', () => {
    // Arrange
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
  })

  test('should filter by collectionId', () => {
    // Arrange
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
  })

  test('should filter by status active', () => {
    // Arrange
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
  })

  test('should filter by status archived', () => {
    // Arrange
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
  })

  test('should map draft status to active', () => {
    // Arrange
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
  })

  test('should apply limit pagination', () => {
    // Arrange
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
  })

  test('should apply offset pagination', () => {
    // Arrange
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
  })

  test('should apply limit and offset together', () => {
    // Arrange
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
  })

  test('should map data correctly from table to Collection type', () => {
    // Arrange
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
  })

  test('should handle null description', () => {
    // Arrange
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
  })

  test('should return empty array when no rows match', () => {
    // Arrange
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
  })

  test('should combine multiple filters', () => {
    // Arrange
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
  })
})

