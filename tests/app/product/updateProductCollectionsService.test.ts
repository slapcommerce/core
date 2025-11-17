import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { CreateProductService } from '../../../src/app/product/createProductService'
import { UpdateProductCollectionsService } from '../../../src/app/product/updateProductCollectionsService'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { schemas } from '../../../src/infrastructure/schemas'
import { ProjectionService } from '../../../src/infrastructure/projectionService'
import { productListViewProjection } from '../../../src/views/product/productListViewProjection'
import type { CreateProductCommand } from '../../../src/app/product/commands'
import type { UpdateProductCollectionsCommand } from '../../../src/app/product/commands'

function createValidCommand(overrides?: Partial<CreateProductCommand>): CreateProductCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    userId: overrides?.userId ?? randomUUIDv7(),
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

function createUpdateCollectionsCommand(overrides?: Partial<UpdateProductCollectionsCommand>): UpdateProductCollectionsCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    userId: overrides?.userId ?? randomUUIDv7(),
    collectionIds: overrides?.collectionIds ?? [randomUUIDv7(), randomUUIDv7()],
    expectedVersion: overrides?.expectedVersion ?? 0,
  }
}

describe('UpdateProductCollectionsService', () => {
  test('should successfully update product collections', async () => {
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
    projectionService.registerHandler('product.collections_updated', productListViewProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const updateService = new UpdateProductCollectionsService(unitOfWork, projectionService)

    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const newCollectionIds = [randomUUIDv7(), randomUUIDv7(), randomUUIDv7()]
    const updateCommand = createUpdateCollectionsCommand({
      id: createCommand.id,
      userId: createCommand.userId,
      collectionIds: newCollectionIds,
      expectedVersion: 0,
    })

    // Act
    await updateService.execute(updateCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - Verify collections updated event was saved
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(createCommand.id) as any[]
    expect(events.length).toBe(2)
    expect(events[0]!.event_type).toBe('product.created')
    expect(events[1]!.event_type).toBe('product.collections_updated')
    expect(events[1]!.version).toBe(1)

    // Assert - Verify event payload contains prior and new state
    const collectionsUpdatedEvent = JSON.parse(events[1]!.payload)
    expect(collectionsUpdatedEvent.priorState.collectionIds).toEqual(createCommand.collectionIds)
    expect(collectionsUpdatedEvent.newState.collectionIds).toEqual(newCollectionIds)

    // Assert - Verify snapshot was updated
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.collectionIds).toEqual(newCollectionIds)
    expect(snapshot.version).toBe(1)

    // Assert - Verify outbox event was saved
    const outboxEvents = db.query('SELECT * FROM outbox WHERE aggregate_id = ? ORDER BY event_type').all(createCommand.id) as any[]
    expect(outboxEvents.length).toBe(2)
    const collectionsUpdatedOutboxEvent = outboxEvents.find(e => e.event_type === 'product.collections_updated')
    expect(collectionsUpdatedOutboxEvent).toBeDefined()
    expect(collectionsUpdatedOutboxEvent!.status).toBe('pending')

    batcher.stop()
    db.close()
  })

  test('should allow empty collections array', async () => {
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
    projectionService.registerHandler('product.collections_updated', productListViewProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const updateService = new UpdateProductCollectionsService(unitOfWork, projectionService)

    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const updateCommand = createUpdateCollectionsCommand({
      id: createCommand.id,
      userId: createCommand.userId,
      collectionIds: [],
      expectedVersion: 0,
    })

    // Act
    await updateService.execute(updateCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - Verify snapshot was updated with empty collections
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.collectionIds).toEqual([])

    batcher.stop()
    db.close()
  })

  test('should allow single collection', async () => {
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
    projectionService.registerHandler('product.collections_updated', productListViewProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const updateService = new UpdateProductCollectionsService(unitOfWork, projectionService)

    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const singleCollectionId = randomUUIDv7()
    const updateCommand = createUpdateCollectionsCommand({
      id: createCommand.id,
      userId: createCommand.userId,
      collectionIds: [singleCollectionId],
      expectedVersion: 0,
    })

    // Act
    await updateService.execute(updateCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.collectionIds).toEqual([singleCollectionId])

    batcher.stop()
    db.close()
  })

  test('should allow many collections', async () => {
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
    projectionService.registerHandler('product.collections_updated', productListViewProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const updateService = new UpdateProductCollectionsService(unitOfWork, projectionService)

    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const manyCollectionIds = Array.from({ length: 50 }, () => randomUUIDv7())
    const updateCommand = createUpdateCollectionsCommand({
      id: createCommand.id,
      userId: createCommand.userId,
      collectionIds: manyCollectionIds,
      expectedVersion: 0,
    })

    // Act
    await updateService.execute(updateCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.collectionIds).toEqual(manyCollectionIds)
    expect(snapshotPayload.collectionIds).toHaveLength(50)

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
    const updateService = new UpdateProductCollectionsService(unitOfWork, projectionService)
    const updateCommand = createUpdateCollectionsCommand()

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
    const updateService = new UpdateProductCollectionsService(unitOfWork, projectionService)

    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const updateCommand = createUpdateCollectionsCommand({
      id: createCommand.id,
      userId: createCommand.userId,
      expectedVersion: 5, // Wrong version
    })

    // Act & Assert
    await expect(updateService.execute(updateCommand)).rejects.toThrow('Optimistic concurrency conflict')

    batcher.stop()
    db.close()
  })

  test('should update collections multiple times sequentially', async () => {
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
    projectionService.registerHandler('product.collections_updated', productListViewProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const updateService = new UpdateProductCollectionsService(unitOfWork, projectionService)

    const createCommand = createValidCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // First update
    const firstCollectionIds = [randomUUIDv7(), randomUUIDv7()]
    const firstUpdateCommand = createUpdateCollectionsCommand({
      id: createCommand.id,
      userId: createCommand.userId,
      collectionIds: firstCollectionIds,
      expectedVersion: 0,
    })
    await updateService.execute(firstUpdateCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Second update
    const secondCollectionIds = [randomUUIDv7()]
    const secondUpdateCommand = createUpdateCollectionsCommand({
      id: createCommand.id,
      userId: createCommand.userId,
      collectionIds: secondCollectionIds,
      expectedVersion: 1,
    })
    await updateService.execute(secondUpdateCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - Verify both update events were saved
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(createCommand.id) as any[]
    expect(events.length).toBe(3)
    expect(events[0]!.event_type).toBe('product.created')
    expect(events[1]!.event_type).toBe('product.collections_updated')
    expect(events[2]!.event_type).toBe('product.collections_updated')

    // Assert - Verify final state
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.collectionIds).toEqual(secondCollectionIds)
    expect(snapshot.version).toBe(2)

    batcher.stop()
    db.close()
  })

  test('should preserve other product fields when updating collections', async () => {
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
    projectionService.registerHandler('product.collections_updated', productListViewProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const updateService = new UpdateProductCollectionsService(unitOfWork, projectionService)

    const createCommand = createValidCommand({
      title: 'Original Title',
      tags: ['tag1', 'tag2'],
      vendor: 'Original Vendor',
    })
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const newCollectionIds = [randomUUIDv7()]
    const updateCommand = createUpdateCollectionsCommand({
      id: createCommand.id,
      userId: createCommand.userId,
      collectionIds: newCollectionIds,
      expectedVersion: 0,
    })

    // Act
    await updateService.execute(updateCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - Verify other fields remain unchanged
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.collectionIds).toEqual(newCollectionIds)
    expect(snapshotPayload.title).toBe('Original Title')
    expect(snapshotPayload.tags).toEqual(['tag1', 'tag2'])
    expect(snapshotPayload.vendor).toBe('Original Vendor')
    expect(snapshotPayload.variantIds).toEqual(createCommand.variantIds)

    batcher.stop()
    db.close()
  })
})
