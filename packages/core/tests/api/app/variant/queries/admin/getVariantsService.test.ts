import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDatabase, closeTestDatabase } from '../../../../../helpers/database'
import { GetVariantsService } from '../../../../../../src/api/app/variant/queries/admin/getVariantsService'
import type { GetVariantsQuery } from '../../../../../../src/api/app/variant/queries/admin/queries'

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

function createVariantData(overrides: Partial<{
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
}> = {}) {
  return {
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
    ...overrides,
  }
}

describe('GetVariantsService', () => {
  test('should return all variants when no filters', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      insertVariant(db, createVariantData({ aggregateId: 'variant-1' }))
      insertVariant(db, createVariantData({ aggregateId: 'variant-2' }))
      insertVariant(db, createVariantData({ aggregateId: 'variant-3' }))

      const service = new GetVariantsService(db)

      // Act
      const result = service.handle()

      // Assert
      expect(result).toHaveLength(3)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should return empty array when no variants exist', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const service = new GetVariantsService(db)

      // Act
      const result = service.handle()

      // Assert
      expect(result).toHaveLength(0)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should filter by productId', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      insertVariant(db, createVariantData({ aggregateId: 'variant-1', productId: 'product-A' }))
      insertVariant(db, createVariantData({ aggregateId: 'variant-2', productId: 'product-A' }))
      insertVariant(db, createVariantData({ aggregateId: 'variant-3', productId: 'product-B' }))

      const service = new GetVariantsService(db)
      const query: GetVariantsQuery = { productId: 'product-A' }

      // Act
      const result = service.handle(query)

      // Assert
      expect(result).toHaveLength(2)
      expect(result.every(v => v.productId === 'product-A')).toBe(true)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should filter by status', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      insertVariant(db, createVariantData({ aggregateId: 'variant-1', status: 'draft' }))
      insertVariant(db, createVariantData({ aggregateId: 'variant-2', status: 'active' }))
      insertVariant(db, createVariantData({ aggregateId: 'variant-3', status: 'active' }))
      insertVariant(db, createVariantData({ aggregateId: 'variant-4', status: 'archived' }))

      const service = new GetVariantsService(db)
      const query: GetVariantsQuery = { status: 'active' }

      // Act
      const result = service.handle(query)

      // Assert
      expect(result).toHaveLength(2)
      expect(result.every(v => v.status === 'active')).toBe(true)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should filter by productId and status combined', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      insertVariant(db, createVariantData({ aggregateId: 'variant-1', productId: 'product-A', status: 'draft' }))
      insertVariant(db, createVariantData({ aggregateId: 'variant-2', productId: 'product-A', status: 'active' }))
      insertVariant(db, createVariantData({ aggregateId: 'variant-3', productId: 'product-B', status: 'active' }))

      const service = new GetVariantsService(db)
      const query: GetVariantsQuery = { productId: 'product-A', status: 'active' }

      // Act
      const result = service.handle(query)

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0]?.aggregateId).toBe('variant-2')
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should apply limit', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      insertVariant(db, createVariantData({ aggregateId: 'variant-1' }))
      insertVariant(db, createVariantData({ aggregateId: 'variant-2' }))
      insertVariant(db, createVariantData({ aggregateId: 'variant-3' }))
      insertVariant(db, createVariantData({ aggregateId: 'variant-4' }))
      insertVariant(db, createVariantData({ aggregateId: 'variant-5' }))

      const service = new GetVariantsService(db)
      const query: GetVariantsQuery = { limit: 2 }

      // Act
      const result = service.handle(query)

      // Assert
      expect(result).toHaveLength(2)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should apply offset', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      insertVariant(db, createVariantData({ aggregateId: 'variant-1' }))
      insertVariant(db, createVariantData({ aggregateId: 'variant-2' }))
      insertVariant(db, createVariantData({ aggregateId: 'variant-3' }))

      const service = new GetVariantsService(db)
      const query: GetVariantsQuery = { offset: 1 }

      // Act
      const result = service.handle(query)

      // Assert
      expect(result).toHaveLength(2)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should apply limit and offset together', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      insertVariant(db, createVariantData({ aggregateId: 'variant-1' }))
      insertVariant(db, createVariantData({ aggregateId: 'variant-2' }))
      insertVariant(db, createVariantData({ aggregateId: 'variant-3' }))
      insertVariant(db, createVariantData({ aggregateId: 'variant-4' }))
      insertVariant(db, createVariantData({ aggregateId: 'variant-5' }))

      const service = new GetVariantsService(db)
      const query: GetVariantsQuery = { limit: 2, offset: 1 }

      // Act
      const result = service.handle(query)

      // Assert
      expect(result).toHaveLength(2)
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
      insertVariant(db, {
        aggregateId: 'variant-123',
        productId: 'product-456',
        sku: 'SKU-001',
        listPrice: 29.99,
        saleType: null,
        saleValue: null,
        activePrice: 29.99,
        inventory: 100,
        options: JSON.stringify({ size: 'M' }),
        status: 'active',
        correlationId: 'correlation-123',
        version: 2,
        createdAt,
        updatedAt,
        publishedAt,
        images: JSON.stringify([{ url: 'img.jpg', altText: 'test' }]),
        digitalAsset,
      })

      const service = new GetVariantsService(db)

      // Act
      const result = service.handle()

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0]?.aggregateId).toBe('variant-123')
      expect(result[0]?.productId).toBe('product-456')
      expect(result[0]?.sku).toBe('SKU-001')
      expect(result[0]?.listPrice).toBe(29.99)
      expect(result[0]?.activePrice).toBe(29.99)
      expect(result[0]?.inventory).toBe(100)
      expect(result[0]?.options).toEqual({ size: 'M' })
      expect(result[0]?.status).toBe('active')
      expect(result[0]?.correlationId).toBe('correlation-123')
      expect(result[0]?.version).toBe(2)
      expect(result[0]?.createdAt).toBe(createdAt)
      expect(result[0]?.updatedAt).toBe(updatedAt)
      expect(result[0]?.publishedAt).toBe(publishedAt)
      expect(result[0]?.images).toEqual([{ url: 'img.jpg', altText: 'test' }])
      expect(result[0]?.digitalAsset).toEqual(JSON.parse(digitalAsset))
    } finally {
      closeTestDatabase(db)
    }
  })
})
