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

    const archiveCommand = createArchiveCommand({
      id: createCommand.id,
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
    const projection = db.query('SELECT * FROM product_list_view WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(projection).toBeDefined()
    expect(projection.status).toBe('archived')
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

    const archiveCommand1 = createArchiveCommand({
      id: createCommand.id,
    })
    await archiveService.execute(archiveCommand1)

    const archiveCommand2 = createArchiveCommand({
      id: createCommand.id,
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
    const projection = db.query('SELECT * FROM product_list_view WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(projection).toBeDefined()
    expect(projection.status).toBe('archived')
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
})

