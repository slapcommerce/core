import { describe, test, expect } from 'bun:test'
import { ProductViewQueryHandler } from '../../../../../../src/api/app/product/queries/admin/getProductService'
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
  productType: 'digital' | 'dropship'
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
      createdAt, status, correlationId, taxable, productType,
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
    product.productType,
    product.dropshipSafetyBuffer ?? null,
    product.variantOptions,
    product.version,
    product.updatedAt,
    product.collections,
    product.metaTitle ?? '',
    product.metaDescription ?? '',
  ])
}

describe('ProductViewQueryHandler', () => {
  describe('handle', () => {
    test('returns product when found', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new ProductViewQueryHandler(db)
        insertProduct(db, {
          aggregateId: 'product-123',
          name: 'Test Product',
          slug: 'test-product',
          vendor: 'Test Vendor',
          description: 'A test product',
          tags: '["tag1","tag2"]',
          createdAt: '2024-01-01T00:00:00.000Z',
          status: 'active',
          correlationId: 'corr-123',
          taxable: 1,
          productType: 'digital',
          variantOptions: '[]',
          version: 1,
          updatedAt: '2024-01-02T00:00:00.000Z',
          collections: '[{"collectionId":"collection-1","position":0}]',
          metaTitle: 'Test Product | Shop',
          metaDescription: 'Buy our test product',
        })

        // Act
        const result = service.handle({ productId: 'product-123' })

        // Assert
        expect(result).not.toBeNull()
        expect(result!.aggregateId).toBe('product-123')
        expect(result!.name).toBe('Test Product')
        expect(result!.slug).toBe('test-product')
        expect(result!.status).toBe('active')
      } finally {
        closeTestDatabase(db)
      }
    })

    test('returns null when product not found', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new ProductViewQueryHandler(db)
        // No product inserted

        // Act
        const result = service.handle({ productId: 'non-existent-product' })

        // Assert
        expect(result).toBeNull()
      } finally {
        closeTestDatabase(db)
      }
    })

    test('returns correct product among multiple', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new ProductViewQueryHandler(db)
        insertProduct(db, {
          aggregateId: 'product-1',
          name: 'Product One',
          slug: 'product-one',
          vendor: 'Vendor',
          description: 'Product one description',
          tags: '[]',
          createdAt: '2024-01-01T00:00:00.000Z',
          status: 'active',
          correlationId: 'corr-1',
          taxable: 1,
          productType: 'digital',
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
          description: 'Product two description',
          tags: '[]',
          createdAt: '2024-01-02T00:00:00.000Z',
          status: 'draft',
          correlationId: 'corr-2',
          taxable: 0,
          productType: 'digital',
          variantOptions: '[]',
          version: 1,
          updatedAt: '2024-01-02T00:00:00.000Z',
          collections: '[{"collectionId":"collection-2","position":0}]',
        })

        // Act
        const result = service.handle({ productId: 'product-2' })

        // Assert
        expect(result).not.toBeNull()
        expect(result!.aggregateId).toBe('product-2')
        expect(result!.name).toBe('Product Two')
      } finally {
        closeTestDatabase(db)
      }
    })

    test('returns all fields from read model', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new ProductViewQueryHandler(db)
        insertProduct(db, {
          aggregateId: 'product-full',
          name: 'Full Product',
          slug: 'full-product',
          vendor: 'Full Vendor',
          description: 'Complete product data',
          tags: '["tag1","tag2"]',
          createdAt: '2024-03-01T00:00:00.000Z',
          status: 'archived',
          correlationId: 'corr-full',
          taxable: 1,
          productType: 'dropship',
          dropshipSafetyBuffer: 5,
          variantOptions: '[{"name":"Size","values":["S","M","L"]}]',
          version: 5,
          updatedAt: '2024-03-15T12:00:00.000Z',
          collections: '[{"collectionId":"collection-1","position":0},{"collectionId":"collection-2","position":1}]',
          metaTitle: 'Full Product Meta',
          metaDescription: 'Meta description for product',
        })

        // Act
        const result = service.handle({ productId: 'product-full' })

        // Assert
        expect(result).not.toBeNull()
        expect(result!.aggregateId).toBe('product-full')
        expect(result!.name).toBe('Full Product')
        expect(result!.slug).toBe('full-product')
        expect(result!.vendor).toBe('Full Vendor')
        expect(result!.description).toBe('Complete product data')
        expect(result!.tags).toEqual(['tag1', 'tag2'])
        expect(result!.status).toBe('archived')
        expect(result!.correlationId).toBe('corr-full')
        expect(result!.taxable).toBe(1)
        expect(result!.productType).toBe('dropship')
        expect(result!.dropshipSafetyBuffer).toBe(5)
        expect(result!.version).toBe(5)
        expect(result!.createdAt).toBe('2024-03-01T00:00:00.000Z')
        expect(result!.updatedAt).toBe('2024-03-15T12:00:00.000Z')
        expect(result!.metaTitle).toBe('Full Product Meta')
        expect(result!.metaDescription).toBe('Meta description for product')
      } finally {
        closeTestDatabase(db)
      }
    })
  })
})
