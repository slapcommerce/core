import { describe, test, expect } from 'bun:test'
import { CollectionViewQueryHandler } from '../../../../../../src/api/app/collection/queries/admin/getCollectionService'
import { createTestDatabase, closeTestDatabase } from '../../../../../helpers/database'

// Helper to insert a collection directly into the read model
function insertCollection(db: ReturnType<typeof createTestDatabase>, collection: {
  aggregateId: string
  name: string
  slug: string
  description?: string | null
  status: 'draft' | 'active' | 'archived'
  correlationId: string
  version: number
  createdAt: string
  updatedAt: string
  metaTitle?: string
  metaDescription?: string
  publishedAt?: string | null
  images?: string | null
}) {
  db.run(`
    INSERT INTO collectionsReadModel (
      aggregateId, name, slug, description, status, correlationId,
      version, createdAt, updatedAt, metaTitle, metaDescription, publishedAt, images
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    collection.aggregateId,
    collection.name,
    collection.slug,
    collection.description ?? null,
    collection.status,
    collection.correlationId,
    collection.version,
    collection.createdAt,
    collection.updatedAt,
    collection.metaTitle ?? '',
    collection.metaDescription ?? '',
    collection.publishedAt ?? null,
    collection.images ?? null,
  ])
}

describe('CollectionViewQueryHandler', () => {
  describe('handle', () => {
    test('returns collection when found', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new CollectionViewQueryHandler(db)
        insertCollection(db, {
          aggregateId: 'collection-123',
          name: 'Test Collection',
          slug: 'test-collection',
          description: 'A test collection',
          status: 'active',
          correlationId: 'corr-123',
          version: 1,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
          metaTitle: 'Test Collection | Shop',
          metaDescription: 'Browse our test collection',
          publishedAt: '2024-01-01T12:00:00.000Z',
        })

        // Act
        const result = service.handle({ collectionId: 'collection-123' })

        // Assert
        expect(result).not.toBeNull()
        expect(result!.aggregateId).toBe('collection-123')
        expect(result!.name).toBe('Test Collection')
        expect(result!.slug).toBe('test-collection')
        expect(result!.status).toBe('active')
      } finally {
        closeTestDatabase(db)
      }
    })

    test('returns null when collection not found', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new CollectionViewQueryHandler(db)
        // No collection inserted

        // Act
        const result = service.handle({ collectionId: 'non-existent-collection' })

        // Assert
        expect(result).toBeNull()
      } finally {
        closeTestDatabase(db)
      }
    })

    test('returns correct collection among multiple', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new CollectionViewQueryHandler(db)
        insertCollection(db, {
          aggregateId: 'collection-1',
          name: 'Collection One',
          slug: 'collection-one',
          status: 'active',
          correlationId: 'corr-1',
          version: 1,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        })
        insertCollection(db, {
          aggregateId: 'collection-2',
          name: 'Collection Two',
          slug: 'collection-two',
          status: 'draft',
          correlationId: 'corr-2',
          version: 1,
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        })

        // Act
        const result = service.handle({ collectionId: 'collection-2' })

        // Assert
        expect(result).not.toBeNull()
        expect(result!.aggregateId).toBe('collection-2')
        expect(result!.name).toBe('Collection Two')
      } finally {
        closeTestDatabase(db)
      }
    })

    test('returns all fields from read model', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new CollectionViewQueryHandler(db)
        insertCollection(db, {
          aggregateId: 'collection-full',
          name: 'Full Collection',
          slug: 'full-collection',
          description: 'Complete collection data',
          status: 'archived',
          correlationId: 'corr-full',
          version: 5,
          createdAt: '2024-03-01T00:00:00.000Z',
          updatedAt: '2024-03-15T12:00:00.000Z',
          metaTitle: 'Full Collection Meta',
          metaDescription: 'Meta description for collection',
          publishedAt: '2024-03-05T00:00:00.000Z',
          images: '[]',
        })

        // Act
        const result = service.handle({ collectionId: 'collection-full' })

        // Assert
        expect(result).not.toBeNull()
        expect(result!.aggregateId).toBe('collection-full')
        expect(result!.name).toBe('Full Collection')
        expect(result!.slug).toBe('full-collection')
        expect(result!.description).toBe('Complete collection data')
        expect(result!.status).toBe('archived')
        expect(result!.correlationId).toBe('corr-full')
        expect(result!.version).toBe(5)
        expect(result!.createdAt).toBe('2024-03-01T00:00:00.000Z')
        expect(result!.updatedAt).toBe('2024-03-15T12:00:00.000Z')
        expect(result!.metaTitle).toBe('Full Collection Meta')
        expect(result!.metaDescription).toBe('Meta description for collection')
        expect(result!.publishedAt).toBe('2024-03-05T00:00:00.000Z')
      } finally {
        closeTestDatabase(db)
      }
    })
  })
})
