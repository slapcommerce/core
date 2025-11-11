import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { CreateProductService } from '../../../src/app/product/createProductService'
import { ArchiveProductService } from '../../../src/app/product/archiveProductService'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { schemas } from '../../../src/infrastructure/schemas'
import { ProjectionService } from '../../../src/infrastructure/projectionService'
import { productListViewProjection } from '../../../src/views/product/productListViewProjection'
import type { CreateProductCommand } from '../../../src/app/product/commands'
import type { ArchiveProductCommand } from '../../../src/app/product/commands'

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

function createArchiveCommand(overrides?: Partial<ArchiveProductCommand>): ArchiveProductCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    expectedVersion: overrides?.expectedVersion ?? 0,
  }
}

describe('ArchiveProductService', () => {
  test('should successfully archive a product', async () => {
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
    const archiveService = new ArchiveProductService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush to ensure snapshot is persisted
    await new Promise(resolve => setTimeout(resolve, 100))

    const archiveCommand = createArchiveCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })

    // Act
    await archiveService.execute(archiveCommand)

    // Assert - Verify archived event was saved
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(createCommand.id) as any[]
    expect(events.length).toBe(2)
    expect(events[0]!.event_type).toBe('product.created')
    expect(events[1]!.event_type).toBe('product.archived')
    expect(events[1]!.version).toBe(1)
    expect(events[1]!.correlation_id).toBe(createCommand.correlationId)

    // Assert - Verify snapshot was updated
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(snapshot).toBeDefined()
    expect(snapshot.version).toBe(1)
    
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.status).toBe('archived')

    // Assert - Verify outbox event was saved
    const outboxEvents = db.query('SELECT * FROM outbox WHERE aggregate_id = ? ORDER BY event_type').all(createCommand.id) as any[]
    expect(outboxEvents.length).toBe(2)
    const archivedOutboxEvent = outboxEvents.find(e => e.event_type === 'product.archived')
    expect(archivedOutboxEvent).toBeDefined()
    expect(archivedOutboxEvent!.status).toBe('pending')

    // Assert - Verify projection status was updated to archived
    await new Promise(resolve => setTimeout(resolve, 100))
    const projections = db.query('SELECT * FROM projections WHERE aggregate_id = ? AND projection_type = ? ORDER BY version DESC').all(createCommand.id, 'product_list_view') as any[]
    expect(projections.length).toBeGreaterThan(0)
    const projection = projections[0]
    expect(projection).toBeDefined()
    const payload = JSON.parse(projection.payload)
    expect(payload.status).toBe('archived')
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
    const archiveService = new ArchiveProductService(unitOfWork, projectionService)
    const archiveCommand = createArchiveCommand()

    // Act & Assert
    await expect(archiveService.execute(archiveCommand)).rejects.toThrow('not found')

    // Assert - Verify nothing was saved
    const eventCount = db.query('SELECT COUNT(*) as count FROM events').get() as { count: number }
    expect(eventCount.count).toBe(0)

    batcher.stop()
    db.close()
  })

  test('should throw error when product is already archived', async () => {
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
    const archiveService = new ArchiveProductService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const archiveCommand1 = createArchiveCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })
    await archiveService.execute(archiveCommand1)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const archiveCommand2 = createArchiveCommand({
      id: createCommand.id,
      expectedVersion: 1,
    })

    // Act & Assert
    await expect(archiveService.execute(archiveCommand2)).rejects.toThrow('already archived')

    // Assert - Verify only one archived event exists
    const archivedEvents = db.query("SELECT * FROM events WHERE aggregate_id = ? AND event_type = 'product.archived'").all(createCommand.id) as any[]
    expect(archivedEvents.length).toBe(1)

    batcher.stop()
    db.close()
  })

  test('should load product from snapshot and apply archive', async () => {
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
    const archiveService = new ArchiveProductService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const archiveCommand = createArchiveCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })

    // Act
    await archiveService.execute(archiveCommand)

    // Assert - Verify archived event was saved
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(createCommand.id) as any[]
    expect(events.length).toBe(2)
    expect(events[1]!.event_type).toBe('product.archived')

    // Assert - Verify snapshot was updated
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.status).toBe('archived')
    expect(snapshot.version).toBe(1)

    // Assert - Verify projection status was updated to archived
    await new Promise(resolve => setTimeout(resolve, 100))
    const projections = db.query('SELECT * FROM projections WHERE aggregate_id = ? AND projection_type = ? ORDER BY version DESC').all(createCommand.id, 'product_list_view') as any[]
    expect(projections.length).toBeGreaterThan(0)
    const projection = projections[0]
    expect(projection).toBeDefined()
    const payload = JSON.parse(projection.payload)
    expect(payload.status).toBe('archived')
    expect(projection.version).toBe(1)

    batcher.stop()
    db.close()
  })

  test('should update snapshot version after archiving', async () => {
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
    const archiveService = new ArchiveProductService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify initial snapshot version
    const initialSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(initialSnapshot.version).toBe(0)

    const archiveCommand = createArchiveCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })

    // Act
    await archiveService.execute(archiveCommand)

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
    const archiveService = new ArchiveProductService(unitOfWork, projectionService)
    const archiveCommand = createArchiveCommand()

    // Act & Assert - This should fail because product doesn't exist
    await expect(archiveService.execute(archiveCommand)).rejects.toThrow()

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
    projectionService.registerHandler('product.archived', productListViewProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const archiveService = new ArchiveProductService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify snapshot version is 0
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(snapshot.version).toBe(0)

    const archiveCommand = createArchiveCommand({
      id: createCommand.id,
      expectedVersion: 5, // Wrong version - should be 0
    })

    // Act & Assert
    await expect(archiveService.execute(archiveCommand)).rejects.toThrow('Optimistic concurrency conflict: expected version 5 but found version 0')

    // Assert - Verify nothing was persisted (no archived event)
    const archivedEvents = db.query("SELECT * FROM events WHERE aggregate_id = ? AND event_type = 'product.archived'").all(createCommand.id) as any[]
    expect(archivedEvents.length).toBe(0)

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
    projectionService.registerHandler('product.archived', productListViewProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const archiveService = new ArchiveProductService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Get the current snapshot version
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(snapshot.version).toBe(0)

    const archiveCommand = createArchiveCommand({
      id: createCommand.id,
      expectedVersion: 0, // Correct version
    })

    // Act
    await archiveService.execute(archiveCommand)

    // Assert - Verify archived event was saved
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(createCommand.id) as any[]
    expect(events.length).toBe(2)
    expect(events[1]!.event_type).toBe('product.archived')
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
    projectionService.registerHandler('product.archived', productListViewProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const archiveService = new ArchiveProductService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Both commands expect version 0
    const archiveCommand1 = createArchiveCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })
    const archiveCommand2 = createArchiveCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })

    // Act - Execute both commands concurrently
    const [result1, result2] = await Promise.allSettled([
      archiveService.execute(archiveCommand1),
      archiveService.execute(archiveCommand2),
    ])

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - One should succeed, one should fail
    const successCount = [result1, result2].filter(r => r.status === 'fulfilled').length
    const failureCount = [result1, result2].filter(r => r.status === 'rejected').length
    expect(successCount).toBe(1)
    expect(failureCount).toBe(1)

    // Assert - Verify only one archived event exists
    const archivedEvents = db.query("SELECT * FROM events WHERE aggregate_id = ? AND event_type = 'product.archived'").all(createCommand.id) as any[]
    expect(archivedEvents.length).toBe(1)

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
    projectionService.registerHandler('product.archived', productListViewProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const archiveService = new ArchiveProductService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // First archive succeeds
    const archiveCommand1 = createArchiveCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })
    await archiveService.execute(archiveCommand1)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify snapshot is now at version 1
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(snapshot.version).toBe(1)

    // Second archive with stale expected version (0 instead of 1)
    const archiveCommand2 = createArchiveCommand({
      id: createCommand.id,
      expectedVersion: 0, // Stale - should be 1
    })

    // Act & Assert
    await expect(archiveService.execute(archiveCommand2)).rejects.toThrow('Optimistic concurrency conflict: expected version 0 but found version 1')

    // Assert - Verify only one archived event exists
    const archivedEvents = db.query("SELECT * FROM events WHERE aggregate_id = ? AND event_type = 'product.archived'").all(createCommand.id) as any[]
    expect(archivedEvents.length).toBe(1)

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
    projectionService.registerHandler('product.archived', productListViewProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const { PublishProductService } = await import('../../../src/app/product/publishProductService')
    const publishService = new PublishProductService(unitOfWork, projectionService)
    const archiveService = new ArchiveProductService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Step 1: Publish (version 0 -> 1)
    const publishCommand = { id: createCommand.id, expectedVersion: 0 }
    await publishService.execute(publishCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify version is 1
    let snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(snapshot.version).toBe(1)

    // Step 2: Archive (version 1 -> 2)
    const archiveCommand = createArchiveCommand({
      id: createCommand.id,
      expectedVersion: 1, // Correct version after publish
    })

    // Act
    await archiveService.execute(archiveCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - Verify both events exist
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(createCommand.id) as any[]
    expect(events.length).toBe(3)
    expect(events[0]!.event_type).toBe('product.created')
    expect(events[0]!.version).toBe(0)
    expect(events[1]!.event_type).toBe('product.published')
    expect(events[1]!.version).toBe(1)
    expect(events[2]!.event_type).toBe('product.archived')
    expect(events[2]!.version).toBe(2)

    // Assert - Verify snapshot version is 2
    snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(snapshot.version).toBe(2)

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
    projectionService.registerHandler('product.archived', productListViewProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const archiveService = new ArchiveProductService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify snapshot is at version 0
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(snapshot.version).toBe(0)

    // Try to archive with expected version 2 (but snapshot is at 0)
    const archiveCommand = createArchiveCommand({
      id: createCommand.id,
      expectedVersion: 2, // Too high - should be 0
    })

    // Act & Assert
    await expect(archiveService.execute(archiveCommand)).rejects.toThrow('Optimistic concurrency conflict: expected version 2 but found version 0')

    // Assert - Verify no archived event exists
    const archivedEvents = db.query("SELECT * FROM events WHERE aggregate_id = ? AND event_type = 'product.archived'").all(createCommand.id) as any[]
    expect(archivedEvents.length).toBe(0)

    batcher.stop()
    db.close()
  })
})

