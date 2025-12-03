import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDatabase, closeTestDatabase } from '../../../../../helpers/database'
import { VariantViewQueryHandler } from '../../../../../../src/api/app/variant/queries/admin/getVariantService'
import type { GetVariantQuery } from '../../../../../../src/api/app/variant/queries/admin/queries'

function insertVariant(db: Database, variant: {
  aggregateId: string
  productId: string
  sku: string
  listPrice: number
  saleType: string | null
  saleValue: number | null
  activePrice: number
  inventory: number
  options: string
  status: string
  correlationId: string
  version: number
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  images: string
  digitalAsset: string | null
}) {
  db.run(`
    INSERT INTO variantReadModel (
      aggregateId, productId, sku, listPrice, saleType, saleValue, activePrice, inventory, options,
      status, correlationId, version, createdAt, updatedAt,
      publishedAt, images, digitalAsset
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      variant.aggregateId,
      variant.productId,
      variant.sku,
      variant.listPrice,
      variant.saleType,
      variant.saleValue,
      variant.activePrice,
      variant.inventory,
      variant.options,
      variant.status,
      variant.correlationId,
      variant.version,
      variant.createdAt,
      variant.updatedAt,
      variant.publishedAt,
      variant.images,
      variant.digitalAsset,
    ]
  )
}

describe('VariantViewQueryHandler', () => {
  test('should return variant by aggregateId', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const variantData = {
        aggregateId: 'variant-123',
        productId: 'product-456',
        sku: 'SKU-001',
        listPrice: 29.99,
        saleType: null,
        saleValue: null,
        activePrice: 29.99,
        inventory: 100,
        options: JSON.stringify({ size: 'M', color: 'Blue' }),
        status: 'draft',
        correlationId: 'correlation-123',
        version: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        publishedAt: null,
        images: JSON.stringify([]),
        digitalAsset: null,
      }
      insertVariant(db, variantData)

      const handler = new VariantViewQueryHandler(db)
      const query: GetVariantQuery = { variantId: 'variant-123' }

      // Act
      const result = handler.handle(query)

      // Assert
      expect(result).not.toBeNull()
      expect(result?.aggregateId).toBe('variant-123')
      expect(result?.productId).toBe('product-456')
      expect(result?.sku).toBe('SKU-001')
      expect(result?.listPrice).toBe(29.99)
      expect(result?.activePrice).toBe(29.99)
      expect(result?.inventory).toBe(100)
      expect(result?.status).toBe('draft')
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should return null when variant not found', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const handler = new VariantViewQueryHandler(db)
      const query: GetVariantQuery = { variantId: 'non-existent' }

      // Act
      const result = handler.handle(query)

      // Assert
      expect(result).toBeNull()
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should return all fields correctly', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const createdAt = new Date().toISOString()
      const updatedAt = new Date().toISOString()
      const publishedAt = new Date().toISOString()
      const digitalAsset = JSON.stringify({
        name: 'test.pdf',
        fileKey: 'files/test.pdf',
        mimeType: 'application/pdf',
        size: 1024,
      })
      const variantData = {
        aggregateId: 'variant-123',
        productId: 'product-456',
        sku: 'SKU-001',
        listPrice: 29.99,
        saleType: null,
        saleValue: null,
        activePrice: 29.99,
        inventory: 100,
        options: JSON.stringify({ size: 'M', color: 'Blue' }),
        status: 'active',
        correlationId: 'correlation-123',
        version: 2,
        createdAt,
        updatedAt,
        publishedAt,
        images: JSON.stringify([{ url: 'img.jpg', altText: 'test' }]),
        digitalAsset,
      }
      insertVariant(db, variantData)

      const handler = new VariantViewQueryHandler(db)
      const query: GetVariantQuery = { variantId: 'variant-123' }

      // Act
      const result = handler.handle(query)

      // Assert
      expect(result).not.toBeNull()
      expect(result?.aggregateId).toBe('variant-123')
      expect(result?.productId).toBe('product-456')
      expect(result?.sku).toBe('SKU-001')
      expect(result?.listPrice).toBe(29.99)
      expect(result?.activePrice).toBe(29.99)
      expect(result?.inventory).toBe(100)
      expect(result?.options).toEqual({ size: 'M', color: 'Blue' })
      expect(result?.status).toBe('active')
      expect(result?.correlationId).toBe('correlation-123')
      expect(result?.version).toBe(2)
      expect(result?.createdAt).toBe(createdAt)
      expect(result?.updatedAt).toBe(updatedAt)
      expect(result?.publishedAt).toBe(publishedAt)
      expect(result?.images).toEqual([{ url: 'img.jpg', altText: 'test' }])
      expect(result?.digitalAsset).toEqual(JSON.parse(digitalAsset))
    } finally {
      closeTestDatabase(db)
    }
  })
})
