import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { CreateProductService } from '../../../src/app/product/createProductService'
import { UpdateProductTagsService } from '../../../src/app/product/updateProductTagsService'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { schemas } from '../../../src/infrastructure/schemas'
import { ProjectionService } from '../../../src/infrastructure/projectionService'
import { productListViewProjection } from '../../../src/views/product/productListViewProjection'
import type { CreateProductCommand } from '../../../src/app/product/commands'
import type { UpdateProductTagsCommand } from '../../../src/app/product/commands'

function createValidCommand(overrides?: Partial<CreateProductCommand>): CreateProductCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    userId: overrides?.userId ?? randomUUIDv7(),
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

function createUpdateTagsCommand(overrides?: Partial<UpdateProductTagsCommand>): UpdateProductTagsCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    userId: overrides?.userId ?? randomUUIDv7(),
    tags: overrides?.tags ?? ['new-tag1', 'new-tag2'],
    expectedVersion: overrides?.expectedVersion ?? 0,
  }
}

describe('UpdateProductTagsService', () => {
  test('should successfully update product tags', async () => {
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
    projectionService.registerHandler('product.tags_updated', productListViewProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const updateService = new UpdateProductTagsService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const updateCommand = createUpdateTagsCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })

    // Act
    await updateService.execute(updateCommand)

    // Assert - Verify tags updated event was saved
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(createCommand.id) as any[]
    expect(events.length).toBe(2)
    expect(events[0]!.event_type).toBe('product.created')
    expect(events[1]!.event_type).toBe('product.tags_updated')
    expect(events[1]!.version).toBe(1)

    // Assert - Verify snapshot was updated
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.tags).toEqual(['new-tag1', 'new-tag2'])

    // Assert - Verify outbox event was saved
    const outboxEvents = db.query('SELECT * FROM outbox WHERE aggregate_id = ? ORDER BY event_type').all(createCommand.id) as any[]
    expect(outboxEvents.length).toBe(2)
    const tagsUpdatedOutboxEvent = outboxEvents.find(e => e.event_type === 'product.tags_updated')
    expect(tagsUpdatedOutboxEvent).toBeDefined()
    expect(tagsUpdatedOutboxEvent!.status).toBe('pending')

    batcher.stop()
    db.close()
  })

  test('should allow empty tags array', async () => {
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
    projectionService.registerHandler('product.tags_updated', productListViewProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const updateService = new UpdateProductTagsService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const updateCommand = createUpdateTagsCommand({
      id: createCommand.id,
      tags: [],
      expectedVersion: 0,
    })

    // Act
    await updateService.execute(updateCommand)

    // Assert - Verify snapshot was updated with empty tags
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.tags).toEqual([])

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
    const updateService = new UpdateProductTagsService(unitOfWork, projectionService)
    const updateCommand = createUpdateTagsCommand()

    // Act & Assert
    await expect(updateService.execute(updateCommand)).rejects.toThrow('not found')

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
    const updateService = new UpdateProductTagsService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const updateCommand = createUpdateTagsCommand({
      id: createCommand.id,
      expectedVersion: 5, // Wrong version
    })

    // Act & Assert
    await expect(updateService.execute(updateCommand)).rejects.toThrow('Optimistic concurrency conflict')

    batcher.stop()
    db.close()
  })
})

