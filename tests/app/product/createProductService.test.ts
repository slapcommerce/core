import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { CreateProductService } from '../../../src/app/product/createProductService'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { schemas } from '../../../src/infrastructure/schemas'
import { ProjectionService } from '../../../src/infrastructure/projectionService'
import { productListViewProjection } from '../../../src/views/product/productListViewProjection'
import type { CreateProductCommand } from '../../../src/app/product/commands'

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

describe('CreateProductService', () => {
  test('should successfully create a product with all required data', async () => {
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
    const service = new CreateProductService(unitOfWork, projectionService)
    const command = createValidCommand()

    // Act
    await service.execute(command)

    // Assert - Verify event was saved
    const event = db.query('SELECT * FROM events WHERE aggregate_id = ?').get(command.id) as any
    expect(event).toBeDefined()
    expect(event.event_type).toBe('product.created')
    expect(event.aggregate_id).toBe(command.id)
    expect(event.correlation_id).toBe(command.correlationId)
    expect(event.version).toBe(0)

    const eventPayload = JSON.parse(event.payload)
    expect(eventPayload.newState.title).toBe(command.title)
    expect(eventPayload.newState.slug).toBe(command.slug)

    // Assert - Verify snapshot was saved
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(command.id) as any
    expect(snapshot).toBeDefined()
    expect(snapshot.aggregate_id).toBe(command.id)
    expect(snapshot.correlation_id).toBe(command.correlationId)
    expect(snapshot.version).toBe(0)

    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.title).toBe(command.title)
    expect(snapshotPayload.status).toBe('draft')

    // Assert - Verify outbox event was saved
    const outboxEvent = db.query('SELECT * FROM outbox WHERE aggregate_id = ?').get(command.id) as any
    expect(outboxEvent).toBeDefined()
    expect(outboxEvent.aggregate_id).toBe(command.id)
    expect(outboxEvent.event_type).toBe('product.created')
    expect(outboxEvent.status).toBe('pending')

    batcher.stop()
    db.close()
  })

  test('should create projection when product is created with registered handler', async () => {
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
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const projection = db.query('SELECT * FROM projections WHERE aggregate_id = ? AND projection_type = ?').get(command.id, 'product_list_view') as any
    expect(projection).toBeDefined()
    expect(projection.aggregate_id).toBe(command.id)
    expect(projection.correlation_id).toBe(command.correlationId)
    expect(projection.version).toBe(0)
    expect(projection.projection_type).toBe('product_list_view')
    
    const payload = JSON.parse(projection.payload)
    expect(payload.id).toBe(command.id)
    expect(payload.title).toBe(command.title)
    expect(payload.slug).toBe(command.slug)
    expect(payload.vendor).toBe(command.vendor)
    expect(payload.productType).toBe(command.productType)
    expect(payload.shortDescription).toBe(command.shortDescription)
    expect(payload.status).toBe('draft')
    expect(payload.tags).toEqual(command.tags)

    batcher.stop()
    db.close()
  })

  test('should throw error when product has no variants', async () => {
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
    const service = new CreateProductService(unitOfWork, projectionService)
    const command = createValidCommand({ variantIds: [] })

    // Act & Assert
    await expect(service.execute(command)).rejects.toThrow('Product must have at least one variant')

    // Assert - Verify nothing was saved
    const eventCount = db.query('SELECT COUNT(*) as count FROM events').get() as { count: number }
    expect(eventCount.count).toBe(0)

    const snapshotCount = db.query('SELECT COUNT(*) as count FROM snapshots').get() as { count: number }
    expect(snapshotCount.count).toBe(0)

    const outboxCount = db.query('SELECT COUNT(*) as count FROM outbox').get() as { count: number }
    expect(outboxCount.count).toBe(0)

    const projectionCount = db.query('SELECT COUNT(*) as count FROM product_list_view').get() as { count: number }
    expect(projectionCount.count).toBe(0)

    batcher.stop()
    db.close()
  })

  test('should throw error when product has no collections', async () => {
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
    const service = new CreateProductService(unitOfWork, projectionService)
    const command = createValidCommand({ collectionIds: [] })

    // Act & Assert
    await expect(service.execute(command)).rejects.toThrow('Product must have at least one collection')

    // Assert - Verify nothing was saved
    const eventCount = db.query('SELECT COUNT(*) as count FROM events').get() as { count: number }
    expect(eventCount.count).toBe(0)

    const snapshotCount = db.query('SELECT COUNT(*) as count FROM snapshots').get() as { count: number }
    expect(snapshotCount.count).toBe(0)

    const outboxCount = db.query('SELECT COUNT(*) as count FROM outbox').get() as { count: number }
    expect(outboxCount.count).toBe(0)

    const projectionCount = db.query('SELECT COUNT(*) as count FROM product_list_view').get() as { count: number }
    expect(projectionCount.count).toBe(0)

    batcher.stop()
    db.close()
  })

  test('should save product with multiple variants and collections', async () => {
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
    const service = new CreateProductService(unitOfWork, projectionService)
    const command = createValidCommand({
      variantIds: [randomUUIDv7(), randomUUIDv7(), randomUUIDv7()],
      collectionIds: [randomUUIDv7(), randomUUIDv7()]
    })

    // Act
    await service.execute(command)

    // Assert - Verify event payload contains all variants and collections
    const event = db.query('SELECT * FROM events WHERE aggregate_id = ?').get(command.id) as any
    const eventPayload = JSON.parse(event.payload)
    expect(eventPayload.newState.variantIds.length).toBe(3)
    expect(eventPayload.newState.collectionIds.length).toBe(2)

    // Assert - Verify snapshot contains all variants and collections
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(command.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.variantIds.length).toBe(3)
    expect(snapshotPayload.collectionIds.length).toBe(2)

    batcher.stop()
    db.close()
  })

  test('should save product with all optional fields', async () => {
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
    const service = new CreateProductService(unitOfWork, projectionService)
    const command = createValidCommand({
      shortDescription: 'A detailed description',
      richDescriptionUrl: 'https://example.com/rich-description',
      variantOptions: [
        { name: 'Size', values: ['S', 'M', 'L', 'XL'] },
        { name: 'Color', values: ['Red', 'Blue', 'Green'] }
      ],
      tags: ['tag1', 'tag2', 'tag3'],
      requiresShipping: false,
      taxable: false,
      pageLayoutId: randomUUIDv7()
    })

    // Act
    await service.execute(command)

    // Assert - Verify all fields are saved correctly
    const event = db.query('SELECT * FROM events WHERE aggregate_id = ?').get(command.id) as any
    const eventPayload = JSON.parse(event.payload)
    expect(eventPayload.newState.shortDescription).toBe('A detailed description')
    expect(eventPayload.newState.richDescriptionUrl).toBe('https://example.com/rich-description')
    expect(eventPayload.newState.variantOptions.length).toBe(2)
    expect(eventPayload.newState.tags.length).toBe(3)
    expect(eventPayload.newState.requiresShipping).toBe(false)
    expect(eventPayload.newState.taxable).toBe(false)
    expect(eventPayload.newState.pageLayoutId).toBe(command.pageLayoutId)

    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(command.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.shortDescription).toBe('A detailed description')
    expect(snapshotPayload.requiresShipping).toBe(false)
    expect(snapshotPayload.taxable).toBe(false)

    batcher.stop()
    db.close()
  })

  test('should save product with null pageLayoutId', async () => {
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
    const service = new CreateProductService(unitOfWork, projectionService)
    const command = createValidCommand({ pageLayoutId: null })

    // Act
    await service.execute(command)

    // Assert - Verify null pageLayoutId is handled correctly
    const event = db.query('SELECT * FROM events WHERE aggregate_id = ?').get(command.id) as any
    const eventPayload = JSON.parse(event.payload)
    expect(eventPayload.newState.pageLayoutId).toBeNull()

    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(command.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.pageLayoutId).toBeNull()

    batcher.stop()
    db.close()
  })

  test('should create outbox event with generated UUID', async () => {
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
    const service = new CreateProductService(unitOfWork, projectionService)
    const command = createValidCommand()

    // Act
    await service.execute(command)

    // Assert - Verify outbox event has a valid UUID
    const outboxEvent = db.query('SELECT * FROM outbox WHERE aggregate_id = ?').get(command.id) as any
    expect(outboxEvent).toBeDefined()
    expect(outboxEvent.id).toBeDefined()
    expect(outboxEvent.id.length).toBeGreaterThan(0)
    // UUID v7 format check (basic validation)
    expect(outboxEvent.id).toMatch(/^[0-9a-f-]+$/)

    batcher.stop()
    db.close()
  })

  test('should set initial version to 0', async () => {
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
    const service = new CreateProductService(unitOfWork, projectionService)
    const command = createValidCommand()

    // Act
    await service.execute(command)

    // Assert - Verify version is 0
    const event = db.query('SELECT * FROM events WHERE aggregate_id = ?').get(command.id) as any
    expect(event.version).toBe(0)

    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(command.id) as any
    expect(snapshot.version).toBe(0)

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
    const service = new CreateProductService(unitOfWork, projectionService)
    const command = createValidCommand({ variantIds: [] })

    // Act & Assert - This should fail validation
    await expect(service.execute(command)).rejects.toThrow()

    // Assert - Verify nothing was persisted
    const eventCount = db.query('SELECT COUNT(*) as count FROM events').get() as { count: number }
    expect(eventCount.count).toBe(0)

    const snapshotCount = db.query('SELECT COUNT(*) as count FROM snapshots').get() as { count: number }
    expect(snapshotCount.count).toBe(0)

    const outboxCount = db.query('SELECT COUNT(*) as count FROM outbox').get() as { count: number }
    expect(outboxCount.count).toBe(0)

    const projectionCount = db.query('SELECT COUNT(*) as count FROM product_list_view').get() as { count: number }
    expect(projectionCount.count).toBe(0)

    batcher.stop()
    db.close()
  })

  test('should reserve slug in SlugRegistry when product is created', async () => {
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
    const command = createValidCommand({ slug: 'test-slug' })

    // Act
    await service.execute(command)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - Verify slug aggregate was created and slug is reserved
    const slugSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get('test-slug') as any
    expect(slugSnapshot).toBeDefined()
    
    const slugPayload = JSON.parse(slugSnapshot.payload)
    expect(slugPayload.slug).toBe('test-slug')
    expect(slugPayload.productId).toBe(command.id)
    expect(slugPayload.status).toBe('active')

    // Assert - Verify slug reserved event was saved
    const slugReservedEvents = db.query('SELECT * FROM events WHERE aggregate_id = ? AND event_type = ?').all('test-slug', 'slug.reserved') as any[]
    expect(slugReservedEvents.length).toBeGreaterThanOrEqual(1)
    
    const reservedEvent = slugReservedEvents.find(e => {
      const payload = JSON.parse(e.payload)
      return payload.newState.slug === 'test-slug' && payload.newState.productId === command.id
    })
    expect(reservedEvent).toBeDefined()

    batcher.stop()
    db.close()
  })

  test('should throw error when creating product with duplicate slug', async () => {
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
    
    const command1 = createValidCommand({ slug: 'duplicate-slug' })
    await service.execute(command1)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const command2 = createValidCommand({ slug: 'duplicate-slug' })

    // Act & Assert
    await expect(service.execute(command2)).rejects.toThrow('Slug "duplicate-slug" is already in use')

    batcher.stop()
    db.close()
  })
})

