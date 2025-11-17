import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { CreateVariantService } from '../../../src/app/variant/createVariantService'
import { CreateProductService } from '../../../src/app/product/createProductService'
import { PublishVariantService } from '../../../src/app/variant/publishVariantService'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { schemas } from '../../../src/infrastructure/schemas'
import { ProjectionService } from '../../../src/infrastructure/projectionService'
import { productVariantProjection } from '../../../src/views/product/productVariantProjection'
import type { CreateVariantCommand } from '../../../src/app/variant/commands'
import type { CreateProductCommand } from '../../../src/app/product/commands'
import type { PublishVariantCommand } from '../../../src/app/variant/commands'

function createValidProductCommand(overrides?: Partial<CreateProductCommand>): CreateProductCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    correlationId: overrides?.correlationId ?? randomUUIDv7(),
    userId: overrides?.userId ?? randomUUIDv7(),
    title: 'Test Product',
    shortDescription: 'A test product',
    slug: 'test-product',
    collectionIds: [randomUUIDv7()],
    variantIds: overrides?.variantIds ?? [randomUUIDv7()],
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

function createPublishCommand(overrides?: Partial<PublishVariantCommand>): PublishVariantCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    userId: overrides?.userId ?? randomUUIDv7(),
    expectedVersion: overrides?.expectedVersion ?? 0,
  }
}

