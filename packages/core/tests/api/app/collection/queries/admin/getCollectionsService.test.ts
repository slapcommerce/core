import { describe, test, expect } from 'bun:test'
import { GetCollectionsService } from '../../../../../../src/api/app/collection/queries/admin/getCollectionsService'
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

describe('GetCollectionsService', () => {
  describe('handle', () => {
    test('returns all collections when no params provided', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetCollectionsService(db)
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
          status: 'archived',
          correlationId: 'corr-2',
          version: 1,
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        })

        // Act
        const result = service.handle()

        // Assert
        expect(result).toHaveLength(2)
      } finally {
        closeTestDatabase(db)
      }
    })

    test('returns empty array when no collections exist', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetCollectionsService(db)

        // Act
        const result = service.handle()

        // Assert
        expect(result).toHaveLength(0)
      } finally {
        closeTestDatabase(db)
      }
    })

    test('filters by status', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetCollectionsService(db)
        insertCollection(db, {
          aggregateId: 'collection-1',
          name: 'Active Collection',
          slug: 'active-collection',
          status: 'active',
          correlationId: 'corr-1',
          version: 1,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        })
        insertCollection(db, {
          aggregateId: 'collection-2',
          name: 'Archived Collection',
          slug: 'archived-collection',
          status: 'archived',
          correlationId: 'corr-2',
          version: 1,
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        })

        // Act
        const result = service.handle({ status: 'archived' })

        // Assert
        expect(result).toHaveLength(1)
        expect(result[0].aggregateId).toBe('collection-2')
        expect(result[0].status).toBe('archived')
      } finally {
        closeTestDatabase(db)
      }
    })

    test('maps draft status to active', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetCollectionsService(db)
        insertCollection(db, {
          aggregateId: 'collection-1',
          name: 'Active Collection',
          slug: 'active-collection',
          status: 'active',
          correlationId: 'corr-1',
          version: 1,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        })
        insertCollection(db, {
          aggregateId: 'collection-2',
          name: 'Archived Collection',
          slug: 'archived-collection',
          status: 'archived',
          correlationId: 'corr-2',
          version: 1,
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        })

        // Act - draft maps to active
        const result = service.handle({ status: 'draft' })

        // Assert
        expect(result).toHaveLength(1)
        expect(result[0].aggregateId).toBe('collection-1')
        expect(result[0].status).toBe('active')
      } finally {
        closeTestDatabase(db)
      }
    })

    test('applies limit', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetCollectionsService(db)
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
          status: 'active',
          correlationId: 'corr-2',
          version: 1,
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        })
        insertCollection(db, {
          aggregateId: 'collection-3',
          name: 'Collection Three',
          slug: 'collection-three',
          status: 'active',
          correlationId: 'corr-3',
          version: 1,
          createdAt: '2024-01-03T00:00:00.000Z',
          updatedAt: '2024-01-03T00:00:00.000Z',
        })

        // Act
        const result = service.handle({ limit: 2 })

        // Assert
        expect(result).toHaveLength(2)
      } finally {
        closeTestDatabase(db)
      }
    })

    test('applies offset with limit', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetCollectionsService(db)
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
          status: 'active',
          correlationId: 'corr-2',
          version: 1,
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        })
        insertCollection(db, {
          aggregateId: 'collection-3',
          name: 'Collection Three',
          slug: 'collection-three',
          status: 'active',
          correlationId: 'corr-3',
          version: 1,
          createdAt: '2024-01-03T00:00:00.000Z',
          updatedAt: '2024-01-03T00:00:00.000Z',
        })

        // Act
        const result = service.handle({ limit: 2, offset: 1 })

        // Assert
        expect(result).toHaveLength(2)
      } finally {
        closeTestDatabase(db)
      }
    })

    test('applies offset without explicit limit (uses LIMIT -1)', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetCollectionsService(db)
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
          status: 'active',
          correlationId: 'corr-2',
          version: 1,
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        })
        insertCollection(db, {
          aggregateId: 'collection-3',
          name: 'Collection Three',
          slug: 'collection-three',
          status: 'active',
          correlationId: 'corr-3',
          version: 1,
          createdAt: '2024-01-03T00:00:00.000Z',
          updatedAt: '2024-01-03T00:00:00.000Z',
        })

        // Act - offset without limit should return remaining items
        const result = service.handle({ offset: 1 })

        // Assert
        expect(result).toHaveLength(2)
      } finally {
        closeTestDatabase(db)
      }
    })

    test('combines status filter with pagination', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetCollectionsService(db)
        insertCollection(db, {
          aggregateId: 'collection-1',
          name: 'Active Collection 1',
          slug: 'active-collection-1',
          status: 'active',
          correlationId: 'corr-1',
          version: 1,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        })
        insertCollection(db, {
          aggregateId: 'collection-2',
          name: 'Active Collection 2',
          slug: 'active-collection-2',
          status: 'active',
          correlationId: 'corr-2',
          version: 1,
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        })
        insertCollection(db, {
          aggregateId: 'collection-3',
          name: 'Archived Collection',
          slug: 'archived-collection',
          status: 'archived',
          correlationId: 'corr-3',
          version: 1,
          createdAt: '2024-01-03T00:00:00.000Z',
          updatedAt: '2024-01-03T00:00:00.000Z',
        })

        // Act
        const result = service.handle({ status: 'active', limit: 1 })

        // Assert
        expect(result).toHaveLength(1)
        expect(result[0].status).toBe('active')
      } finally {
        closeTestDatabase(db)
      }
    })

    test('returns all fields from read model', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetCollectionsService(db)
        insertCollection(db, {
          aggregateId: 'collection-full',
          name: 'Full Collection',
          slug: 'full-collection',
          description: 'Complete collection data',
          status: 'active',
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
        const result = service.handle()

        // Assert
        expect(result).toHaveLength(1)
        const collection = result[0]
        expect(collection.aggregateId).toBe('collection-full')
        expect(collection.name).toBe('Full Collection')
        expect(collection.slug).toBe('full-collection')
        expect(collection.description).toBe('Complete collection data')
        expect(collection.status).toBe('active')
        expect(collection.correlationId).toBe('corr-full')
        expect(collection.version).toBe(5)
        expect(collection.createdAt).toBe('2024-03-01T00:00:00.000Z')
        expect(collection.updatedAt).toBe('2024-03-15T12:00:00.000Z')
        expect(collection.metaTitle).toBe('Full Collection Meta')
        expect(collection.metaDescription).toBe('Meta description for collection')
        expect(collection.publishedAt).toBe('2024-03-05T00:00:00.000Z')
      } finally {
        closeTestDatabase(db)
      }
    })
  })
})
