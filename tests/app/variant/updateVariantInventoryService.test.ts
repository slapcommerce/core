import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { CreateVariantService } from '../../../src/app/variant/createVariantService'
import { CreateProductService } from '../../../src/app/product/createProductService'
import { UpdateVariantInventoryService } from '../../../src/app/variant/updateVariantInventoryService'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { schemas } from '../../../src/infrastructure/schemas'
import { ProjectionService } from '../../../src/infrastructure/projectionService'
import type { CreateVariantCommand } from '../../../src/app/variant/commands'
import type { CreateProductCommand } from '../../../src/app/product/commands'
import type { UpdateVariantInventoryCommand } from '../../../src/app/variant/commands'

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

describe('UpdateVariantInventoryService', () => {
  test('should successfully update variant inventory', async () => {
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

    await new Promise(resolve => setTimeout(resolve, 100))

    const variantSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(variantCommand.id) as any
    const updateCommand: UpdateVariantInventoryCommand = {
      id: variantCommand.id,
      inventory: 200,
      expectedVersion: JSON.parse(variantSnapshot.payload).version,
    }

    const updateService = new UpdateVariantInventoryService(unitOfWork, projectionService)

    // Act
    await updateService.execute(updateCommand)

    // Assert - Verify variant.inventory_updated event was saved
    await new Promise(resolve => setTimeout(resolve, 100))
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(variantCommand.id) as any[]
    expect(events.length).toBe(2)
    expect(events[1]!.event_type).toBe('variant.inventory_updated')
    expect(events[1]!.version).toBe(1)

    const eventPayload = JSON.parse(events[1]!.payload)
    expect(eventPayload.newState.inventory).toBe(200)
    expect(eventPayload.priorState.inventory).toBe(100)

    // Assert - Verify snapshot was updated
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(variantCommand.id) as any
    expect(snapshot.version).toBe(1)
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.inventory).toBe(200)

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
    const service = new UpdateVariantInventoryService(unitOfWork, projectionService)
    const command: UpdateVariantInventoryCommand = {
      id: randomUUIDv7(),
      inventory: 200,
      expectedVersion: 0,
    }

    // Act & Assert
    await expect(service.execute(command)).rejects.toThrow('Variant with id')
    batcher.stop()
    db.close()
  })

  test('should throw error on optimistic concurrency conflict', async () => {
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
    
    const productService = new CreateProductService(unitOfWork, projectionService)
    const productCommand = createValidProductCommand()
    await productService.execute(productCommand)

    const createVariantService = new CreateVariantService(unitOfWork, projectionService)
    const variantCommand = createValidVariantCommand(productCommand.id)
    await createVariantService.execute(variantCommand)

    await new Promise(resolve => setTimeout(resolve, 100))

    const updateCommand: UpdateVariantInventoryCommand = {
      id: variantCommand.id,
      inventory: 200,
      expectedVersion: 5, // Wrong version
    }

    const updateService = new UpdateVariantInventoryService(unitOfWork, projectionService)

    // Act & Assert
    await expect(updateService.execute(updateCommand)).rejects.toThrow('Optimistic concurrency conflict')
    batcher.stop()
    db.close()
  })

  test('should update inventory to zero', async () => {
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
    
    const productService = new CreateProductService(unitOfWork, projectionService)
    const productCommand = createValidProductCommand()
    await productService.execute(productCommand)

    const createVariantService = new CreateVariantService(unitOfWork, projectionService)
    const variantCommand = createValidVariantCommand(productCommand.id)
    await createVariantService.execute(variantCommand)

    await new Promise(resolve => setTimeout(resolve, 100))

    const variantSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(variantCommand.id) as any
    const updateCommand: UpdateVariantInventoryCommand = {
      id: variantCommand.id,
      inventory: 0,
      expectedVersion: JSON.parse(variantSnapshot.payload).version,
    }

    const updateService = new UpdateVariantInventoryService(unitOfWork, projectionService)

    // Act
    await updateService.execute(updateCommand)

    // Assert - Verify inventory was updated to zero
    await new Promise(resolve => setTimeout(resolve, 100))
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(variantCommand.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.inventory).toBe(0)

    batcher.stop()
    db.close()
  })
})