describe('PublishVariantService', () => {
  test('should successfully publish a variant', async () => {
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
    projectionService.registerHandler('variant.published', productVariantProjection)
    
    const productService = new CreateProductService(unitOfWork, projectionService)
    const productCommand = createValidProductCommand()
    await productService.execute(productCommand)

    const createService = new CreateVariantService(unitOfWork, projectionService)
    const variantCommand = createValidVariantCommand(productCommand.id)
    await createService.execute(variantCommand)

    // Wait for batch to flush to ensure snapshot is persisted
    await new Promise(resolve => setTimeout(resolve, 100))

    const publishService = new PublishVariantService(unitOfWork, projectionService)
    const publishCommand = createPublishCommand({
      id: variantCommand.id,
      expectedVersion: 0,
    })

    // Act
    await publishService.execute(publishCommand)

    // Assert - Verify published event was saved
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(variantCommand.id) as any[]
    expect(events.length).toBe(2)
    expect(events[0]!.event_type).toBe('variant.created')
    expect(events[1]!.event_type).toBe('variant.published')
    expect(events[1]!.version).toBe(1)
    expect(events[1]!.correlation_id).toBe(variantCommand.correlationId)

    // Assert - Verify snapshot was updated
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(variantCommand.id) as any
    expect(snapshot).toBeDefined()
    expect(snapshot.version).toBe(1)
    
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.status).toBe('active')
    expect(snapshotPayload.publishedAt).toBeDefined()
    expect(snapshotPayload.publishedAt).not.toBeNull()

    // Assert - Verify outbox event was saved
    const outboxEvents = db.query('SELECT * FROM outbox WHERE aggregate_id = ? ORDER BY event_type').all(variantCommand.id) as any[]
    expect(outboxEvents.length).toBe(2)
    const publishedOutboxEvent = outboxEvents.find(e => e.event_type === 'variant.published')
    expect(publishedOutboxEvent).toBeDefined()
    expect(publishedOutboxEvent!.status).toBe('pending')

    batcher.stop()
    db.close()
  })

  test('should throw error when variant does not exist', async () => {
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
    const publishService = new PublishVariantService(unitOfWork, projectionService)
    const publishCommand = createPublishCommand()

    // Act & Assert
    await expect(publishService.execute(publishCommand)).rejects.toThrow('not found')

    // Assert - Verify nothing was saved
    const eventCount = db.query('SELECT COUNT(*) as count FROM events').get() as { count: number }
    expect(eventCount.count).toBe(0)

    batcher.stop()
    db.close()
  })

  test('should throw error when variant is already published', async () => {
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
    projectionService.registerHandler('variant.published', productVariantProjection)
    
    const productService = new CreateProductService(unitOfWork, projectionService)
    const productCommand = createValidProductCommand()
    await productService.execute(productCommand)

    const createService = new CreateVariantService(unitOfWork, projectionService)
    const variantCommand = createValidVariantCommand(productCommand.id)
    await createService.execute(variantCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const publishService = new PublishVariantService(unitOfWork, projectionService)
    const publishCommand1 = createPublishCommand({
      id: variantCommand.id,
      expectedVersion: 0,
    })
    await publishService.execute(publishCommand1)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const publishCommand2 = createPublishCommand({
      id: variantCommand.id,
      expectedVersion: 1,
    })

    // Act & Assert
    await expect(publishService.execute(publishCommand2)).rejects.toThrow('already published')

    // Assert - Verify only one published event exists
    const publishedEvents = db.query("SELECT * FROM events WHERE aggregate_id = ? AND event_type = 'variant.published'").all(variantCommand.id) as any[]
    expect(publishedEvents.length).toBe(1)

    batcher.stop()
    db.close()
  })

  test('should throw error when variant is archived', async () => {
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
    projectionService.registerHandler('variant.archived', productVariantProjection)
    
    const productService = new CreateProductService(unitOfWork, projectionService)
    const productCommand = createValidProductCommand()
    await productService.execute(productCommand)

    const createService = new CreateVariantService(unitOfWork, projectionService)
    const variantCommand = createValidVariantCommand(productCommand.id)
    await createService.execute(variantCommand)

    const { ArchiveVariantService } = await import('../../../src/app/variant/archiveVariantService')
    const archiveService = new ArchiveVariantService(unitOfWork, projectionService)
    const archiveCommand = { id: variantCommand.id, userId: variantCommand.userId, expectedVersion: 0 }
    await archiveService.execute(archiveCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const publishService = new PublishVariantService(unitOfWork, projectionService)
    const publishCommand = createPublishCommand({
      id: variantCommand.id,
      expectedVersion: 1,
    })

    // Act & Assert
    await expect(publishService.execute(publishCommand)).rejects.toThrow('Cannot publish an archived variant')

    // Assert - Verify no published event exists
    const publishedEvents = db.query("SELECT * FROM events WHERE aggregate_id = ? AND event_type = 'variant.published'").all(variantCommand.id) as any[]
    expect(publishedEvents.length).toBe(0)

    batcher.stop()
    db.close()
  })

  test('should throw error when expected version does not match snapshot version', async () => {
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
    projectionService.registerHandler('variant.published', productVariantProjection)
    
    const productService = new CreateProductService(unitOfWork, projectionService)
    const productCommand = createValidProductCommand()
    await productService.execute(productCommand)

    const createService = new CreateVariantService(unitOfWork, projectionService)
    const variantCommand = createValidVariantCommand(productCommand.id)
    await createService.execute(variantCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify snapshot version is 0
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(variantCommand.id) as any
    expect(snapshot.version).toBe(0)

    const publishService = new PublishVariantService(unitOfWork, projectionService)
    const publishCommand = createPublishCommand({
      id: variantCommand.id,
      expectedVersion: 3, // Wrong version - should be 0
    })

    // Act & Assert
    await expect(publishService.execute(publishCommand)).rejects.toThrow('Optimistic concurrency conflict: expected version 3 but found version 0')

    // Assert - Verify nothing was persisted (no published event)
    const publishedEvents = db.query("SELECT * FROM events WHERE aggregate_id = ? AND event_type = 'variant.published'").all(variantCommand.id) as any[]
    expect(publishedEvents.length).toBe(0)

    // Assert - Verify snapshot version was not changed
    const updatedSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(variantCommand.id) as any
    expect(updatedSnapshot.version).toBe(0)

    batcher.stop()
    db.close()
  })

  test('should succeed when expected version matches snapshot version', async () => {
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
    projectionService.registerHandler('variant.published', productVariantProjection)
    
    const productService = new CreateProductService(unitOfWork, projectionService)
    const productCommand = createValidProductCommand()
    await productService.execute(productCommand)

    const createService = new CreateVariantService(unitOfWork, projectionService)
    const variantCommand = createValidVariantCommand(productCommand.id)
    await createService.execute(variantCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Get the current snapshot version
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(variantCommand.id) as any
    expect(snapshot.version).toBe(0)

    const publishService = new PublishVariantService(unitOfWork, projectionService)
    const publishCommand = createPublishCommand({
      id: variantCommand.id,
      expectedVersion: 0, // Correct version
    })

    // Act
    await publishService.execute(publishCommand)

    // Assert - Verify published event was saved
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(variantCommand.id) as any[]
    expect(events.length).toBe(2)
    expect(events[1]!.event_type).toBe('variant.published')
    expect(events[1]!.version).toBe(1)

    // Assert - Verify snapshot version was incremented
    const updatedSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(variantCommand.id) as any
    expect(updatedSnapshot.version).toBe(1)

    batcher.stop()
    db.close()
  })

  test('should handle transaction rollback on error', async () => {
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
    const publishService = new PublishVariantService(unitOfWork, projectionService)
    const publishCommand = createPublishCommand()

    // Act & Assert - This should fail because variant doesn't exist
    await expect(publishService.execute(publishCommand)).rejects.toThrow()

    // Assert - Verify nothing was persisted
    const eventCount = db.query('SELECT COUNT(*) as count FROM events').get() as { count: number }
    expect(eventCount.count).toBe(0)

    const snapshotCount = db.query('SELECT COUNT(*) as count FROM snapshots').get() as { count: number }
    expect(snapshotCount.count).toBe(0)

    const outboxCount = db.query('SELECT COUNT(*) as count FROM outbox').get() as { count: number }
    expect(outboxCount.count).toBe(0)

    batcher.stop()
    db.close()
  })
})

