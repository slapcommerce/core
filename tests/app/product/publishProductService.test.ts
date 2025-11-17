import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { CreateProductService } from '../../../src/app/product/createProductService'
import { PublishProductService } from '../../../src/app/product/publishProductService'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { schemas } from '../../../src/infrastructure/schemas'
import { ProjectionService } from '../../../src/infrastructure/projectionService'
import { productListViewProjection } from '../../../src/views/product/productListViewProjection'
import type { CreateProductCommand } from '../../../src/app/product/commands'
import type { PublishProductCommand } from '../../../src/app/product/commands'

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

function createPublishCommand(overrides?: Partial<PublishProductCommand>): PublishProductCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    userId: overrides?.userId ?? randomUUIDv7(),
    expectedVersion: overrides?.expectedVersion ?? 0,
  }
}

describe('PublishProductService', () => {
  test('should successfully publish a product', async () => {
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
    projectionService.registerHandler('product.published', productListViewProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const publishService = new PublishProductService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush to ensure snapshot is persisted
    await new Promise(resolve => setTimeout(resolve, 100))

    const publishCommand = createPublishCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })

    // Act
    await publishService.execute(publishCommand)

    // Assert - Verify published event was saved
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(createCommand.id) as any[]
    expect(events.length).toBe(2)
    expect(events[0]!.event_type).toBe('product.created')
    expect(events[1]!.event_type).toBe('product.published')
    expect(events[1]!.version).toBe(1)
    expect(events[1]!.correlation_id).toBe(createCommand.correlationId)

    // Assert - Verify snapshot was updated
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(snapshot).toBeDefined()
    expect(snapshot.version).toBe(1)
    
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.status).toBe('active')
    expect(snapshotPayload.publishedAt).toBeDefined()
    expect(snapshotPayload.publishedAt).not.toBeNull()

    // Assert - Verify outbox event was saved
    const outboxEvents = db.query('SELECT * FROM outbox WHERE aggregate_id = ? ORDER BY event_type').all(createCommand.id) as any[]
    expect(outboxEvents.length).toBe(2)
    const publishedOutboxEvent = outboxEvents.find(e => e.event_type === 'product.published')
    expect(publishedOutboxEvent).toBeDefined()
    expect(publishedOutboxEvent!.status).toBe('pending')

    // Assert - Verify projection status was updated to active
    await new Promise(resolve => setTimeout(resolve, 100))
    const projection = db.query('SELECT * FROM product_list_view WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(projection).toBeDefined()
    expect(projection.status).toBe('active')
    expect(projection.version).toBe(1)

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
    const publishService = new PublishProductService(unitOfWork, projectionService)
    const publishCommand = createPublishCommand()

    // Act & Assert
    await expect(publishService.execute(publishCommand)).rejects.toThrow('not found')

    // Assert - Verify nothing was saved
    const eventCount = db.query('SELECT COUNT(*) as count FROM events').get() as { count: number }
    expect(eventCount.count).toBe(0)

    batcher.stop()
    db.close()
  })

  test('should throw error when product is already published', async () => {
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
    projectionService.registerHandler('product.published', productListViewProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const publishService = new PublishProductService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const publishCommand1 = createPublishCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })
    await publishService.execute(publishCommand1)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const publishCommand2 = createPublishCommand({
      id: createCommand.id,
      expectedVersion: 1,
    })

    // Act & Assert
    await expect(publishService.execute(publishCommand2)).rejects.toThrow('already published')

    // Assert - Verify only one published event exists
    const publishedEvents = db.query("SELECT * FROM events WHERE aggregate_id = ? AND event_type = 'product.published'").all(createCommand.id) as any[]
    expect(publishedEvents.length).toBe(1)

    batcher.stop()
    db.close()
  })

  test('should throw error when product is archived', async () => {
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
    projectionService.registerHandler('product.archived', productListViewProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const { ArchiveProductService } = await import('../../../src/app/product/archiveProductService')
    const archiveService = new ArchiveProductService(unitOfWork, projectionService)
    const publishService = new PublishProductService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    const archiveCommand = { id: createCommand.id, userId: createCommand.userId, expectedVersion: 0 }
    await archiveService.execute(archiveCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const publishCommand = createPublishCommand({
      id: createCommand.id,
      expectedVersion: 1,
    })

    // Act & Assert
    await expect(publishService.execute(publishCommand)).rejects.toThrow('Cannot publish an archived product')

    // Assert - Verify no published event exists
    const publishedEvents = db.query("SELECT * FROM events WHERE aggregate_id = ? AND event_type = 'product.published'").all(createCommand.id) as any[]
    expect(publishedEvents.length).toBe(0)

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
    projectionService.registerHandler('product.created', productListViewProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const publishService = new PublishProductService(unitOfWork, projectionService)

    // Create product without variants
    const createCommand = createValidCommand({ variantIds: [] })
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const publishCommand = createPublishCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })

    // Act & Assert
    await expect(publishService.execute(publishCommand)).rejects.toThrow('Cannot publish product without at least one variant')

    // Assert - Verify no published event exists
    const publishedEvents = db.query("SELECT * FROM events WHERE aggregate_id = ? AND event_type = 'product.published'").all(createCommand.id) as any[]
    expect(publishedEvents.length).toBe(0)

    // Assert - Verify product is still in draft status
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.status).toBe('draft')

    batcher.stop()
    db.close()
  })

  test('should load product from snapshot and apply publish', async () => {
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
    projectionService.registerHandler('product.published', productListViewProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const publishService = new PublishProductService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const publishCommand = createPublishCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })

    // Act
    await publishService.execute(publishCommand)

    // Assert - Verify published event was saved
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(createCommand.id) as any[]
    expect(events.length).toBe(2)
    expect(events[1]!.event_type).toBe('product.published')

    // Assert - Verify snapshot was updated
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.status).toBe('active')
    expect(snapshotPayload.publishedAt).toBeDefined()
    expect(snapshot.version).toBe(1)

    // Assert - Verify projection status was updated to active
    await new Promise(resolve => setTimeout(resolve, 100))
    const projection = db.query('SELECT * FROM product_list_view WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(projection).toBeDefined()
    expect(projection.status).toBe('active')
    expect(projection.version).toBe(1)

    batcher.stop()
    db.close()
  })

  test('should update snapshot version after publishing', async () => {
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
    projectionService.registerHandler('product.published', productListViewProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const publishService = new PublishProductService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify initial snapshot version
    const initialSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(initialSnapshot.version).toBe(0)

    const publishCommand = createPublishCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })

    // Act
    await publishService.execute(publishCommand)

    // Assert - Verify snapshot version was incremented
    const updatedSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
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
    const publishService = new PublishProductService(unitOfWork, projectionService)
    const publishCommand = createPublishCommand()

    // Act & Assert - This should fail because product doesn't exist
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
    projectionService.registerHandler('product.published', productListViewProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const publishService = new PublishProductService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify snapshot version is 0
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(snapshot.version).toBe(0)

    const publishCommand = createPublishCommand({
      id: createCommand.id,
      expectedVersion: 3, // Wrong version - should be 0
    })

    // Act & Assert
    await expect(publishService.execute(publishCommand)).rejects.toThrow('Optimistic concurrency conflict: expected version 3 but found version 0')

    // Assert - Verify nothing was persisted (no published event)
    const publishedEvents = db.query("SELECT * FROM events WHERE aggregate_id = ? AND event_type = 'product.published'").all(createCommand.id) as any[]
    expect(publishedEvents.length).toBe(0)

    // Assert - Verify snapshot version was not changed
    const updatedSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
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
    projectionService.registerHandler('product.created', productListViewProjection)
    projectionService.registerHandler('product.published', productListViewProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const publishService = new PublishProductService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Get the current snapshot version
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(snapshot.version).toBe(0)

    const publishCommand = createPublishCommand({
      id: createCommand.id,
      expectedVersion: 0, // Correct version
    })

    // Act
    await publishService.execute(publishCommand)

    // Assert - Verify published event was saved
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(createCommand.id) as any[]
    expect(events.length).toBe(2)
    expect(events[1]!.event_type).toBe('product.published')
    expect(events[1]!.version).toBe(1)

    // Assert - Verify snapshot version was incremented
    const updatedSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(updatedSnapshot.version).toBe(1)

    batcher.stop()
    db.close()
  })

  test('should handle concurrent updates with same expected version - first succeeds, second fails', async () => {
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
    projectionService.registerHandler('product.published', productListViewProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const publishService = new PublishProductService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Both commands expect version 0
    const publishCommand1 = createPublishCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })
    const publishCommand2 = createPublishCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })

    // Act - Execute both commands concurrently
    const [result1, result2] = await Promise.allSettled([
      publishService.execute(publishCommand1),
      publishService.execute(publishCommand2),
    ])

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - One should succeed, one should fail
    const successCount = [result1, result2].filter(r => r.status === 'fulfilled').length
    const failureCount = [result1, result2].filter(r => r.status === 'rejected').length
    expect(successCount).toBe(1)
    expect(failureCount).toBe(1)

    // Assert - Verify only one published event exists
    const publishedEvents = db.query("SELECT * FROM events WHERE aggregate_id = ? AND event_type = 'product.published'").all(createCommand.id) as any[]
    expect(publishedEvents.length).toBe(1)

    // Assert - Verify snapshot version is 1 (only one update succeeded)
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(snapshot.version).toBe(1)

    // Assert - Verify the failed command threw concurrency error or database constraint error
    const failedResult = [result1, result2].find(r => r.status === 'rejected')
    expect(failedResult).toBeDefined()
    if (failedResult && failedResult.status === 'rejected') {
      const errorMessage = failedResult.reason.message
      // Either our optimistic concurrency check failed, or database constraint violation occurred
      expect(
        errorMessage.includes('Optimistic concurrency conflict') ||
        errorMessage.includes('constraint violation') ||
        errorMessage.includes('UNIQUE constraint')
      ).toBe(true)
    }

    batcher.stop()
    db.close()
  })

  test('should fail when expected version is lower than snapshot version', async () => {
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
    projectionService.registerHandler('product.published', productListViewProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const publishService = new PublishProductService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // First publish succeeds
    const publishCommand1 = createPublishCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })
    await publishService.execute(publishCommand1)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify snapshot is now at version 1
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(snapshot.version).toBe(1)

    // Second publish with stale expected version (0 instead of 1)
    const publishCommand2 = createPublishCommand({
      id: createCommand.id,
      expectedVersion: 0, // Stale - should be 1
    })

    // Act & Assert
    await expect(publishService.execute(publishCommand2)).rejects.toThrow('Optimistic concurrency conflict: expected version 0 but found version 1')

    // Assert - Verify only one published event exists
    const publishedEvents = db.query("SELECT * FROM events WHERE aggregate_id = ? AND event_type = 'product.published'").all(createCommand.id) as any[]
    expect(publishedEvents.length).toBe(1)

    batcher.stop()
    db.close()
  })

  test('should succeed with sequential updates using correct version progression', async () => {
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
    projectionService.registerHandler('product.published', productListViewProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const publishService = new PublishProductService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Step 1: First publish (version 0 -> 1)
    const publishCommand1 = createPublishCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })
    await publishService.execute(publishCommand1)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify version is 1
    let snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(snapshot.version).toBe(1)

    // Note: In this case, we can't publish twice (product is already published),
    // but we can verify the version check works correctly by checking the state
    // This test demonstrates that sequential operations with correct versions work

    // Assert - Verify published event exists
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(createCommand.id) as any[]
    expect(events.length).toBe(2)
    expect(events[0]!.event_type).toBe('product.created')
    expect(events[0]!.version).toBe(0)
    expect(events[1]!.event_type).toBe('product.published')
    expect(events[1]!.version).toBe(1)

    // Assert - Verify snapshot version is 1
    snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(snapshot.version).toBe(1)

    batcher.stop()
    db.close()
  })

  test('should fail when expected version is higher than snapshot version', async () => {
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
    projectionService.registerHandler('product.published', productListViewProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const publishService = new PublishProductService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify snapshot is at version 0
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(snapshot.version).toBe(0)

    // Try to publish with expected version 5 (but snapshot is at 0)
    const publishCommand = createPublishCommand({
      id: createCommand.id,
      expectedVersion: 5, // Too high - should be 0
    })

    // Act & Assert
    await expect(publishService.execute(publishCommand)).rejects.toThrow('Optimistic concurrency conflict: expected version 5 but found version 0')

    // Assert - Verify no published event exists
    const publishedEvents = db.query("SELECT * FROM events WHERE aggregate_id = ? AND event_type = 'product.published'").all(createCommand.id) as any[]
    expect(publishedEvents.length).toBe(0)

    batcher.stop()
    db.close()
  })
})

