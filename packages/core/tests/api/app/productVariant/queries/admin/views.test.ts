import { describe, test, expect } from 'bun:test'
import { ProductVariantReadModel } from '../../../../../../src/api/app/productVariant/queries/admin/views'

describe('ProductVariantReadModel', () => {
  test('should be instantiable', () => {
    // Act
    const model = new ProductVariantReadModel()

    // Assert
    expect(model).toBeInstanceOf(ProductVariantReadModel)
  })

  test('should allow setting all properties', () => {
    // Arrange
    const model = new ProductVariantReadModel()

    // Act
    model.productId = 'product-456'
    model.variantId = 'variant-123'
    model.position = 1
    model.sku = 'SKU-001'
    model.price = 29.99
    model.inventory = 100
    model.options = JSON.stringify({ size: 'M' })
    model.variantStatus = 'active'
    model.images = JSON.stringify([])
    model.digitalAsset = JSON.stringify({ name: 'test.pdf' })
    model.variantCreatedAt = '2024-01-01T00:00:00.000Z'
    model.variantUpdatedAt = '2024-01-02T00:00:00.000Z'
    model.variantPublishedAt = '2024-01-01T12:00:00.000Z'
    model.productName = 'Test Product'
    model.productSlug = 'test-product'
    model.productDescription = 'Test description'
    model.productStatus = 'active'
    model.productVendor = 'Test Vendor'
    model.productType = 'digital'
    model.dropshipSafetyBuffer = 5
    model.defaultVariantId = 'variant-default'
    model.variantOptions = JSON.stringify([{ name: 'Size', values: ['S', 'M', 'L'] }])
    model.collections = JSON.stringify(['collection-1'])
    model.tags = JSON.stringify(['tag1', 'tag2'])
    model.taxable = 1
    model.taxId = 'tax-123'
    model.metaTitle = 'Meta Title'
    model.metaDescription = 'Meta Description'
    model.richDescriptionUrl = 'https://example.com/rich'
    model.productCreatedAt = '2024-01-01T00:00:00.000Z'
    model.productUpdatedAt = '2024-01-02T00:00:00.000Z'
    model.productPublishedAt = '2024-01-01T12:00:00.000Z'
    model.variantCorrelationId = 'correlation-123'
    model.variantVersion = 1

    // Assert
    expect(model.productId).toBe('product-456')
    expect(model.variantId).toBe('variant-123')
    expect(model.position).toBe(1)
    expect(model.sku).toBe('SKU-001')
    expect(model.price).toBe(29.99)
    expect(model.inventory).toBe(100)
    expect(model.options).toBe(JSON.stringify({ size: 'M' }))
    expect(model.variantStatus).toBe('active')
    expect(model.images).toBe(JSON.stringify([]))
    expect(model.digitalAsset).toBe(JSON.stringify({ name: 'test.pdf' }))
    expect(model.variantCreatedAt).toBe('2024-01-01T00:00:00.000Z')
    expect(model.variantUpdatedAt).toBe('2024-01-02T00:00:00.000Z')
    expect(model.variantPublishedAt).toBe('2024-01-01T12:00:00.000Z')
    expect(model.productName).toBe('Test Product')
    expect(model.productSlug).toBe('test-product')
    expect(model.productDescription).toBe('Test description')
    expect(model.productStatus).toBe('active')
    expect(model.productVendor).toBe('Test Vendor')
    expect(model.productType).toBe('digital')
    expect(model.dropshipSafetyBuffer).toBe(5)
    expect(model.defaultVariantId).toBe('variant-default')
    expect(model.variantOptions).toBe(JSON.stringify([{ name: 'Size', values: ['S', 'M', 'L'] }]))
    expect(model.collections).toBe(JSON.stringify(['collection-1']))
    expect(model.tags).toBe(JSON.stringify(['tag1', 'tag2']))
    expect(model.taxable).toBe(1)
    expect(model.taxId).toBe('tax-123')
    expect(model.metaTitle).toBe('Meta Title')
    expect(model.metaDescription).toBe('Meta Description')
    expect(model.richDescriptionUrl).toBe('https://example.com/rich')
    expect(model.productCreatedAt).toBe('2024-01-01T00:00:00.000Z')
    expect(model.productUpdatedAt).toBe('2024-01-02T00:00:00.000Z')
    expect(model.productPublishedAt).toBe('2024-01-01T12:00:00.000Z')
    expect(model.variantCorrelationId).toBe('correlation-123')
    expect(model.variantVersion).toBe(1)
  })

  test('should allow null for variantPublishedAt', () => {
    // Arrange
    const model = new ProductVariantReadModel()

    // Act
    model.variantPublishedAt = null

    // Assert
    expect(model.variantPublishedAt).toBeNull()
  })

  test('should allow null for productPublishedAt', () => {
    // Arrange
    const model = new ProductVariantReadModel()

    // Act
    model.productPublishedAt = null

    // Assert
    expect(model.productPublishedAt).toBeNull()
  })

  test('should allow null for digitalAsset', () => {
    // Arrange
    const model = new ProductVariantReadModel()

    // Act
    model.digitalAsset = null

    // Assert
    expect(model.digitalAsset).toBeNull()
  })

  test('should allow null for defaultVariantId', () => {
    // Arrange
    const model = new ProductVariantReadModel()

    // Act
    model.defaultVariantId = null

    // Assert
    expect(model.defaultVariantId).toBeNull()
  })

  test('should allow null for dropshipSafetyBuffer', () => {
    // Arrange
    const model = new ProductVariantReadModel()

    // Act
    model.dropshipSafetyBuffer = null

    // Assert
    expect(model.dropshipSafetyBuffer).toBeNull()
  })
})
