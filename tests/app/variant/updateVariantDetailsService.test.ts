import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { CreateVariantService } from '../../../src/app/variant/createVariantService'
import { CreateProductService } from '../../../src/app/product/createProductService'
import { UpdateVariantDetailsService } from '../../../src/app/variant/updateVariantDetailsService'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { schemas } from '../../../src/infrastructure/schemas'
import { ProjectionService } from '../../../src/infrastructure/projectionService'
import type { CreateVariantCommand } from '../../../src/app/variant/commands'
import type { CreateProductCommand } from '../../../src/app/product/commands'
import type { UpdateVariantDetailsCommand } from '../../../src/app/variant/commands'

function createValidProductCommand(variantId?: string): CreateProductCommand {
  return {
    id: randomUUIDv7(),
    correlationId: randomUUIDv7(),
    userId: randomUUIDv7(),
    title: 'Test Product',
    shortDescription: 'A test product',
    slug: 'test-product',
    collectionIds: [randomUUIDv7()],
    variantIds: variantId ? [variantId] : [randomUUIDv7()], // Product requires at least one variant
    richDescriptionUrl: 'https://example.com/description',
    productType: 'physical',
    fulfillmentType: 'digital' as const,
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

function createValidVariantCommand(productId: string): CreateVariantCommand {
  return {
    id: randomUUIDv7(),
    correlationId: randomUUIDv7(),
    userId: randomUUIDv7(),
    productId,
    sku: 'SKU-123',
    price: 29.99,
    inventory: 100,
    options: { Size: 'L', Color: 'Red' },
  }
}

describe('UpdateVariantDetailsService', () => {
  test('should successfully update variant details', async () => {
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
    const updateCommand: UpdateVariantDetailsCommand = {
      id: variantCommand.id,
      userId: variantCommand.userId,
      options: { Size: 'XL', Color: 'Blue' },
      expectedVersion: JSON.parse(variantSnapshot.payload).version,
    }

    const updateService = new UpdateVariantDetailsService(unitOfWork, projectionService)

    // Act
    await updateService.execute(updateCommand)

    // Assert - Verify variant.details_updated event was saved
    await new Promise(resolve => setTimeout(resolve, 100))
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(variantCommand.id) as any[]
    expect(events.length).toBe(2)
    expect(events[1]!.event_type).toBe('variant.details_updated')
    expect(events[1]!.version).toBe(1)

    const eventPayload = JSON.parse(events[1]!.payload)
    expect(eventPayload.newState.options).toEqual({ Size: 'XL', Color: 'Blue' })

    // Assert - Verify snapshot was updated
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(variantCommand.id) as any
    expect(snapshot.version).toBe(1)
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.options).toEqual({ Size: 'XL', Color: 'Blue' })

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
    const service = new UpdateVariantDetailsService(unitOfWork, projectionService)
    const command: UpdateVariantDetailsCommand = {
      id: randomUUIDv7(),
      userId: randomUUIDv7(),
      options: { Size: 'L' },
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

    const updateCommand: UpdateVariantDetailsCommand = {
      id: variantCommand.id,
      userId: variantCommand.userId,
      options: { Size: 'L', Color: 'Red' },
      expectedVersion: 5, // Wrong version
    }

    const updateService = new UpdateVariantDetailsService(unitOfWork, projectionService)

    // Act & Assert
    await expect(updateService.execute(updateCommand)).rejects.toThrow('Optimistic concurrency conflict')
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

    const productService = new CreateProductService(unitOfWork, projectionService)
    const productCommand = createValidProductCommand()
    await productService.execute(productCommand)

    const createVariantService = new CreateVariantService(unitOfWork, projectionService)
    const variantCommand = createValidVariantCommand(productCommand.id)
    await createVariantService.execute(variantCommand)

    await new Promise(resolve => setTimeout(resolve, 100))

    const variantSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(variantCommand.id) as any
    const updateCommand: UpdateVariantDetailsCommand = {
      id: variantCommand.id,
      userId: variantCommand.userId,
      options: { Size: 'XXL', Color: 'Red' }, // XXL is not valid
      expectedVersion: JSON.parse(variantSnapshot.payload).version,
    }

    const updateService = new UpdateVariantDetailsService(unitOfWork, projectionService)

    // Act & Assert
    await expect(updateService.execute(updateCommand)).rejects.toThrow('Value "XXL" is not valid')
    batcher.stop()
    db.close()
  })

  test('should throw error when variant options missing required option', async () => {
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
    const updateCommand: UpdateVariantDetailsCommand = {
      id: variantCommand.id,
      userId: variantCommand.userId,
      options: { Size: 'L' }, // Missing Color
      expectedVersion: JSON.parse(variantSnapshot.payload).version,
    }

    const updateService = new UpdateVariantDetailsService(unitOfWork, projectionService)

    // Act & Assert
    await expect(updateService.execute(updateCommand)).rejects.toThrow('Missing required option')
    batcher.stop()
    db.close()
  })

})

