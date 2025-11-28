import { describe, test, expect } from 'bun:test'
import { VariantReadModel } from '../../../../../../src/api/app/variant/queries/admin/views'

describe('VariantReadModel', () => {
  test('should be instantiable', () => {
    // Act
    const model = new VariantReadModel()

    // Assert
    expect(model).toBeInstanceOf(VariantReadModel)
  })

  test('should allow setting all properties', () => {
    // Arrange
    const model = new VariantReadModel()

    // Act
    model.aggregateId = 'variant-123'
    model.productId = 'product-456'
    model.sku = 'SKU-001'
    model.price = 29.99
    model.inventory = 100
    model.options = JSON.stringify({ size: 'M' })
    model.status = 'active'
    model.correlationId = 'correlation-123'
    model.version = 1
    model.createdAt = '2024-01-01T00:00:00.000Z'
    model.updatedAt = '2024-01-02T00:00:00.000Z'
    model.publishedAt = '2024-01-01T12:00:00.000Z'
    model.images = JSON.stringify([])
    model.digitalAsset = JSON.stringify({ name: 'test.pdf' })

    // Assert
    expect(model.aggregateId).toBe('variant-123')
    expect(model.productId).toBe('product-456')
    expect(model.sku).toBe('SKU-001')
    expect(model.price).toBe(29.99)
    expect(model.inventory).toBe(100)
    expect(model.options).toBe(JSON.stringify({ size: 'M' }))
    expect(model.status).toBe('active')
    expect(model.correlationId).toBe('correlation-123')
    expect(model.version).toBe(1)
    expect(model.createdAt).toBe('2024-01-01T00:00:00.000Z')
    expect(model.updatedAt).toBe('2024-01-02T00:00:00.000Z')
    expect(model.publishedAt).toBe('2024-01-01T12:00:00.000Z')
    expect(model.images).toBe(JSON.stringify([]))
    expect(model.digitalAsset).toBe(JSON.stringify({ name: 'test.pdf' }))
  })

  test('should allow null for publishedAt', () => {
    // Arrange
    const model = new VariantReadModel()

    // Act
    model.publishedAt = null

    // Assert
    expect(model.publishedAt).toBeNull()
  })

  test('should allow null for digitalAsset', () => {
    // Arrange
    const model = new VariantReadModel()

    // Act
    model.digitalAsset = null

    // Assert
    expect(model.digitalAsset).toBeNull()
  })
})
