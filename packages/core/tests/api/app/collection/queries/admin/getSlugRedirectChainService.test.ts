import { describe, test, expect } from 'bun:test'
import { GetSlugRedirectChainService } from '../../../../../../src/api/app/collection/queries/admin/getSlugRedirectChainService'
import { createTestDatabase, closeTestDatabase } from '../../../../../helpers/database'

// Helper to insert a slug redirect directly into the database
function insertSlugRedirect(db: ReturnType<typeof createTestDatabase>, redirect: {
  oldSlug: string
  newSlug: string
  aggregateId: string
  aggregateType: string
  productId?: string | null
  createdAt: string
}) {
  db.run(`
    INSERT INTO slugRedirects (oldSlug, newSlug, aggregateId, aggregateType, productId, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    redirect.oldSlug,
    redirect.newSlug,
    redirect.aggregateId,
    redirect.aggregateType,
    redirect.productId ?? null,
    redirect.createdAt,
  ])
}

describe('GetSlugRedirectChainService', () => {
  describe('handle', () => {
    test('returns empty array when no redirects exist', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetSlugRedirectChainService(db)

        // Act
        const result = service.handle({ aggregateId: 'product-123', aggregateType: 'product' })

        // Assert
        expect(result).toHaveLength(0)
        expect(result).toEqual([])
      } finally {
        closeTestDatabase(db)
      }
    })

    test('returns single redirect for aggregate', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetSlugRedirectChainService(db)
        insertSlugRedirect(db, {
          oldSlug: 'old-product-slug',
          newSlug: 'new-product-slug',
          aggregateId: 'product-123',
          aggregateType: 'product',
          createdAt: '2024-01-15T10:00:00.000Z',
        })

        // Act
        const result = service.handle({ aggregateId: 'product-123', aggregateType: 'product' })

        // Assert
        expect(result).toHaveLength(1)
        expect(result[0]!.oldSlug).toBe('old-product-slug')
        expect(result[0]!.newSlug).toBe('new-product-slug')
        expect(result[0]!.createdAt).toBe('2024-01-15T10:00:00.000Z')
      } finally {
        closeTestDatabase(db)
      }
    })

    test('returns multiple redirects sorted by createdAt ASC', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetSlugRedirectChainService(db)
        // Insert in non-chronological order
        insertSlugRedirect(db, {
          oldSlug: 'second-old-slug',
          newSlug: 'third-slug',
          aggregateId: 'product-456',
          aggregateType: 'product',
          createdAt: '2024-01-20T12:00:00.000Z',
        })
        insertSlugRedirect(db, {
          oldSlug: 'first-old-slug',
          newSlug: 'second-old-slug',
          aggregateId: 'product-456',
          aggregateType: 'product',
          createdAt: '2024-01-10T08:00:00.000Z',
        })
        insertSlugRedirect(db, {
          oldSlug: 'third-slug',
          newSlug: 'final-slug',
          aggregateId: 'product-456',
          aggregateType: 'product',
          createdAt: '2024-01-25T16:00:00.000Z',
        })

        // Act
        const result = service.handle({ aggregateId: 'product-456', aggregateType: 'product' })

        // Assert
        expect(result).toHaveLength(3)
        // Should be ordered by createdAt ASC
        expect(result[0]!.oldSlug).toBe('first-old-slug')
        expect(result[0]!.createdAt).toBe('2024-01-10T08:00:00.000Z')
        expect(result[1]!.oldSlug).toBe('second-old-slug')
        expect(result[1]!.createdAt).toBe('2024-01-20T12:00:00.000Z')
        expect(result[2]!.oldSlug).toBe('third-slug')
        expect(result[2]!.createdAt).toBe('2024-01-25T16:00:00.000Z')
      } finally {
        closeTestDatabase(db)
      }
    })

    test('filters by aggregateType product', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetSlugRedirectChainService(db)
        insertSlugRedirect(db, {
          oldSlug: 'product-old',
          newSlug: 'product-new',
          aggregateId: 'aggregate-123',
          aggregateType: 'product',
          createdAt: '2024-01-01T00:00:00.000Z',
        })
        insertSlugRedirect(db, {
          oldSlug: 'collection-old',
          newSlug: 'collection-new',
          aggregateId: 'aggregate-123',
          aggregateType: 'collection',
          createdAt: '2024-01-02T00:00:00.000Z',
        })

        // Act
        const result = service.handle({ aggregateId: 'aggregate-123', aggregateType: 'product' })

        // Assert
        expect(result).toHaveLength(1)
        expect(result[0]!.oldSlug).toBe('product-old')
      } finally {
        closeTestDatabase(db)
      }
    })

    test('filters by aggregateType collection', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetSlugRedirectChainService(db)
        insertSlugRedirect(db, {
          oldSlug: 'product-old',
          newSlug: 'product-new',
          aggregateId: 'aggregate-789',
          aggregateType: 'product',
          createdAt: '2024-01-01T00:00:00.000Z',
        })
        insertSlugRedirect(db, {
          oldSlug: 'collection-old',
          newSlug: 'collection-new',
          aggregateId: 'aggregate-789',
          aggregateType: 'collection',
          createdAt: '2024-01-02T00:00:00.000Z',
        })

        // Act
        const result = service.handle({ aggregateId: 'aggregate-789', aggregateType: 'collection' })

        // Assert
        expect(result).toHaveLength(1)
        expect(result[0]!.oldSlug).toBe('collection-old')
      } finally {
        closeTestDatabase(db)
      }
    })

    test('filters by aggregateId correctly', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetSlugRedirectChainService(db)
        insertSlugRedirect(db, {
          oldSlug: 'slug-a',
          newSlug: 'slug-b',
          aggregateId: 'product-A',
          aggregateType: 'product',
          createdAt: '2024-01-01T00:00:00.000Z',
        })
        insertSlugRedirect(db, {
          oldSlug: 'slug-c',
          newSlug: 'slug-d',
          aggregateId: 'product-B',
          aggregateType: 'product',
          createdAt: '2024-01-02T00:00:00.000Z',
        })

        // Act
        const resultA = service.handle({ aggregateId: 'product-A', aggregateType: 'product' })
        const resultB = service.handle({ aggregateId: 'product-B', aggregateType: 'product' })

        // Assert
        expect(resultA).toHaveLength(1)
        expect(resultA[0]!.oldSlug).toBe('slug-a')
        expect(resultB).toHaveLength(1)
        expect(resultB[0]!.oldSlug).toBe('slug-c')
      } finally {
        closeTestDatabase(db)
      }
    })

    test('returns only fields in SlugRedirectReadModel', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetSlugRedirectChainService(db)
        insertSlugRedirect(db, {
          oldSlug: 'old-slug',
          newSlug: 'new-slug',
          aggregateId: 'collection-999',
          aggregateType: 'collection',
          productId: 'product-xyz',
          createdAt: '2024-06-01T00:00:00.000Z',
        })

        // Act
        const result = service.handle({ aggregateId: 'collection-999', aggregateType: 'collection' })

        // Assert
        expect(result).toHaveLength(1)
        const redirect = result[0]!
        expect(redirect.oldSlug).toBe('old-slug')
        expect(redirect.newSlug).toBe('new-slug')
        expect(redirect.createdAt).toBe('2024-06-01T00:00:00.000Z')
        // productId and aggregateId/Type are not in the view
        expect((redirect as any).productId).toBeUndefined()
        expect((redirect as any).aggregateId).toBeUndefined()
        expect((redirect as any).aggregateType).toBeUndefined()
      } finally {
        closeTestDatabase(db)
      }
    })
  })
})
