import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { CreateVariantService } from '../../../src/app/variant/createVariantService'
import { CreateProductService } from '../../../src/app/product/createProductService'
import { ArchiveVariantService } from '../../../src/app/variant/archiveVariantService'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { schemas } from '../../../src/infrastructure/schemas'
import { ProjectionService } from '../../../src/infrastructure/projectionService'
import type { CreateVariantCommand } from '../../../src/app/variant/commands'
import type { CreateProductCommand } from '../../../src/app/product/commands'
import type { ArchiveVariantCommand } from '../../../src/app/variant/commands'

function createValidProductCommand(variantId?: string): CreateProductCommand {
  return {
    id: randomUUIDv7(),
    correlationId: randomUUIDv7(),
    title: 'Test Product',
    shortDescription: 'A test product',
    slug: 'test-product',
    collectionIds: [randomUUIDv7()],
    variantIds: variantId ? [variantId] : [randomUUIDv7()], // Product requires at least one variant
    richDescriptionUrl: 'https://example.com/description',
    productType: 'physical',
    vendor: 'Test Vendor',
    variantOptions: [
      { name: 'Size', values: ['S', 'M', 'L'] }
    ],
    metaTitle: 'Test Product Meta Title',
    metaDescription: 'Test Product Meta Description',
    tags: ['test', 'product'],
    requiresShipping: true,
    taxable: true,
    pageLayoutId: null,
  }
}

function createValidVariantCommand(productId: string): CreateVariantCommand {
  return {
    id: randomUUIDv7(),
    correlationId: randomUUIDv7(),
    productId,
    sku: 'SKU-123',
    title: 'Test Variant',
    price: 29.99,
    inventory: 100,
    options: { Size: 'L' },
    barcode: '123456789',
    weight: 1.5,
  }
}

describe('ArchiveVariantService', () => {
  test('should successfully archive a variant and release SKU', async () => {
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
    
    // Create product first with variant ID, then create variant
    const variantId = randomUUIDv7()
    const productId = randomUUIDv7()
    
    const productService = new CreateProductService(unitOfWork, projectionService)
    const productCommand = createValidProductCommand(variantId)
    productCommand.id = productId
    await productService.execute(productCommand)

    await new Promise(resolve => setTimeout(resolve, 100))

    const createVariantService = new CreateVariantService(unitOfWork, projectionService)
    const variantCommand = createValidVariantCommand(productId)
    variantCommand.id = variantId
    await createVariantService.execute(variantCommand)

    // Wait for batch to complete
    await new Promise(resolve => setTimeout(resolve, 100))

    const variantSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(variantCommand.id) as any
    const archiveCommand: ArchiveVariantCommand = {
      id: variantCommand.id,
      expectedVersion: JSON.parse(variantSnapshot.payload).version,
    }

    const archiveService = new ArchiveVariantService(unitOfWork, projectionService)

    // Act
    await archiveService.execute(archiveCommand)

    // Assert - Verify variant was archived
    await new Promise(resolve => setTimeout(resolve, 100))
    const archivedSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(variantCommand.id) as any
    const archivedPayload = JSON.parse(archivedSnapshot.payload)
    expect(archivedPayload.status).toBe('archived')

    // Assert - Verify SKU was released
    const skuSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(variantCommand.sku) as any
    const skuPayload = JSON.parse(skuSnapshot.payload)
    expect(skuPayload.status).toBe('released')
    expect(skuPayload.variantId).toBeNull()

    batcher.stop()
    db.close()
  })

  test('should throw error when variant not found', async () => {
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
    const service = new ArchiveVariantService(unitOfWork, projectionService)
    const command: ArchiveVariantCommand = {
      id: randomUUIDv7(),
      expectedVersion: 0,
    }

    // Act & Assert
    await expect(service.execute(command)).rejects.toThrow('Variant with id')
    batcher.stop()
    db.close()
  })
})

