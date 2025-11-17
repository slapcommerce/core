import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { CreateProductService } from '../../../src/app/product/createProductService'
import { UpdateProductDetailsService } from '../../../src/app/product/updateProductDetailsService'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { schemas } from '../../../src/infrastructure/schemas'
import { ProjectionService } from '../../../src/infrastructure/projectionService'
import { productListViewProjection } from '../../../src/views/product/productListViewProjection'
import type { CreateProductCommand } from '../../../src/app/product/commands'
import type { UpdateProductDetailsCommand } from '../../../src/app/product/commands'

function createValidCommand(overrides?: Partial<CreateProductCommand>): CreateProductCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    correlationId: overrides?.correlationId ?? randomUUIDv7(),
    userId: overrides?.userId ?? randomUUIDv7(),
    title: overrides?.title ?? 'Test Product',
    shortDescription: overrides?.shortDescription ?? 'A test product',
    slug: overrides?.slug ?? 'test-product',
    collectionIds: overrides?.collectionIds ?? [randomUUIDv7()],
    variantIds: overrides?.variantIds ?? [randomUUIDv7()],
    richDescriptionUrl: overrides?.richDescriptionUrl ?? 'https://example.com/description',
    productType: overrides?.productType ?? 'physical',
    vendor: overrides?.vendor ?? 'Test Vendor',
    variantOptions: overrides?.variantOptions ?? [
      { name: 'Size', values: ['S', 'M', 'L'] }
    ],
    metaTitle: overrides?.metaTitle ?? 'Test Product Meta Title',
    metaDescription: overrides?.metaDescription ?? 'Test Product Meta Description',
    tags: overrides?.tags ?? ['test', 'product'],
    requiresShipping: overrides?.requiresShipping ?? true,
    taxable: overrides?.taxable ?? true,
    pageLayoutId: overrides?.pageLayoutId ?? null,
  }
}

function createUpdateDetailsCommand(overrides?: Partial<UpdateProductDetailsCommand>): UpdateProductDetailsCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    userId: overrides?.userId ?? randomUUIDv7(),
    title: overrides?.title ?? 'Updated Title',
    shortDescription: overrides?.shortDescription ?? 'Updated Description',
    richDescriptionUrl: overrides?.richDescriptionUrl ?? 'https://example.com/updated-description',
    expectedVersion: overrides?.expectedVersion ?? 0,
  }
}

describe('UpdateProductDetailsService', () => {
  test('should successfully update product details', async () => {
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
    projectionService.registerHandler('product.created', productListViewProjection)
    projectionService.registerHandler('product.details_updated', productListViewProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const updateService = new UpdateProductDetailsService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const updateCommand = createUpdateDetailsCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })

    // Act
    await updateService.execute(updateCommand)

    // Assert - Verify details updated event was saved
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(createCommand.id) as any[]
    expect(events.length).toBe(2)
    expect(events[0]!.event_type).toBe('product.created')
    expect(events[1]!.event_type).toBe('product.details_updated')
    expect(events[1]!.version).toBe(1)
    expect(events[1]!.correlation_id).toBe(createCommand.correlationId)

    // Assert - Verify snapshot was updated
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(snapshot).toBeDefined()
    expect(snapshot.version).toBe(1)
    
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.title).toBe('Updated Title')
    expect(snapshotPayload.shortDescription).toBe('Updated Description')
    expect(snapshotPayload.richDescriptionUrl).toBe('https://example.com/updated-description')

    // Assert - Verify outbox event was saved
    const outboxEvents = db.query('SELECT * FROM outbox WHERE aggregate_id = ? ORDER BY event_type').all(createCommand.id) as any[]
    expect(outboxEvents.length).toBe(2)
    const detailsUpdatedOutboxEvent = outboxEvents.find(e => e.event_type === 'product.details_updated')
    expect(detailsUpdatedOutboxEvent).toBeDefined()
    expect(detailsUpdatedOutboxEvent!.status).toBe('pending')

    batcher.stop()
    db.close()
  })

  test('should throw error when product does not exist', async () => {
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
    const updateService = new UpdateProductDetailsService(unitOfWork, projectionService)
    const updateCommand = createUpdateDetailsCommand()

    // Act & Assert
    await expect(updateService.execute(updateCommand)).rejects.toThrow('not found')

    // Assert - Verify nothing was saved
    const eventCount = db.query('SELECT COUNT(*) as count FROM events').get() as { count: number }
    expect(eventCount.count).toBe(0)

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
    projectionService.registerHandler('product.created', productListViewProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const updateService = new UpdateProductDetailsService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const updateCommand = createUpdateDetailsCommand({
      id: createCommand.id,
      expectedVersion: 5, // Wrong version - should be 0
    })

    // Act & Assert
    await expect(updateService.execute(updateCommand)).rejects.toThrow('Optimistic concurrency conflict: expected version 5 but found version 0')

    // Assert - Verify nothing was persisted (no details updated event)
    const detailsUpdatedEvents = db.query("SELECT * FROM events WHERE aggregate_id = ? AND event_type = 'product.details_updated'").all(createCommand.id) as any[]
    expect(detailsUpdatedEvents.length).toBe(0)

    batcher.stop()
    db.close()
  })

  test('should update snapshot version after updating details', async () => {
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
    projectionService.registerHandler('product.created', productListViewProjection)
    projectionService.registerHandler('product.details_updated', productListViewProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const updateService = new UpdateProductDetailsService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify initial snapshot version
    const initialSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(initialSnapshot.version).toBe(0)

    const updateCommand = createUpdateDetailsCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })

    // Act
    await updateService.execute(updateCommand)

    // Assert - Verify snapshot version was incremented
    const updatedSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(updatedSnapshot.version).toBe(1)

    batcher.stop()
    db.close()
  })
})

