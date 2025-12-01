import { describe, test, expect } from 'bun:test'
import { GetProductVariantsService } from '../../../../../../src/api/app/productVariant/queries/admin/getProductVariantsService'
import { createTestDatabase, closeTestDatabase } from '../../../../../helpers/database'

// Helper to insert a product variant directly into the read model
function insertProductVariant(db: ReturnType<typeof createTestDatabase>, variant: {
  productId: string
  variantId: string
  position: number
  sku: string
  price: number
  inventory: number
  options: string
  variantStatus: 'draft' | 'active' | 'archived'
  images: string
  digitalAsset?: string | null
  variantCreatedAt: string
  variantUpdatedAt: string
  variantPublishedAt?: string | null
  productName: string
  productSlug: string
  productDescription: string
  productStatus: 'draft' | 'active' | 'archived'
  productVendor: string
  productType: 'digital' | 'dropship'
  dropshipSafetyBuffer?: number | null
  defaultVariantId?: string | null
  variantOptions: string
  collections: string
  tags: string
  taxable: number
  taxId: string
  metaTitle: string
  metaDescription: string
  richDescriptionUrl: string
  productCreatedAt: string
  productUpdatedAt: string
  productPublishedAt?: string | null
  variantCorrelationId: string
  variantVersion: number
}) {
  db.run(`
    INSERT INTO productVariantsReadModel (
      productId, variantId, position, sku, price, inventory, options, variantStatus,
      images, digitalAsset, variantCreatedAt, variantUpdatedAt, variantPublishedAt,
      productName, productSlug, productDescription, productStatus, productVendor,
      productType, dropshipSafetyBuffer, defaultVariantId, variantOptions,
      collections, tags, taxable, taxId, metaTitle, metaDescription, richDescriptionUrl,
      productCreatedAt, productUpdatedAt, productPublishedAt, variantCorrelationId, variantVersion
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    variant.productId,
    variant.variantId,
    variant.position,
    variant.sku,
    variant.price,
    variant.inventory,
    variant.options,
    variant.variantStatus,
    variant.images,
    variant.digitalAsset ?? null,
    variant.variantCreatedAt,
    variant.variantUpdatedAt,
    variant.variantPublishedAt ?? null,
    variant.productName,
    variant.productSlug,
    variant.productDescription,
    variant.productStatus,
    variant.productVendor,
    variant.productType,
    variant.dropshipSafetyBuffer ?? null,
    variant.defaultVariantId ?? null,
    variant.variantOptions,
    variant.collections,
    variant.tags,
    variant.taxable,
    variant.taxId,
    variant.metaTitle,
    variant.metaDescription,
    variant.richDescriptionUrl,
    variant.productCreatedAt,
    variant.productUpdatedAt,
    variant.productPublishedAt ?? null,
    variant.variantCorrelationId,
    variant.variantVersion,
  ])
}

function createTestVariant(productId: string, variantId: string, overrides: Partial<Parameters<typeof insertProductVariant>[1]> = {}): Parameters<typeof insertProductVariant>[1] {
  return {
    productId,
    variantId,
    position: 0,
    sku: 'SKU-001',
    price: 29.99,
    inventory: 100,
    options: '{"size":"M"}',
    variantStatus: 'active',
    images: '[]',
    digitalAsset: null,
    variantCreatedAt: '2024-01-01T00:00:00.000Z',
    variantUpdatedAt: '2024-01-01T00:00:00.000Z',
    variantPublishedAt: null,
    productName: 'Test Product',
    productSlug: 'test-product',
    productDescription: 'Test description',
    productStatus: 'active',
    productVendor: 'Test Vendor',
    productType: 'digital',
    dropshipSafetyBuffer: null,
    defaultVariantId: null,
    variantOptions: '[]',
    collections: '[]',
    tags: '[]',
    taxable: 1,
    taxId: '',
    metaTitle: '',
    metaDescription: '',
    richDescriptionUrl: '',
    productCreatedAt: '2024-01-01T00:00:00.000Z',
    productUpdatedAt: '2024-01-01T00:00:00.000Z',
    productPublishedAt: null,
    variantCorrelationId: 'correlation-123',
    variantVersion: 1,
    ...overrides,
  }
}

describe('GetProductVariantsService', () => {
  describe('handle', () => {
    test('returns variants for a product', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetProductVariantsService(db)
        const productId = 'product-123'
        insertProductVariant(db, createTestVariant(productId, 'variant-1', { position: 0 }))
        insertProductVariant(db, createTestVariant(productId, 'variant-2', { position: 1 }))

        // Act
        const result = service.handle({ productId })

        // Assert
        expect(result).toHaveLength(2)
        expect(result[0]!.variantId).toBe('variant-1')
        expect(result[1]!.variantId).toBe('variant-2')
      } finally {
        closeTestDatabase(db)
      }
    })

    test('returns empty array when no variants exist for product', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetProductVariantsService(db)

        // Act
        const result = service.handle({ productId: 'nonexistent-product' })

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
        const service = new GetProductVariantsService(db)
        const productId = 'product-123'
        insertProductVariant(db, createTestVariant(productId, 'variant-1', { variantStatus: 'active', position: 0 }))
        insertProductVariant(db, createTestVariant(productId, 'variant-2', { variantStatus: 'draft', position: 1 }))
        insertProductVariant(db, createTestVariant(productId, 'variant-3', { variantStatus: 'archived', position: 2 }))

        // Act
        const result = service.handle({ productId, status: 'active' })

        // Assert
        expect(result).toHaveLength(1)
        expect(result[0]!.variantId).toBe('variant-1')
        expect(result[0]!.variantStatus).toBe('active')
      } finally {
        closeTestDatabase(db)
      }
    })

    test('applies limit', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetProductVariantsService(db)
        const productId = 'product-123'
        insertProductVariant(db, createTestVariant(productId, 'variant-1', { position: 0 }))
        insertProductVariant(db, createTestVariant(productId, 'variant-2', { position: 1 }))
        insertProductVariant(db, createTestVariant(productId, 'variant-3', { position: 2 }))

        // Act
        const result = service.handle({ productId, limit: 2 })

        // Assert
        expect(result).toHaveLength(2)
        expect(result[0]!.variantId).toBe('variant-1')
        expect(result[1]!.variantId).toBe('variant-2')
      } finally {
        closeTestDatabase(db)
      }
    })

    test('applies offset with limit', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetProductVariantsService(db)
        const productId = 'product-123'
        insertProductVariant(db, createTestVariant(productId, 'variant-1', { position: 0 }))
        insertProductVariant(db, createTestVariant(productId, 'variant-2', { position: 1 }))
        insertProductVariant(db, createTestVariant(productId, 'variant-3', { position: 2 }))

        // Act
        const result = service.handle({ productId, limit: 2, offset: 1 })

        // Assert
        expect(result).toHaveLength(2)
        expect(result[0]!.variantId).toBe('variant-2')
        expect(result[1]!.variantId).toBe('variant-3')
      } finally {
        closeTestDatabase(db)
      }
    })

    test('applies offset without explicit limit (uses LIMIT -1)', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetProductVariantsService(db)
        const productId = 'product-123'
        insertProductVariant(db, createTestVariant(productId, 'variant-1', { position: 0 }))
        insertProductVariant(db, createTestVariant(productId, 'variant-2', { position: 1 }))
        insertProductVariant(db, createTestVariant(productId, 'variant-3', { position: 2 }))

        // Act - offset without limit should return remaining items
        const result = service.handle({ productId, offset: 1 })

        // Assert
        expect(result).toHaveLength(2)
        expect(result[0]!.variantId).toBe('variant-2')
        expect(result[1]!.variantId).toBe('variant-3')
      } finally {
        closeTestDatabase(db)
      }
    })

    test('combines status filter with pagination', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetProductVariantsService(db)
        const productId = 'product-123'
        insertProductVariant(db, createTestVariant(productId, 'variant-1', { variantStatus: 'active', position: 0 }))
        insertProductVariant(db, createTestVariant(productId, 'variant-2', { variantStatus: 'active', position: 1 }))
        insertProductVariant(db, createTestVariant(productId, 'variant-3', { variantStatus: 'active', position: 2 }))
        insertProductVariant(db, createTestVariant(productId, 'variant-4', { variantStatus: 'draft', position: 3 }))

        // Act
        const result = service.handle({ productId, status: 'active', limit: 2 })

        // Assert
        expect(result).toHaveLength(2)
        expect(result.every(v => v.variantStatus === 'active')).toBe(true)
      } finally {
        closeTestDatabase(db)
      }
    })

    test('orders by position ascending', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetProductVariantsService(db)
        const productId = 'product-123'
        // Insert in non-position order to verify ordering
        insertProductVariant(db, createTestVariant(productId, 'variant-3', { position: 2 }))
        insertProductVariant(db, createTestVariant(productId, 'variant-1', { position: 0 }))
        insertProductVariant(db, createTestVariant(productId, 'variant-2', { position: 1 }))

        // Act
        const result = service.handle({ productId })

        // Assert
        expect(result).toHaveLength(3)
        expect(result[0]!.variantId).toBe('variant-1')
        expect(result[1]!.variantId).toBe('variant-2')
        expect(result[2]!.variantId).toBe('variant-3')
      } finally {
        closeTestDatabase(db)
      }
    })

    test('only returns variants for the specified product', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetProductVariantsService(db)
        insertProductVariant(db, createTestVariant('product-1', 'variant-1', { position: 0 }))
        insertProductVariant(db, createTestVariant('product-2', 'variant-2', { position: 0 }))
        insertProductVariant(db, createTestVariant('product-1', 'variant-3', { position: 1 }))

        // Act
        const result = service.handle({ productId: 'product-1' })

        // Assert
        expect(result).toHaveLength(2)
        expect(result.every(v => v.productId === 'product-1')).toBe(true)
      } finally {
        closeTestDatabase(db)
      }
    })

    test('returns all fields from read model', () => {
      // Arrange
      const db = createTestDatabase()
      try {
        const service = new GetProductVariantsService(db)
        const productId = 'product-full'
        insertProductVariant(db, {
          productId,
          variantId: 'variant-full',
          position: 5,
          sku: 'FULL-SKU-001',
          price: 99.99,
          inventory: 50,
          options: '{"size":"L","color":"blue"}',
          variantStatus: 'active',
          images: '[{"url":"image1.jpg"}]',
          digitalAsset: '{"name":"file.pdf"}',
          variantCreatedAt: '2024-03-01T00:00:00.000Z',
          variantUpdatedAt: '2024-03-15T12:00:00.000Z',
          variantPublishedAt: '2024-03-02T00:00:00.000Z',
          productName: 'Full Product',
          productSlug: 'full-product',
          productDescription: 'Complete product data',
          productStatus: 'active',
          productVendor: 'Full Vendor',
          productType: 'dropship',
          dropshipSafetyBuffer: 10,
          defaultVariantId: 'variant-full',
          variantOptions: '[{"name":"Size","values":["S","M","L"]}]',
          collections: '["collection-1","collection-2"]',
          tags: '["tag1","tag2"]',
          taxable: 1,
          taxId: 'tax-123',
          metaTitle: 'Full Product Meta',
          metaDescription: 'Meta description for product',
          richDescriptionUrl: 'https://example.com/rich',
          productCreatedAt: '2024-02-01T00:00:00.000Z',
          productUpdatedAt: '2024-03-15T12:00:00.000Z',
          productPublishedAt: '2024-02-15T00:00:00.000Z',
          variantCorrelationId: 'corr-full',
          variantVersion: 5,
        })

        // Act
        const result = service.handle({ productId })

        // Assert
        expect(result).toHaveLength(1)
        const variant = result[0]!
        expect(variant.productId).toBe(productId)
        expect(variant.variantId).toBe('variant-full')
        expect(variant.position).toBe(5)
        expect(variant.sku).toBe('FULL-SKU-001')
        expect(variant.price).toBe(99.99)
        expect(variant.inventory).toBe(50)
        expect(variant.options).toBe('{"size":"L","color":"blue"}')
        expect(variant.variantStatus).toBe('active')
        expect(variant.images).toBe('[{"url":"image1.jpg"}]')
        expect(variant.digitalAsset).toBe('{"name":"file.pdf"}')
        expect(variant.productName).toBe('Full Product')
        expect(variant.productSlug).toBe('full-product')
        expect(variant.productType).toBe('dropship')
        expect(variant.dropshipSafetyBuffer).toBe(10)
        expect(variant.variantCorrelationId).toBe('corr-full')
        expect(variant.variantVersion).toBe(5)
      } finally {
        closeTestDatabase(db)
      }
    })
  })
})
