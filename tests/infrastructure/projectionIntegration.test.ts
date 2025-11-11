import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { CreateProductService } from '../../src/app/product/createProductService'
import { UnitOfWork } from '../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../src/infrastructure/transactionBatcher'
import { ProjectionService } from '../../src/infrastructure/projectionService'
import { productListViewProjection } from '../../src/views/product/productListViewProjection'
import { schemas } from '../../src/infrastructure/schemas'
import type { CreateProductCommand } from '../../src/app/product/commands'

function createValidCommand(overrides?: Partial<CreateProductCommand>): CreateProductCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    correlationId: overrides?.correlationId ?? randomUUIDv7(),
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

describe('Projection Integration', () => {
  test('should create projection when product is created', async () => {
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
    const service = new CreateProductService(unitOfWork, projectionService)
    const command = createValidCommand()

    // Act
    await service.execute(command)

    // Assert - Verify projection was created
    const projections = db.query('SELECT * FROM projections WHERE aggregate_id = ?').all(command.id) as any[]
    expect(projections.length).toBe(1)
    
    const projection = projections[0]!
    expect(projection.projection_type).toBe('product_list_view')
    expect(projection.aggregate_id).toBe(command.id)
    expect(projection.correlation_id).toBe(command.correlationId)
    expect(projection.version).toBe(0)

    const projectionPayload = JSON.parse(projection.payload)
    expect(projectionPayload.id).toBe(command.id)
    expect(projectionPayload.title).toBe(command.title)
    expect(projectionPayload.slug).toBe(command.slug)
    expect(projectionPayload.vendor).toBe(command.vendor)
    expect(projectionPayload.productType).toBe(command.productType)
    expect(projectionPayload.shortDescription).toBe(command.shortDescription)
    expect(projectionPayload.tags).toEqual(command.tags)

    batcher.stop()
    db.close()
  })

  test('should create projection in same transaction as event', async () => {
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
    const service = new CreateProductService(unitOfWork, projectionService)
    const command = createValidCommand()

    // Act
    await service.execute(command)

    // Assert - Both event and projection should exist
    const event = db.query('SELECT * FROM events WHERE aggregate_id = ?').get(command.id) as any
    expect(event).toBeDefined()

    const projection = db.query('SELECT * FROM projections WHERE aggregate_id = ?').get(command.id) as any
    expect(projection).toBeDefined()
    
    // Both should have same correlation_id and version
    expect(event.correlation_id).toBe(projection.correlation_id)
    expect(event.version).toBe(projection.version)

    batcher.stop()
    db.close()
  })

  test('should rollback projection when transaction fails', async () => {
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
    const service = new CreateProductService(unitOfWork, projectionService)
    const command = createValidCommand({ variantIds: [] }) // This will cause validation error

    // Act & Assert - Transaction should fail
    await expect(service.execute(command)).rejects.toThrow()

    // Assert - No projection should be created
    const projectionCount = db.query('SELECT COUNT(*) as count FROM projections').get() as { count: number }
    expect(projectionCount.count).toBe(0)

    // Assert - No event should be created either
    const eventCount = db.query('SELECT COUNT(*) as count FROM events').get() as { count: number }
    expect(eventCount.count).toBe(0)

    batcher.stop()
    db.close()
  })

  test('should create multiple projections when multiple handlers are registered', async () => {
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
    
    // Register multiple handlers for the same event
    projectionService.registerHandler('product.created', productListViewProjection)
    
    // Register a second handler
    let secondHandlerCalled = false
    const secondHandler = async (event: any, repository: any) => {
      secondHandlerCalled = true
      repository.saveProjection({
        id: randomUUIDv7(),
        projection_type: 'product_search_index',
        aggregate_id: event.aggregateId,
        correlation_id: event.correlationId,
        version: event.version,
        payload: JSON.stringify({ 
          id: event.aggregateId,
          title: event.payload.title,
          slug: event.payload.slug
        }),
        created_at: event.occurredAt.getTime()
      })
    }
    projectionService.registerHandler('product.created', secondHandler)
    
    const service = new CreateProductService(unitOfWork, projectionService)
    const command = createValidCommand()

    // Act
    await service.execute(command)

    // Assert - Both projections should be created
    const projections = db.query('SELECT * FROM projections WHERE aggregate_id = ?').all(command.id) as any[]
    expect(projections.length).toBe(2)
    
    const projectionTypes = projections.map(p => p.projection_type).sort()
    expect(projectionTypes).toEqual(['product_list_view', 'product_search_index'])
    
    expect(secondHandlerCalled).toBe(true)

    batcher.stop()
    db.close()
  })

  test('should create projection with correct timestamp', async () => {
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
    const service = new CreateProductService(unitOfWork, projectionService)
    const command = createValidCommand()

    const beforeTime = Date.now()

    // Act
    await service.execute(command)

    const afterTime = Date.now()

    // Assert - Verify timestamp is within expected range
    const projection = db.query('SELECT * FROM projections WHERE aggregate_id = ?').get(command.id) as any
    expect(projection.created_at).toBeGreaterThanOrEqual(beforeTime)
    expect(projection.created_at).toBeLessThanOrEqual(afterTime)

    batcher.stop()
    db.close()
  })

  test('should create projection with all required fields from productListViewProjection', async () => {
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
    const service = new CreateProductService(unitOfWork, projectionService)
    const command = createValidCommand({
      title: 'Amazing Product',
      slug: 'amazing-product',
      vendor: 'Cool Vendor',
      productType: 'digital',
      shortDescription: 'This is an amazing product',
      tags: ['awesome', 'digital', 'cool']
    })

    // Act
    await service.execute(command)

    // Assert - Verify projection payload contains all expected fields
    const projection = db.query('SELECT * FROM projections WHERE aggregate_id = ?').get(command.id) as any
    const payload = JSON.parse(projection.payload)
    
    expect(payload.id).toBe(command.id)
    expect(payload.title).toBe('Amazing Product')
    expect(payload.slug).toBe('amazing-product')
    expect(payload.vendor).toBe('Cool Vendor')
    expect(payload.productType).toBe('digital')
    expect(payload.shortDescription).toBe('This is an amazing product')
    expect(payload.tags).toEqual(['awesome', 'digital', 'cool'])
    expect(payload.createdAt).toBeDefined()
    expect(typeof payload.createdAt).toBe('string')

    batcher.stop()
    db.close()
  })

  test('should not create projection for unregistered event types', async () => {
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
    // Don't register any handlers
    const service = new CreateProductService(unitOfWork, projectionService)
    const command = createValidCommand()

    // Act
    await service.execute(command)

    // Assert - Event should be created but no projection
    const event = db.query('SELECT * FROM events WHERE aggregate_id = ?').get(command.id) as any
    expect(event).toBeDefined()

    const projectionCount = db.query('SELECT COUNT(*) as count FROM projections').get() as { count: number }
    expect(projectionCount.count).toBe(0)

    batcher.stop()
    db.close()
  })

  test('should handle projection creation errors and rollback transaction', async () => {
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
    
    // Register a handler that throws an error
    const errorHandler = async () => {
      throw new Error('Projection handler error')
    }
    projectionService.registerHandler('product.created', errorHandler)
    
    const service = new CreateProductService(unitOfWork, projectionService)
    const command = createValidCommand()

    // Act & Assert - Should throw error from handler
    await expect(service.execute(command)).rejects.toThrow('Projection handler error')

    // Assert - Nothing should be persisted
    const eventCount = db.query('SELECT COUNT(*) as count FROM events').get() as { count: number }
    expect(eventCount.count).toBe(0)

    const projectionCount = db.query('SELECT COUNT(*) as count FROM projections').get() as { count: number }
    expect(projectionCount.count).toBe(0)

    batcher.stop()
    db.close()
  })
})

