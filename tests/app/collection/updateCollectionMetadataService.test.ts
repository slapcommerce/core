import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { CreateCollectionService } from '../../../src/app/collection/createCollectionService'
import { UpdateCollectionMetadataService } from '../../../src/app/collection/updateCollectionMetadataService'
import { PublishCollectionService } from '../../../src/app/collection/publishCollectionService'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { schemas } from '../../../src/infrastructure/schemas'
import { ProjectionService } from '../../../src/infrastructure/projectionService'
import { collectionSlugRedirectProjection } from '../../../src/views/collection/collectionSlugRedirectProjection'
import type { CreateCollectionCommand } from '../../../src/app/collection/commands'
import type { UpdateCollectionMetadataCommand } from '../../../src/app/collection/commands'

function createValidCreateCommand(overrides?: Partial<CreateCollectionCommand>): CreateCollectionCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    correlationId: overrides?.correlationId ?? randomUUIDv7(),
    userId: overrides?.userId ?? randomUUIDv7(),
    name: overrides?.name ?? 'Test Collection',
    description: overrides?.description ?? null,
    slug: overrides?.slug ?? 'test-collection',
  }
}

function createUpdateCommand(overrides?: Partial<UpdateCollectionMetadataCommand>): UpdateCollectionMetadataCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    userId: overrides?.userId ?? randomUUIDv7(),
    name: overrides?.name ?? 'Updated Collection',
    description: overrides?.description ?? null,
    newSlug: overrides?.newSlug ?? 'updated-collection',
    expectedVersion: overrides?.expectedVersion ?? 0,
  }
}

