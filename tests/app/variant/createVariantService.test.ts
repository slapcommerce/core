import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { CreateVariantService } from '../../../src/app/variant/createVariantService'
import { CreateProductService } from '../../../src/app/product/createProductService'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { schemas } from '../../../src/infrastructure/schemas'
import { ProjectionService } from '../../../src/infrastructure/projectionService'
import { productVariantProjection } from '../../../src/views/product/productVariantProjection'
import { CreateVariantCommand, type PublishVariantCommand } from '../../../src/app/variant/commands'
import type { CreateProductCommand } from '../../../src/app/product/commands'

function createValidProductCommand(overrides?: Partial<CreateProductCommand>): CreateProductCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    correlationId: overrides?.correlationId ?? randomUUIDv7(),
    userId: overrides?.userId ?? randomUUIDv7(),
    title: 'Test Product',
    shortDescription: 'A test product',
    slug: 'test-product',
    collectionIds: [randomUUIDv7()],
    variantIds: overrides?.variantIds ?? [randomUUIDv7()], // Product requires at least one variant
    richDescriptionUrl: 'https://example.com/description',
    productType: 'physical',
    vendor: 'Test Vendor',
    variantOptions: [
      { name: 'Size', values: ['S', 'M', 'L', 'XL'] },
      { name: 'Color', values: ['Red', 'Blue', 'Green'] }
    ],
    metaTitle: 'Test Product Meta Title',
    metaDescription: 'Test Product Meta Description',
    tags: ['test', 'product'],
    requiresShipping: true,
    taxable: true,
    pageLayoutId: null,
  }
}

function createValidVariantCommand(productId: string, overrides?: Partial<CreateVariantCommand>): CreateVariantCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    correlationId: overrides?.correlationId ?? randomUUIDv7(),
    userId: overrides?.userId ?? randomUUIDv7(),
    productId,
    sku: overrides?.sku ?? 'SKU-123',
    title: 'Test Variant',
    price: 29.99,
    inventory: 100,
    options: overrides?.options ?? { Size: 'L', Color: 'Red' },
    barcode: overrides?.barcode ?? '123456789',
    weight: overrides?.weight ?? 1.5,
  }
}

