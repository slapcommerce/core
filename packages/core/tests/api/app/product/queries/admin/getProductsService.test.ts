import { describe, test, expect } from 'bun:test'
import { GetProductsService } from '../../../../../../src/api/app/product/queries/admin/getProductsService'
import { createTestDatabase, closeTestDatabase } from '../../../../../helpers/database'

// Helper to insert a product directly into the read model
function insertProduct(db: ReturnType<typeof createTestDatabase>, product: {
  aggregateId: string
  name: string
  slug: string
  vendor: string
  description: string
  tags: string
  createdAt: string
  status: 'draft' | 'active' | 'archived'
  correlationId: string
  taxable: number
  fulfillmentType: 'digital' | 'dropship'
  dropshipSafetyBuffer?: number | null
  variantOptions: string
  version: number
  updatedAt: string
  collections: string
  metaTitle?: string
  metaDescription?: string
}) {
  db.run(`
    INSERT INTO productReadModel (
      aggregateId, name, slug, vendor, description, tags,
      createdAt, status, correlationId, taxable, fulfillmentType,
      dropshipSafetyBuffer, variantOptions, version, updatedAt,
      collections, metaTitle, metaDescription
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    product.aggregateId,
    product.name,
    product.slug,
    product.vendor,
    product.description,
    product.tags,
    product.createdAt,
    product.status,
    product.correlationId,
    product.taxable,
    product.fulfillmentType,
    product.dropshipSafetyBuffer ?? null,
    product.variantOptions,
    product.version,
    product.updatedAt,
    product.collections,
    product.metaTitle ?? '',
    product.metaDescription ?? '',
  ])
}

describe('GetProductsService', () => {
  describe('handle', () => {
    test('returns all products when no params provided', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetProductsService(db)
        insertProduct(db, {
          aggregateId: 'product-1',
          name: 'Product One',
          slug: 'product-one',
          vendor: 'Vendor',
          description: 'Product one',
          tags: '[]',
          createdAt: '2024-01-01T00:00:00.000Z',
          status: 'active',
          correlationId: 'corr-1',
          taxable: 1,
          fulfillmentType: 'digital',
          variantOptions: '[]',
          version: 1,
          updatedAt: '2024-01-01T00:00:00.000Z',
          collections: '[{"collectionId":"collection-1","position":0}]',
        })
        insertProduct(db, {
          aggregateId: 'product-2',
          name: 'Product Two',
          slug: 'product-two',
          vendor: 'Vendor',
          description: 'Product two',
          tags: '[]',
          createdAt: '2024-01-02T00:00:00.000Z',
          status: 'archived',
          correlationId: 'corr-2',
          taxable: 0,
          fulfillmentType: 'digital',
          variantOptions: '[]',
          version: 1,
          updatedAt: '2024-01-02T00:00:00.000Z',
          collections: '[{"collectionId":"collection-2","position":0}]',
        })

        // Act
        const result = service.handle()

        // Assert
        expect(result).toHaveLength(2)
      } finally {
        closeTestDatabase(db)
      }
    })

    test('returns empty array when no products exist', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetProductsService(db)

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
        const service = new GetProductsService(db)
        insertProduct(db, {
          aggregateId: 'product-1',
          name: 'Active Product',
          slug: 'active-product',
          vendor: 'Vendor',
          description: 'Active product',
          tags: '[]',
          createdAt: '2024-01-01T00:00:00.000Z',
          status: 'active',
          correlationId: 'corr-1',
          taxable: 1,
          fulfillmentType: 'digital',
          variantOptions: '[]',
          version: 1,
          updatedAt: '2024-01-01T00:00:00.000Z',
          collections: '[{"collectionId":"collection-1","position":0}]',
        })
        insertProduct(db, {
          aggregateId: 'product-2',
          name: 'Archived Product',
          slug: 'archived-product',
          vendor: 'Vendor',
          description: 'Archived product',
          tags: '[]',
          createdAt: '2024-01-02T00:00:00.000Z',
          status: 'archived',
          correlationId: 'corr-2',
          taxable: 0,
          fulfillmentType: 'digital',
          variantOptions: '[]',
          version: 1,
          updatedAt: '2024-01-02T00:00:00.000Z',
          collections: '[{"collectionId":"collection-2","position":0}]',
        })

        // Act
        const result = service.handle({ status: 'archived' })

        // Assert
        expect(result).toHaveLength(1)
        expect(result[0]!.aggregateId).toBe('product-2')
        expect(result[0]!.status).toBe('archived')
      } finally {
        closeTestDatabase(db)
      }
    })

    test('filters by collectionId', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetProductsService(db)
        insertProduct(db, {
          aggregateId: 'product-1',
          name: 'Product in Collection 1',
          slug: 'product-collection-1',
          vendor: 'Vendor',
          description: 'Product in collection 1',
          tags: '[]',
          createdAt: '2024-01-01T00:00:00.000Z',
          status: 'active',
          correlationId: 'corr-1',
          taxable: 1,
          fulfillmentType: 'digital',
          variantOptions: '[]',
          version: 1,
          updatedAt: '2024-01-01T00:00:00.000Z',
          collections: '[{"collectionId":"collection-1","position":0}]',
        })
        insertProduct(db, {
          aggregateId: 'product-2',
          name: 'Product in Collection 2',
          slug: 'product-collection-2',
          vendor: 'Vendor',
          description: 'Product in collection 2',
          tags: '[]',
          createdAt: '2024-01-02T00:00:00.000Z',
          status: 'active',
          correlationId: 'corr-2',
          taxable: 0,
          fulfillmentType: 'digital',
          variantOptions: '[]',
          version: 1,
          updatedAt: '2024-01-02T00:00:00.000Z',
          collections: '[{"collectionId":"collection-2","position":0}]',
        })
        insertProduct(db, {
          aggregateId: 'product-3',
          name: 'Product in Both Collections',
          slug: 'product-both-collections',
          vendor: 'Vendor',
          description: 'Product in both collections',
          tags: '[]',
          createdAt: '2024-01-03T00:00:00.000Z',
          status: 'active',
          correlationId: 'corr-3',
          taxable: 1,
          fulfillmentType: 'digital',
          variantOptions: '[]',
          version: 1,
          updatedAt: '2024-01-03T00:00:00.000Z',
          collections: '[{"collectionId":"collection-1","position":0},{"collectionId":"collection-2","position":1}]',
        })

        // Act
        const result = service.handle({ collectionId: 'collection-1' })

        // Assert
        expect(result).toHaveLength(2)
        const ids = result.map(p => p.aggregateId).sort()
        expect(ids).toEqual(['product-1', 'product-3'])
      } finally {
        closeTestDatabase(db)
      }
    })

    test('applies limit', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetProductsService(db)
        insertProduct(db, {
          aggregateId: 'product-1',
          name: 'Product One',
          slug: 'product-one',
          vendor: 'Vendor',
          description: 'Product one',
          tags: '[]',
          createdAt: '2024-01-01T00:00:00.000Z',
          status: 'active',
          correlationId: 'corr-1',
          taxable: 1,
          fulfillmentType: 'digital',
          variantOptions: '[]',
          version: 1,
          updatedAt: '2024-01-01T00:00:00.000Z',
          collections: '[{"collectionId":"collection-1","position":0}]',
        })
        insertProduct(db, {
          aggregateId: 'product-2',
          name: 'Product Two',
          slug: 'product-two',
          vendor: 'Vendor',
          description: 'Product two',
          tags: '[]',
          createdAt: '2024-01-02T00:00:00.000Z',
          status: 'active',
          correlationId: 'corr-2',
          taxable: 1,
          fulfillmentType: 'digital',
          variantOptions: '[]',
          version: 1,
          updatedAt: '2024-01-02T00:00:00.000Z',
          collections: '[{"collectionId":"collection-1","position":0}]',
        })
        insertProduct(db, {
          aggregateId: 'product-3',
          name: 'Product Three',
          slug: 'product-three',
          vendor: 'Vendor',
          description: 'Product three',
          tags: '[]',
          createdAt: '2024-01-03T00:00:00.000Z',
          status: 'active',
          correlationId: 'corr-3',
          taxable: 1,
          fulfillmentType: 'digital',
          variantOptions: '[]',
          version: 1,
          updatedAt: '2024-01-03T00:00:00.000Z',
          collections: '[{"collectionId":"collection-1","position":0}]',
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
        const service = new GetProductsService(db)
        insertProduct(db, {
          aggregateId: 'product-1',
          name: 'Product One',
          slug: 'product-one',
          vendor: 'Vendor',
          description: 'Product one',
          tags: '[]',
          createdAt: '2024-01-01T00:00:00.000Z',
          status: 'active',
          correlationId: 'corr-1',
          taxable: 1,
          fulfillmentType: 'digital',
          variantOptions: '[]',
          version: 1,
          updatedAt: '2024-01-01T00:00:00.000Z',
          collections: '[{"collectionId":"collection-1","position":0}]',
        })
        insertProduct(db, {
          aggregateId: 'product-2',
          name: 'Product Two',
          slug: 'product-two',
          vendor: 'Vendor',
          description: 'Product two',
          tags: '[]',
          createdAt: '2024-01-02T00:00:00.000Z',
          status: 'active',
          correlationId: 'corr-2',
          taxable: 1,
          fulfillmentType: 'digital',
          variantOptions: '[]',
          version: 1,
          updatedAt: '2024-01-02T00:00:00.000Z',
          collections: '[{"collectionId":"collection-1","position":0}]',
        })
        insertProduct(db, {
          aggregateId: 'product-3',
          name: 'Product Three',
          slug: 'product-three',
          vendor: 'Vendor',
          description: 'Product three',
          tags: '[]',
          createdAt: '2024-01-03T00:00:00.000Z',
          status: 'active',
          correlationId: 'corr-3',
          taxable: 1,
          fulfillmentType: 'digital',
          variantOptions: '[]',
          version: 1,
          updatedAt: '2024-01-03T00:00:00.000Z',
          collections: '[{"collectionId":"collection-1","position":0}]',
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
        const service = new GetProductsService(db)
        insertProduct(db, {
          aggregateId: 'product-1',
          name: 'Product One',
          slug: 'product-one',
          vendor: 'Vendor',
          description: 'Product one',
          tags: '[]',
          createdAt: '2024-01-01T00:00:00.000Z',
          status: 'active',
          correlationId: 'corr-1',
          taxable: 1,
          fulfillmentType: 'digital',
          variantOptions: '[]',
          version: 1,
          updatedAt: '2024-01-01T00:00:00.000Z',
          collections: '[{"collectionId":"collection-1","position":0}]',
        })
        insertProduct(db, {
          aggregateId: 'product-2',
          name: 'Product Two',
          slug: 'product-two',
          vendor: 'Vendor',
          description: 'Product two',
          tags: '[]',
          createdAt: '2024-01-02T00:00:00.000Z',
          status: 'active',
          correlationId: 'corr-2',
          taxable: 1,
          fulfillmentType: 'digital',
          variantOptions: '[]',
          version: 1,
          updatedAt: '2024-01-02T00:00:00.000Z',
          collections: '[{"collectionId":"collection-1","position":0}]',
        })
        insertProduct(db, {
          aggregateId: 'product-3',
          name: 'Product Three',
          slug: 'product-three',
          vendor: 'Vendor',
          description: 'Product three',
          tags: '[]',
          createdAt: '2024-01-03T00:00:00.000Z',
          status: 'active',
          correlationId: 'corr-3',
          taxable: 1,
          fulfillmentType: 'digital',
          variantOptions: '[]',
          version: 1,
          updatedAt: '2024-01-03T00:00:00.000Z',
          collections: '[{"collectionId":"collection-1","position":0}]',
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
        const service = new GetProductsService(db)
        insertProduct(db, {
          aggregateId: 'product-1',
          name: 'Active Product 1',
          slug: 'active-product-1',
          vendor: 'Vendor',
          description: 'Active product 1',
          tags: '[]',
          createdAt: '2024-01-01T00:00:00.000Z',
          status: 'active',
          correlationId: 'corr-1',
          taxable: 1,
          fulfillmentType: 'digital',
          variantOptions: '[]',
          version: 1,
          updatedAt: '2024-01-01T00:00:00.000Z',
          collections: '[{"collectionId":"collection-1","position":0}]',
        })
        insertProduct(db, {
          aggregateId: 'product-2',
          name: 'Active Product 2',
          slug: 'active-product-2',
          vendor: 'Vendor',
          description: 'Active product 2',
          tags: '[]',
          createdAt: '2024-01-02T00:00:00.000Z',
          status: 'active',
          correlationId: 'corr-2',
          taxable: 1,
          fulfillmentType: 'digital',
          variantOptions: '[]',
          version: 1,
          updatedAt: '2024-01-02T00:00:00.000Z',
          collections: '[{"collectionId":"collection-1","position":0}]',
        })
        insertProduct(db, {
          aggregateId: 'product-3',
          name: 'Archived Product',
          slug: 'archived-product',
          vendor: 'Vendor',
          description: 'Archived product',
          tags: '[]',
          createdAt: '2024-01-03T00:00:00.000Z',
          status: 'archived',
          correlationId: 'corr-3',
          taxable: 1,
          fulfillmentType: 'digital',
          variantOptions: '[]',
          version: 1,
          updatedAt: '2024-01-03T00:00:00.000Z',
          collections: '[{"collectionId":"collection-1","position":0}]',
        })

        // Act
        const result = service.handle({ status: 'active', limit: 1 })

        // Assert
        expect(result).toHaveLength(1)
        expect(result[0]!.status).toBe('active')
      } finally {
        closeTestDatabase(db)
      }
    })

    test('combines collectionId filter with status filter', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetProductsService(db)
        insertProduct(db, {
          aggregateId: 'product-1',
          name: 'Active in Collection 1',
          slug: 'active-collection-1',
          vendor: 'Vendor',
          description: 'Active in collection 1',
          tags: '[]',
          createdAt: '2024-01-01T00:00:00.000Z',
          status: 'active',
          correlationId: 'corr-1',
          taxable: 1,
          fulfillmentType: 'digital',
          variantOptions: '[]',
          version: 1,
          updatedAt: '2024-01-01T00:00:00.000Z',
          collections: '[{"collectionId":"collection-1","position":0}]',
        })
        insertProduct(db, {
          aggregateId: 'product-2',
          name: 'Draft in Collection 1',
          slug: 'draft-collection-1',
          vendor: 'Vendor',
          description: 'Draft in collection 1',
          tags: '[]',
          createdAt: '2024-01-02T00:00:00.000Z',
          status: 'draft',
          correlationId: 'corr-2',
          taxable: 1,
          fulfillmentType: 'digital',
          variantOptions: '[]',
          version: 1,
          updatedAt: '2024-01-02T00:00:00.000Z',
          collections: '[{"collectionId":"collection-1","position":0}]',
        })
        insertProduct(db, {
          aggregateId: 'product-3',
          name: 'Active in Collection 2',
          slug: 'active-collection-2',
          vendor: 'Vendor',
          description: 'Active in collection 2',
          tags: '[]',
          createdAt: '2024-01-03T00:00:00.000Z',
          status: 'active',
          correlationId: 'corr-3',
          taxable: 1,
          fulfillmentType: 'digital',
          variantOptions: '[]',
          version: 1,
          updatedAt: '2024-01-03T00:00:00.000Z',
          collections: '[{"collectionId":"collection-2","position":0}]',
        })

        // Act
        const result = service.handle({ status: 'active', collectionId: 'collection-1' })

        // Assert
        expect(result).toHaveLength(1)
        expect(result[0]!.aggregateId).toBe('product-1')
      } finally {
        closeTestDatabase(db)
      }
    })

    test('returns all fields from read model', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetProductsService(db)
        insertProduct(db, {
          aggregateId: 'product-full',
          name: 'Full Product',
          slug: 'full-product',
          vendor: 'Full Vendor',
          description: 'Complete product data',
          tags: '["tag1","tag2"]',
          createdAt: '2024-03-01T00:00:00.000Z',
          status: 'active',
          correlationId: 'corr-full',
          taxable: 1,
          fulfillmentType: 'dropship',
          dropshipSafetyBuffer: 5,
          variantOptions: '[{"name":"Size","values":["S","M","L"]}]',
          version: 5,
          updatedAt: '2024-03-15T12:00:00.000Z',
          collections: '[{"collectionId":"collection-1","position":0},{"collectionId":"collection-2","position":1}]',
          metaTitle: 'Full Product Meta',
          metaDescription: 'Meta description for product',
        })

        // Act
        const result = service.handle()

        // Assert
        expect(result).toHaveLength(1)
        const product = result[0]!
        expect(product.aggregateId).toBe('product-full')
        expect(product.name).toBe('Full Product')
        expect(product.slug).toBe('full-product')
        expect(product.vendor).toBe('Full Vendor')
        expect(product.description).toBe('Complete product data')
        expect(product.tags).toBe('["tag1","tag2"]')
        expect(product.status).toBe('active')
        expect(product.correlationId).toBe('corr-full')
        expect(product.taxable).toBe(1)
        expect(product.fulfillmentType).toBe('dropship')
        expect(product.dropshipSafetyBuffer).toBe(5)
        expect(product.version).toBe(5)
        expect(product.createdAt).toBe('2024-03-01T00:00:00.000Z')
        expect(product.updatedAt).toBe('2024-03-15T12:00:00.000Z')
        expect(product.metaTitle).toBe('Full Product Meta')
        expect(product.metaDescription).toBe('Meta description for product')
      } finally {
        closeTestDatabase(db)
      }
    })
  })
})