describe('UpdateCollectionMetadataService', () => {
  test('should successfully update metadata without slug change', async () => {
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
    const createService = new CreateCollectionService(unitOfWork, projectionService)
    const updateService = new UpdateCollectionMetadataService(unitOfWork, projectionService)
    
    const createCommand = createValidCreateCommand({ slug: 'test-slug' })
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const updateCommand = createUpdateCommand({
      id: createCommand.id,
      name: 'Updated Name',
      description: 'Updated Description',
      newSlug: 'test-slug', // Same slug
      expectedVersion: 0,
    })

    // Act
    await updateService.execute(updateCommand)

    // Assert - Verify metadata_updated event was saved
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(createCommand.id) as any[]
    expect(events.length).toBe(2)
    expect(events[1]!.event_type).toBe('collection.metadata_updated')
    expect(events[1]!.version).toBe(1)

    const eventPayload = JSON.parse(events[1]!.payload)
    expect(eventPayload.newState.name).toBe('Updated Name')
    expect(eventPayload.newState.description).toBe('Updated Description')
    expect(eventPayload.newState.slug).toBe('test-slug')

    // Assert - Verify snapshot was updated
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(snapshot.version).toBe(1)
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.name).toBe('Updated Name')
    expect(snapshotPayload.description).toBe('Updated Description')
    expect(snapshotPayload.slug).toBe('test-slug')

    batcher.stop()
    db.close()
  })

  test('should successfully update metadata with slug change for draft collection - releases old slug', async () => {
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
    const createService = new CreateCollectionService(unitOfWork, projectionService)
    const updateService = new UpdateCollectionMetadataService(unitOfWork, projectionService)
    
    const createCommand = createValidCreateCommand({ slug: 'old-slug' })
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const updateCommand = createUpdateCommand({
      id: createCommand.id,
      name: 'Updated Name',
      description: 'Updated Description',
      newSlug: 'new-slug',
      expectedVersion: 0,
    })

    // Act
    await updateService.execute(updateCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - Verify collection metadata_updated event was saved
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(createCommand.id) as any[]
    expect(events.length).toBe(2)
    expect(events[1]!.event_type).toBe('collection.metadata_updated')
    expect(events[1]!.version).toBe(1)

    const eventPayload = JSON.parse(events[1]!.payload)
    expect(eventPayload.newState.slug).toBe('new-slug')
    expect(eventPayload.newState.status).toBe('draft') // Still draft

    // Assert - Verify new slug was reserved
    const newSlugSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get('new-slug') as any
    expect(newSlugSnapshot).toBeDefined()
    const newSlugPayload = JSON.parse(newSlugSnapshot.payload)
    expect(newSlugPayload.productId).toBe(createCommand.id)
    expect(newSlugPayload.status).toBe('active')

    // Assert - Verify old slug was released (not redirected) for draft collection
    const oldSlugSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get('old-slug') as any
    expect(oldSlugSnapshot).toBeDefined()
    const oldSlugPayload = JSON.parse(oldSlugSnapshot.payload)
    expect(oldSlugPayload.status).toBe('active') // Released, not redirected
    expect(oldSlugPayload.productId).toBeNull() // Released

    // Assert - Verify slug events were saved
    const slugReservedEvents = db.query('SELECT * FROM events WHERE aggregate_id = ? AND event_type = ?').all('new-slug', 'slug.reserved') as any[]
    expect(slugReservedEvents.length).toBeGreaterThanOrEqual(1)

    const slugReleasedEvents = db.query('SELECT * FROM events WHERE aggregate_id = ? AND event_type = ?').all('old-slug', 'slug.released') as any[]
    expect(slugReleasedEvents.length).toBeGreaterThanOrEqual(1)

    // Assert - Verify NO redirect was created for draft collection
    const redirects = db.query('SELECT * FROM slug_redirects WHERE entity_id = ? AND entity_type = ?').all(createCommand.id, 'collection') as any[]
    expect(redirects.length).toBe(0)

    batcher.stop()
    db.close()
  })

  test('should successfully update metadata with slug change for active collection - redirects old slug', async () => {
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
    projectionService.registerHandler('collection.metadata_updated', collectionSlugRedirectProjection)
    const createService = new CreateCollectionService(unitOfWork, projectionService)
    const publishService = new PublishCollectionService(unitOfWork, projectionService)
    const updateService = new UpdateCollectionMetadataService(unitOfWork, projectionService)
    
    const createCommand = createValidCreateCommand({ slug: 'old-slug' })
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Publish collection to make it active
    await publishService.execute({
      id: createCommand.id,
      userId: randomUUIDv7(),
      expectedVersion: 0,
    })

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const updateCommand = createUpdateCommand({
      id: createCommand.id,
      name: 'Updated Name',
      description: 'Updated Description',
      newSlug: 'new-slug',
      expectedVersion: 1,
    })

    // Act
    await updateService.execute(updateCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - Verify collection metadata_updated event was saved
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(createCommand.id) as any[]
    expect(events.length).toBe(3) // created, published, metadata_updated
    expect(events[2]!.event_type).toBe('collection.metadata_updated')
    expect(events[2]!.version).toBe(2)

    const eventPayload = JSON.parse(events[2]!.payload)
    expect(eventPayload.newState.slug).toBe('new-slug')
    expect(eventPayload.newState.status).toBe('active') // Still active

    // Assert - Verify new slug was reserved
    const newSlugSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get('new-slug') as any
    expect(newSlugSnapshot).toBeDefined()
    const newSlugPayload = JSON.parse(newSlugSnapshot.payload)
    expect(newSlugPayload.productId).toBe(createCommand.id)
    expect(newSlugPayload.status).toBe('active')

    // Assert - Verify old slug was marked as redirected for active collection
    const oldSlugSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get('old-slug') as any
    expect(oldSlugSnapshot).toBeDefined()
    const oldSlugPayload = JSON.parse(oldSlugSnapshot.payload)
    expect(oldSlugPayload.status).toBe('redirect') // Redirected, not released

    // Assert - Verify slug events were saved
    const slugReservedEvents = db.query('SELECT * FROM events WHERE aggregate_id = ? AND event_type = ?').all('new-slug', 'slug.reserved') as any[]
    expect(slugReservedEvents.length).toBeGreaterThanOrEqual(1)

    const slugRedirectedEvents = db.query('SELECT * FROM events WHERE aggregate_id = ? AND event_type = ?').all('old-slug', 'slug.redirected') as any[]
    expect(slugRedirectedEvents.length).toBeGreaterThanOrEqual(1)

    // Assert - Verify redirect WAS created for active collection
    const redirects = db.query('SELECT * FROM slug_redirects WHERE entity_id = ? AND entity_type = ?').all(createCommand.id, 'collection') as any[]
    expect(redirects.length).toBe(1)
    expect(redirects[0]!.old_slug).toBe('old-slug')
    expect(redirects[0]!.new_slug).toBe('new-slug')

    batcher.stop()
    db.close()
  })

  test('should update name only', async () => {
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
    const createService = new CreateCollectionService(unitOfWork, projectionService)
    const updateService = new UpdateCollectionMetadataService(unitOfWork, projectionService)
    
    const createCommand = createValidCreateCommand({ name: 'Original Name', description: 'Original Description', slug: 'test-slug' })
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const updateCommand = createUpdateCommand({
      id: createCommand.id,
      name: 'Updated Name Only',
      description: 'Original Description', // Same
      newSlug: 'test-slug', // Same
      expectedVersion: 0,
    })

    // Act
    await updateService.execute(updateCommand)

    // Assert - Verify only name was updated
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.name).toBe('Updated Name Only')
    expect(snapshotPayload.description).toBe('Original Description')
    expect(snapshotPayload.slug).toBe('test-slug')

    batcher.stop()
    db.close()
  })

  test('should update description only', async () => {
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
    const createService = new CreateCollectionService(unitOfWork, projectionService)
    const updateService = new UpdateCollectionMetadataService(unitOfWork, projectionService)
    
    const createCommand = createValidCreateCommand({ name: 'Test Name', description: 'Original Description', slug: 'test-slug' })
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const updateCommand = createUpdateCommand({
      id: createCommand.id,
      name: 'Test Name', // Same
      description: 'Updated Description Only',
      newSlug: 'test-slug', // Same
      expectedVersion: 0,
    })

    // Act
    await updateService.execute(updateCommand)

    // Assert - Verify only description was updated
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.name).toBe('Test Name')
    expect(snapshotPayload.description).toBe('Updated Description Only')
    expect(snapshotPayload.slug).toBe('test-slug')

    batcher.stop()
    db.close()
  })

  test('should update slug only', async () => {
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
    const createService = new CreateCollectionService(unitOfWork, projectionService)
    const updateService = new UpdateCollectionMetadataService(unitOfWork, projectionService)
    
    const createCommand = createValidCreateCommand({ name: 'Test Name', description: 'Test Description', slug: 'old-slug' })
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const updateCommand = createUpdateCommand({
      id: createCommand.id,
      name: 'Test Name', // Same
      description: 'Test Description', // Same
      newSlug: 'new-slug-only',
      expectedVersion: 0,
    })

    // Act
    await updateService.execute(updateCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - Verify only slug was updated
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.name).toBe('Test Name')
    expect(snapshotPayload.description).toBe('Test Description')
    expect(snapshotPayload.slug).toBe('new-slug-only')

    // Assert - Verify slug aggregates were updated
    const newSlugSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get('new-slug-only') as any
    expect(newSlugSnapshot).toBeDefined()

    const oldSlugSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get('old-slug') as any
    expect(oldSlugSnapshot).toBeDefined()
    const oldSlugPayload = JSON.parse(oldSlugSnapshot.payload)
    // Draft collections release slugs instead of redirecting them
    expect(oldSlugPayload.status).toBe('active')
    expect(oldSlugPayload.productId).toBeNull()

    batcher.stop()
    db.close()
  })

  test('should update all fields', async () => {
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
    const createService = new CreateCollectionService(unitOfWork, projectionService)
    const updateService = new UpdateCollectionMetadataService(unitOfWork, projectionService)
    
    const createCommand = createValidCreateCommand({ name: 'Original Name', description: 'Original Description', slug: 'old-slug' })
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const updateCommand = createUpdateCommand({
      id: createCommand.id,
      name: 'All Updated Name',
      description: 'All Updated Description',
      newSlug: 'all-new-slug',
      expectedVersion: 0,
    })

    // Act
    await updateService.execute(updateCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - Verify all fields were updated
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.name).toBe('All Updated Name')
    expect(snapshotPayload.description).toBe('All Updated Description')
    expect(snapshotPayload.slug).toBe('all-new-slug')

    batcher.stop()
    db.close()
  })

  test('should throw error when collection not found', async () => {
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
    const updateService = new UpdateCollectionMetadataService(unitOfWork, projectionService)
    const updateCommand = createUpdateCommand()

    // Act & Assert
    await expect(updateService.execute(updateCommand)).rejects.toThrow('Collection with id')

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
    const createService = new CreateCollectionService(unitOfWork, projectionService)
    const updateService = new UpdateCollectionMetadataService(unitOfWork, projectionService)
    
    const createCommand = createValidCreateCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const updateCommand = createUpdateCommand({
      id: createCommand.id,
      expectedVersion: 5, // Wrong version - should be 0
    })

    // Act & Assert
    await expect(updateService.execute(updateCommand)).rejects.toThrow('Optimistic concurrency conflict: expected version 5 but found version 0')

    batcher.stop()
    db.close()
  })

  test('should throw error when new slug is already in use', async () => {
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
    const createService = new CreateCollectionService(unitOfWork, projectionService)
    const updateService = new UpdateCollectionMetadataService(unitOfWork, projectionService)
    
    // Create first collection
    const createCommand1 = createValidCreateCommand({ slug: 'first-slug' })
    await createService.execute(createCommand1)

    // Create second collection with different slug
    const createCommand2 = createValidCreateCommand({ slug: 'second-slug' })
    await createService.execute(createCommand2)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Try to update second collection to use first collection's slug
    const updateCommand = createUpdateCommand({
      id: createCommand2.id,
      newSlug: 'first-slug', // Already in use
      expectedVersion: 0,
    })

    // Act & Assert
    await expect(updateService.execute(updateCommand)).rejects.toThrow('Slug "first-slug" is already in use')

    batcher.stop()
    db.close()
  })

  test('should throw error when old slug not found during slug change', async () => {
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
    
    // Create collection snapshot manually without slug aggregate
    const collectionId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const collectionSnapshot = {
      aggregate_id: collectionId,
      correlation_id: correlationId,
      version: 0,
      payload: JSON.stringify({
        id: collectionId,
        name: 'Test Collection',
        description: 'Test Description',
        slug: 'missing-slug',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 0
      })
    }
    db.run(
      'INSERT INTO snapshots (aggregate_id, correlation_id, version, payload) VALUES (?, ?, ?, ?)',
      [collectionSnapshot.aggregate_id, collectionSnapshot.correlation_id, collectionSnapshot.version, collectionSnapshot.payload]
    )

    const updateService = new UpdateCollectionMetadataService(unitOfWork, projectionService)
    const updateCommand = createUpdateCommand({
      id: collectionId,
      newSlug: 'new-slug',
      expectedVersion: 0,
    })

    // Act & Assert
    await expect(updateService.execute(updateCommand)).rejects.toThrow('Old slug "missing-slug" not found')

    batcher.stop()
    db.close()
  })

  test('should update metadata without changing slug - no slug aggregate changes', async () => {
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
    const createService = new CreateCollectionService(unitOfWork, projectionService)
    const updateService = new UpdateCollectionMetadataService(unitOfWork, projectionService)
    
    const createCommand = createValidCreateCommand({ slug: 'same-slug' })
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Count slug events before update
    const slugEventsBefore = db.query('SELECT COUNT(*) as count FROM events WHERE aggregate_id = ?').get('same-slug') as { count: number }
    const initialCount = slugEventsBefore.count

    const updateCommand = createUpdateCommand({
      id: createCommand.id,
      name: 'Updated Name',
      newSlug: 'same-slug', // Same slug
      expectedVersion: 0,
    })

    // Act
    await updateService.execute(updateCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - Verify no new slug events were created
    const slugEventsAfter = db.query('SELECT COUNT(*) as count FROM events WHERE aggregate_id = ?').get('same-slug') as { count: number }
    expect(slugEventsAfter.count).toBe(initialCount) // No new slug events

    batcher.stop()
    db.close()
  })

  test('should verify old slug marked as redirected when slug changes', async () => {
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
    const createService = new CreateCollectionService(unitOfWork, projectionService)
    const updateService = new UpdateCollectionMetadataService(unitOfWork, projectionService)
    
    const createCommand = createValidCreateCommand({ slug: 'old-redirect-slug' })
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const updateCommand = createUpdateCommand({
      id: createCommand.id,
      newSlug: 'new-redirect-slug',
      expectedVersion: 0,
    })

    // Act
    await updateService.execute(updateCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - Verify old slug status is released (draft collections release slugs, not redirect)
    const oldSlugSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get('old-redirect-slug') as any
    expect(oldSlugSnapshot).toBeDefined()
    const oldSlugPayload = JSON.parse(oldSlugSnapshot.payload)
    expect(oldSlugPayload.status).toBe('active')
    expect(oldSlugPayload.productId).toBeNull()

    // Assert - Verify slug.released event exists (not slug.redirected)
    const releasedEvents = db.query('SELECT * FROM events WHERE aggregate_id = ? AND event_type = ?').all('old-redirect-slug', 'slug.released') as any[]
    expect(releasedEvents.length).toBeGreaterThanOrEqual(1)

    batcher.stop()
    db.close()
  })

  test('should verify new slug reserved when slug changes', async () => {
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
    const createService = new CreateCollectionService(unitOfWork, projectionService)
    const updateService = new UpdateCollectionMetadataService(unitOfWork, projectionService)
    
    const createCommand = createValidCreateCommand({ slug: 'old-reserve-slug' })
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const updateCommand = createUpdateCommand({
      id: createCommand.id,
      newSlug: 'new-reserve-slug',
      expectedVersion: 0,
    })

    // Act
    await updateService.execute(updateCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - Verify new slug was reserved
    const newSlugSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get('new-reserve-slug') as any
    expect(newSlugSnapshot).toBeDefined()
    const newSlugPayload = JSON.parse(newSlugSnapshot.payload)
    expect(newSlugPayload.productId).toBe(createCommand.id)
    expect(newSlugPayload.status).toBe('active')

    // Assert - Verify slug.reserved event exists
    const reservedEvents = db.query('SELECT * FROM events WHERE aggregate_id = ? AND event_type = ?').all('new-reserve-slug', 'slug.reserved') as any[]
    expect(reservedEvents.length).toBeGreaterThanOrEqual(1)

    batcher.stop()
    db.close()
  })

  test('should verify both slug snapshots saved when slug changes', async () => {
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
    const createService = new CreateCollectionService(unitOfWork, projectionService)
    const updateService = new UpdateCollectionMetadataService(unitOfWork, projectionService)
    
    const createCommand = createValidCreateCommand({ slug: 'both-old-slug' })
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const updateCommand = createUpdateCommand({
      id: createCommand.id,
      newSlug: 'both-new-slug',
      expectedVersion: 0,
    })

    // Act
    await updateService.execute(updateCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - Verify both slug snapshots exist
    const oldSlugSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get('both-old-slug') as any
    expect(oldSlugSnapshot).toBeDefined()

    const newSlugSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get('both-new-slug') as any
    expect(newSlugSnapshot).toBeDefined()

    batcher.stop()
    db.close()
  })

  test('should verify version incremented correctly', async () => {
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
    const createService = new CreateCollectionService(unitOfWork, projectionService)
    const updateService = new UpdateCollectionMetadataService(unitOfWork, projectionService)
    
    const createCommand = createValidCreateCommand()
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify initial version
    const initialSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(initialSnapshot.version).toBe(0)

    const updateCommand = createUpdateCommand({
      id: createCommand.id,
      expectedVersion: 0,
    })

    // Act
    await updateService.execute(updateCommand)

    // Assert - Verify version was incremented
    const updatedSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(updatedSnapshot.version).toBe(1)

    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(createCommand.id) as any[]
    expect(events[1]!.version).toBe(1)

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
    const updateService = new UpdateCollectionMetadataService(unitOfWork, projectionService)
    const updateCommand = createUpdateCommand()

    // Act & Assert - This should fail because collection doesn't exist
    await expect(updateService.execute(updateCommand)).rejects.toThrow()

    // Assert - Verify nothing was persisted
    const eventCount = db.query('SELECT COUNT(*) as count FROM events').get() as { count: number }
    expect(eventCount.count).toBe(0)

    batcher.stop()
    db.close()
  })

  test('should update with null description', async () => {
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
    const createService = new CreateCollectionService(unitOfWork, projectionService)
    const updateService = new UpdateCollectionMetadataService(unitOfWork, projectionService)
    
    const createCommand = createValidCreateCommand({ description: 'Original Description' })
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const updateCommand = createUpdateCommand({
      id: createCommand.id,
      description: null,
      expectedVersion: 0,
    })

    // Act
    await updateService.execute(updateCommand)

    // Assert - Verify null description is handled correctly
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.description).toBeNull()

    batcher.stop()
    db.close()
  })
})