describe('CreateVariantService', () => {
  test('should successfully create a variant with all required data', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    const unitOfWork = new UnitOfWork(db, batcher)
    const projectionService = new ProjectionService()

    // Create product first
    const productService = new CreateProductService(unitOfWork, projectionService)
    const productCommand = createValidProductCommand()
    await productService.execute(productCommand)

    const variantService = new CreateVariantService(unitOfWork, projectionService)
    const variantCommand = createValidVariantCommand(productCommand.id)

    // Act
    await variantService.execute(variantCommand)

    // Assert - Verify event was saved
    const event = db.query('SELECT * FROM events WHERE aggregate_id = ?').get(variantCommand.id) as any
    expect(event).toBeDefined()
    expect(event.event_type).toBe('variant.created')
    expect(event.aggregate_id).toBe(variantCommand.id)
    expect(event.version).toBe(0)

    // Assert - Verify snapshot was saved
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(variantCommand.id) as any
    expect(snapshot).toBeDefined()
    expect(snapshot.aggregate_id).toBe(variantCommand.id)

    // Assert - Verify SKU was reserved
    const skuSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(variantCommand.sku) as any
    expect(skuSnapshot).toBeDefined()
    const skuPayload = JSON.parse(skuSnapshot.payload)
    expect(skuPayload.variantId).toBe(variantCommand.id)
    expect(skuPayload.status).toBe('active')

    batcher.stop()
    db.close()
  })

  test('should successfully create a variant with minimal data', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    const unitOfWork = new UnitOfWork(db, batcher)
    const projectionService = new ProjectionService()

    // Create product first
    const productService = new CreateProductService(unitOfWork, projectionService)
    const productCommand = createValidProductCommand()
    await productService.execute(productCommand)

    const variantService = new CreateVariantService(unitOfWork, projectionService)
    // Minimal command with only required IDs
    const minimalInput = {
      id: randomUUIDv7(),
      correlationId: randomUUIDv7(),
      userId: randomUUIDv7(),
      productId: productCommand.id,
    }
    // Parse with Zod to apply defaults
    const variantCommand = CreateVariantCommand.parse(minimalInput)

    // Act
    await variantService.execute(variantCommand)

    // Assert - Verify event was saved
    const event = db.query('SELECT * FROM events WHERE aggregate_id = ?').get(variantCommand.id) as any
    expect(event).toBeDefined()
    expect(event.event_type).toBe('variant.created')

    // Verify payload has default values
    const payload = JSON.parse(event.payload)
    expect(payload.newState.sku).toBe('')
    expect(payload.newState.title).toBe('')
    expect(payload.newState.price).toBe(0)
    expect(payload.newState.inventory).toBe(0)
    expect(payload.newState.status).toBe('draft')

    batcher.stop()
    db.close()
  })

  test('should throw error when product not found', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    const unitOfWork = new UnitOfWork(db, batcher)
    const projectionService = new ProjectionService()
    const service = new CreateVariantService(unitOfWork, projectionService)
    const command = createValidVariantCommand(randomUUIDv7())

    // Act & Assert
    await expect(service.execute(command)).rejects.toThrow('Product with id')
    batcher.stop()
    db.close()
  })

  test('should throw error when variant options do not match product variantOptions', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    const unitOfWork = new UnitOfWork(db, batcher)
    const projectionService = new ProjectionService()

    // Create product first
    const productService = new CreateProductService(unitOfWork, projectionService)
    const productCommand = createValidProductCommand()
    await productService.execute(productCommand)

    const variantService = new CreateVariantService(unitOfWork, projectionService)
    // Use invalid option value
    const variantCommand = createValidVariantCommand(productCommand.id, {
      options: { Size: 'XXL', Color: 'Red' } // XXL is not in product's Size values
    })

    // Act & Assert
    await expect(variantService.execute(variantCommand)).rejects.toThrow('Value "XXL" is not valid')
    batcher.stop()
    db.close()
  })

  test('should succeed when variant options missing required option', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    const unitOfWork = new UnitOfWork(db, batcher)
    const projectionService = new ProjectionService()

    // Create product first
    const productService = new CreateProductService(unitOfWork, projectionService)
    const productCommand = createValidProductCommand()
    await productService.execute(productCommand)

    const variantService = new CreateVariantService(unitOfWork, projectionService)
    // Missing Color option
    const variantCommand = createValidVariantCommand(productCommand.id, {
      options: { Size: 'L' }
    })

    // Act & Assert - Should now succeed as we allow partial options for drafts
    await variantService.execute(variantCommand)
    batcher.stop()
    db.close()
  })

  test('should throw error when SKU is already in use', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    const unitOfWork = new UnitOfWork(db, batcher)
    const projectionService = new ProjectionService()

    // Create product first
    const productService = new CreateProductService(unitOfWork, projectionService)
    const productCommand = createValidProductCommand()
    await productService.execute(productCommand)

    const variantService = new CreateVariantService(unitOfWork, projectionService)
    const variantCommand1 = createValidVariantCommand(productCommand.id, { sku: 'SKU-DUPLICATE' })
    const variantCommand2 = createValidVariantCommand(productCommand.id, { sku: 'SKU-DUPLICATE' })

    // Act
    await variantService.execute(variantCommand1)

    // Assert
    await expect(variantService.execute(variantCommand2)).rejects.toThrow('SKU "SKU-DUPLICATE" is already in use')
    batcher.stop()
    db.close()
  })

  test('should create projection when variant is created with registered handler', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    const unitOfWork = new UnitOfWork(db, batcher)
    const projectionService = new ProjectionService()
    projectionService.registerHandler('variant.created', productVariantProjection)

    // Create product first
    const productService = new CreateProductService(unitOfWork, projectionService)
    const productCommand = createValidProductCommand()
    await productService.execute(productCommand)

    const variantService = new CreateVariantService(unitOfWork, projectionService)
    const variantCommand = createValidVariantCommand(productCommand.id)

    // Act
    await variantService.execute(variantCommand)

    // Assert - Verify projection was created
    await new Promise(resolve => setTimeout(resolve, 100))

    const projection = db.query('SELECT * FROM product_variants WHERE variant_id = ?').get(variantCommand.id) as any
    expect(projection).toBeDefined()
    expect(projection.variant_id).toBe(variantCommand.id)
    expect(projection.aggregate_id).toBe(productCommand.id)

    batcher.stop()
    db.close()
  })
})

