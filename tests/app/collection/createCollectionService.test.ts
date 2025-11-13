import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { CreateCollectionService } from '../../../src/app/collection/createCollectionService'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { schemas } from '../../../src/infrastructure/schemas'
import { ProjectionService } from '../../../src/infrastructure/projectionService'
import type { CreateCollectionCommand } from '../../../src/app/collection/commands'

function createValidCommand(overrides?: Partial<CreateCollectionCommand>): CreateCollectionCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    correlationId: overrides?.correlationId ?? randomUUIDv7(),
    name: overrides?.name ?? 'Test Collection',
    description: overrides?.description ?? null,
    slug: overrides?.slug ?? 'test-collection',
  }
}

describe('CreateCollectionService', () => {
  test('should successfully create a collection with all required data', async () => {
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
    const service = new CreateCollectionService(unitOfWork, projectionService)
    const command = createValidCommand()

    // Act
    await service.execute(command)

    // Assert - Verify event was saved
    const event = db.query('SELECT * FROM events WHERE aggregate_id = ?').get(command.id) as any
    expect(event).toBeDefined()
    expect(event.event_type).toBe('collection.created')
    expect(event.aggregate_id).toBe(command.id)
    expect(event.correlation_id).toBe(command.correlationId)
    expect(event.version).toBe(0)

    const eventPayload = JSON.parse(event.payload)
    expect(eventPayload.newState.name).toBe(command.name)
    expect(eventPayload.newState.slug).toBe(command.slug)
    expect(eventPayload.newState.status).toBe('draft')

    // Assert - Verify snapshot was saved
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(command.id) as any
    expect(snapshot).toBeDefined()
    expect(snapshot.aggregate_id).toBe(command.id)
    expect(snapshot.correlation_id).toBe(command.correlationId)
    expect(snapshot.version).toBe(0)

    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.name).toBe(command.name)
    expect(snapshotPayload.slug).toBe(command.slug)
    expect(snapshotPayload.status).toBe('draft')

    // Assert - Verify outbox event was saved
    const outboxEvent = db.query('SELECT * FROM outbox WHERE aggregate_id = ?').get(command.id) as any
    expect(outboxEvent).toBeDefined()
    expect(outboxEvent.aggregate_id).toBe(command.id)
    expect(outboxEvent.event_type).toBe('collection.created')
    expect(outboxEvent.status).toBe('pending')

    batcher.stop()
    db.close()
  })

  test('should create collection with null description', async () => {
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
    const service = new CreateCollectionService(unitOfWork, projectionService)
    const command = createValidCommand({ description: null })

    // Act
    await service.execute(command)

    // Assert - Verify null description is handled correctly
    const event = db.query('SELECT * FROM events WHERE aggregate_id = ?').get(command.id) as any
    const eventPayload = JSON.parse(event.payload)
    expect(eventPayload.newState.description).toBeNull()

    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(command.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.description).toBeNull()

    batcher.stop()
    db.close()
  })

  test('should create collection with description', async () => {
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
    const service = new CreateCollectionService(unitOfWork, projectionService)
    const command = createValidCommand({ description: 'A test collection description' })

    // Act
    await service.execute(command)

    // Assert - Verify description is saved correctly
    const event = db.query('SELECT * FROM events WHERE aggregate_id = ?').get(command.id) as any
    const eventPayload = JSON.parse(event.payload)
    expect(eventPayload.newState.description).toBe('A test collection description')

    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(command.id) as any
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.description).toBe('A test collection description')

    batcher.stop()
    db.close()
  })

  test('should reserve slug in SlugRegistry when collection is created', async () => {
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
    const service = new CreateCollectionService(unitOfWork, projectionService)
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

  test('should create collection with existing slug aggregate', async () => {
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
    
    // Create an existing slug aggregate snapshot (unused)
    const existingSlugSnapshot = {
      aggregate_id: 'existing-slug',
      correlation_id: randomUUIDv7(),
      version: 0,
      payload: JSON.stringify({
        slug: 'existing-slug',
        productId: null,
        status: 'active'
      })
    }
    db.run(
      'INSERT INTO snapshots (aggregate_id, correlation_id, version, payload) VALUES (?, ?, ?, ?)',
      [existingSlugSnapshot.aggregate_id, existingSlugSnapshot.correlation_id, existingSlugSnapshot.version, existingSlugSnapshot.payload]
    )

    const service = new CreateCollectionService(unitOfWork, projectionService)
    const command = createValidCommand({ slug: 'existing-slug' })

    // Act
    await service.execute(command)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - Verify collection was created and slug was reserved
    const collectionSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(command.id) as any
    expect(collectionSnapshot).toBeDefined()

    const slugSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get('existing-slug') as any
    expect(slugSnapshot).toBeDefined()
    const slugPayload = JSON.parse(slugSnapshot.payload)
    expect(slugPayload.productId).toBe(command.id)

    batcher.stop()
    db.close()
  })

  test('should create collection with new slug aggregate', async () => {
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
    const service = new CreateCollectionService(unitOfWork, projectionService)
    const command = createValidCommand({ slug: 'new-slug' })

    // Act
    await service.execute(command)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - Verify slug aggregate was created
    const slugSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get('new-slug') as any
    expect(slugSnapshot).toBeDefined()
    const slugPayload = JSON.parse(slugSnapshot.payload)
    expect(slugPayload.slug).toBe('new-slug')
    expect(slugPayload.productId).toBe(command.id)

    batcher.stop()
    db.close()
  })

  test('should throw error when creating collection with duplicate slug', async () => {
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
    const service = new CreateCollectionService(unitOfWork, projectionService)
    
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
    const service = new CreateCollectionService(unitOfWork, projectionService)
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
    const service = new CreateCollectionService(unitOfWork, projectionService)
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
    const service = new CreateCollectionService(unitOfWork, projectionService)
    
    const command1 = createValidCommand({ slug: 'test-slug' })
    await service.execute(command1)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const command2 = createValidCommand({ slug: 'test-slug' }) // Duplicate slug

    // Act & Assert - This should fail validation
    await expect(service.execute(command2)).rejects.toThrow()

    // Assert - Verify nothing was persisted for the second command
    const eventCount = db.query('SELECT COUNT(*) as count FROM events WHERE aggregate_id = ?').get(command2.id) as { count: number }
    expect(eventCount.count).toBe(0)

    const snapshotCount = db.query('SELECT COUNT(*) as count FROM snapshots WHERE aggregate_id = ?').get(command2.id) as { count: number }
    expect(snapshotCount.count).toBe(0)

    const outboxCount = db.query('SELECT COUNT(*) as count FROM outbox WHERE aggregate_id = ?').get(command2.id) as { count: number }
    expect(outboxCount.count).toBe(0)

    batcher.stop()
    db.close()
  })
})

