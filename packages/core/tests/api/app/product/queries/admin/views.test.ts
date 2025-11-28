import { describe, test, expect } from 'bun:test'
import { ProductReadModel } from '../../../../../../src/api/app/product/queries/admin/views'

describe('ProductReadModel', () => {
  test('can be instantiated', () => {
    // Arrange & Act
    const model = new ProductReadModel()

    // Assert
    expect(model).toBeInstanceOf(ProductReadModel)
  })

  test('has expected properties', () => {
    // Arrange
    const model = new ProductReadModel()

    // Act
    model.aggregateId = 'product-123'
    model.name = 'Test Product'
    model.slug = 'test-product'
    model.vendor = 'Test Vendor'
    model.description = 'Test description'
    model.tags = '["tag1","tag2"]'
    model.createdAt = '2024-01-01T00:00:00.000Z'
    model.status = 'active'
    model.correlationId = 'corr-123'
    model.taxable = 1
    model.fulfillmentType = 'digital'
    model.dropshipSafetyBuffer = null
    model.variantOptions = '[]'
    model.version = 1
    model.updatedAt = '2024-01-02T00:00:00.000Z'
    model.collectionIds = '["collection-1"]'
    model.metaTitle = 'Test Meta Title'
    model.metaDescription = 'Test Meta Description'

    // Assert
    expect(model.aggregateId).toBe('product-123')
    expect(model.name).toBe('Test Product')
    expect(model.slug).toBe('test-product')
    expect(model.vendor).toBe('Test Vendor')
    expect(model.description).toBe('Test description')
    expect(model.tags).toBe('["tag1","tag2"]')
    expect(model.createdAt).toBe('2024-01-01T00:00:00.000Z')
    expect(model.status).toBe('active')
    expect(model.correlationId).toBe('corr-123')
    expect(model.taxable).toBe(1)
    expect(model.fulfillmentType).toBe('digital')
    expect(model.dropshipSafetyBuffer).toBeNull()
    expect(model.variantOptions).toBe('[]')
    expect(model.version).toBe(1)
    expect(model.updatedAt).toBe('2024-01-02T00:00:00.000Z')
    expect(model.collectionIds).toBe('["collection-1"]')
    expect(model.metaTitle).toBe('Test Meta Title')
    expect(model.metaDescription).toBe('Test Meta Description')
  })
})
