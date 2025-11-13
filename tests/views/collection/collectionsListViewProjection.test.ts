import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { TransactionBatch } from '../../../src/infrastructure/transactionBatch'
import { collectionsListViewProjection } from '../../../src/views/collection/collectionsListViewProjection'
import { CollectionCreatedEvent, CollectionArchivedEvent, CollectionMetadataUpdatedEvent } from '../../../src/domain/collection/events'
import { EventRepository } from '../../../src/infrastructure/repositories/eventRepository'
import { SnapshotRepository } from '../../../src/infrastructure/repositories/snapshotRepository'
import { OutboxRepository } from '../../../src/infrastructure/repositories/outboxRepository'
import { SlugRedirectRepository } from '../../../src/infrastructure/repositories/slugRedirectRepository'
import { ProductListViewRepository } from '../../../src/infrastructure/repositories/productListViewRepository'
import { ProductCollectionRepository } from '../../../src/infrastructure/repositories/productCollectionRepository'
import { ProductVariantRepository } from '../../../src/infrastructure/repositories/productVariantRepository'
import { CollectionsListViewRepository } from '../../../src/infrastructure/repositories/collectionsListViewRepository'
import { schemas } from '../../../src/infrastructure/schemas'
import { randomUUIDv7 } from 'bun'
import type { UnitOfWorkRepositories } from '../../../src/infrastructure/projectionService'

function createCollectionState(overrides?: Partial<any>): any {
  return {
    name: 'Test Collection',
    description: 'A test collection',
    slug: 'test-collection',
    status: 'active' as const,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

function createRepositories(db: Database, batch: TransactionBatch): UnitOfWorkRepositories {
  return {
    eventRepository: new EventRepository(db, batch),
    snapshotRepository: new SnapshotRepository(db, batch),
    outboxRepository: new OutboxRepository(db, batch),
    productListViewRepository: new ProductListViewRepository(db, batch),
    productCollectionRepository: new ProductCollectionRepository(db, batch),
    productVariantRepository: new ProductVariantRepository(db, batch),
    slugRedirectRepository: new SlugRedirectRepository(db, batch),
    collectionsListViewRepository: new CollectionsListViewRepository(db, batch),
  }
}

async function flushBatch(db: Database, batch: TransactionBatch): Promise<void> {
  try {
    db.run('BEGIN TRANSACTION')
    for (const command of batch.commands) {
      command.statement.run(...command.params)
    }
    db.run('COMMIT')
    batch.resolve()
  } catch (error) {
    try {
      db.run('ROLLBACK')
    } catch {
      // Ignore rollback errors
    }
    batch.reject(error instanceof Error ? error : new Error(String(error)))
    throw error
  }
}

describe('collectionsListViewProjection', () => {
  test('should create projection when collection.created event is handled', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const collectionId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    
    const priorState = {} as any
    const newState = createCollectionState()
    const event = new CollectionCreatedEvent({
      occurredAt: new Date('2024-01-01'),
      aggregateId: collectionId,
      correlationId,
      version: 0,
      priorState,
      newState,
    })

    // Act
    await collectionsListViewProjection(event, repositories)
    await flushBatch(db, batch)

    // Assert - Verify collection was saved to collections_list_view table
    const collection = db.query(
      'SELECT * FROM collections_list_view WHERE aggregate_id = ?'
    ).get(collectionId) as any
    expect(collection).toBeDefined()
    expect(collection.aggregate_id).toBe(collectionId)
    expect(collection.name).toBe('Test Collection')
    expect(collection.slug).toBe('test-collection')
    expect(collection.description).toBe('A test collection')
    expect(collection.status).toBe('active')
    expect(collection.correlation_id).toBe(correlationId)
    expect(collection.version).toBe(0)
    
    db.close()
  })

  test('should handle collection with null description', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const collectionId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    
    const priorState = {} as any
    const newState = createCollectionState({ description: null })
    const event = new CollectionCreatedEvent({
      occurredAt: new Date('2024-01-01'),
      aggregateId: collectionId,
      correlationId,
      version: 0,
      priorState,
      newState,
    })

    // Act
    await collectionsListViewProjection(event, repositories)
    await flushBatch(db, batch)

    // Assert
    const collection = db.query(
      'SELECT * FROM collections_list_view WHERE aggregate_id = ?'
    ).get(collectionId) as any
    expect(collection).toBeDefined()
    expect(collection.description).toBeNull()
    
    db.close()
  })

  test('should update status to archived when collection.archived event is handled', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const collectionId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    
    // First create the collection
    const createPriorState = {} as any
    const createNewState = createCollectionState()
    const createEvent = new CollectionCreatedEvent({
      occurredAt: new Date('2024-01-01'),
      aggregateId: collectionId,
      correlationId,
      version: 0,
      priorState: createPriorState,
      newState: createNewState,
    })
    await collectionsListViewProjection(createEvent, repositories)
    await flushBatch(db, batch)

    // Now archive it
    const batch2 = new TransactionBatch()
    const repositories2 = createRepositories(db, batch2)
    const archivePriorState = createCollectionState()
    const archiveNewState = createCollectionState({ status: 'archived' })
    const archiveEvent = new CollectionArchivedEvent({
      occurredAt: new Date('2024-01-02'),
      aggregateId: collectionId,
      correlationId,
      version: 1,
      priorState: archivePriorState,
      newState: archiveNewState,
    })

    // Act
    await collectionsListViewProjection(archiveEvent, repositories2)
    await flushBatch(db, batch2)

    // Assert
    const collection = db.query(
      'SELECT * FROM collections_list_view WHERE aggregate_id = ?'
    ).get(collectionId) as any
    expect(collection).toBeDefined()
    expect(collection.status).toBe('archived')
    expect(collection.version).toBe(1)
    
    db.close()
  })

  test('should update metadata when collection.metadata_updated event is handled', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const collectionId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    
    // First create the collection
    const createPriorState = {} as any
    const createNewState = createCollectionState()
    const createEvent = new CollectionCreatedEvent({
      occurredAt: new Date('2024-01-01'),
      aggregateId: collectionId,
      correlationId,
      version: 0,
      priorState: createPriorState,
      newState: createNewState,
    })
    await collectionsListViewProjection(createEvent, repositories)
    await flushBatch(db, batch)

    // Now update metadata
    const batch2 = new TransactionBatch()
    const repositories2 = createRepositories(db, batch2)
    const updatePriorState = createCollectionState()
    const updateNewState = createCollectionState({
      name: 'Updated Collection Name',
      slug: 'updated-collection-slug',
      description: 'Updated description',
      updatedAt: new Date('2024-01-02'),
    })
    const updateEvent = new CollectionMetadataUpdatedEvent({
      occurredAt: new Date('2024-01-02'),
      aggregateId: collectionId,
      correlationId,
      version: 1,
      priorState: updatePriorState,
      newState: updateNewState,
    })

    // Act
    await collectionsListViewProjection(updateEvent, repositories2)
    await flushBatch(db, batch2)

    // Assert
    const collection = db.query(
      'SELECT * FROM collections_list_view WHERE aggregate_id = ?'
    ).get(collectionId) as any
    expect(collection).toBeDefined()
    expect(collection.name).toBe('Updated Collection Name')
    expect(collection.slug).toBe('updated-collection-slug')
    expect(collection.description).toBe('Updated description')
    expect(collection.version).toBe(1)
    
    db.close()
  })

  test('should handle multiple collections being created', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const collectionId1 = randomUUIDv7()
    const collectionId2 = randomUUIDv7()
    const correlationId1 = randomUUIDv7()
    const correlationId2 = randomUUIDv7()
    
    const priorState = {} as any
    const newState1 = createCollectionState({ name: 'Collection 1', slug: 'collection-1' })
    const newState2 = createCollectionState({ name: 'Collection 2', slug: 'collection-2' })
    
    const event1 = new CollectionCreatedEvent({
      occurredAt: new Date('2024-01-01'),
      aggregateId: collectionId1,
      correlationId: correlationId1,
      version: 0,
      priorState,
      newState: newState1,
    })
    
    const event2 = new CollectionCreatedEvent({
      occurredAt: new Date('2024-01-01'),
      aggregateId: collectionId2,
      correlationId: correlationId2,
      version: 0,
      priorState,
      newState: newState2,
    })

    // Act
    await collectionsListViewProjection(event1, repositories)
    await collectionsListViewProjection(event2, repositories)
    await flushBatch(db, batch)

    // Assert
    const collections = db.query(
      'SELECT * FROM collections_list_view ORDER BY name'
    ).all() as any[]
    expect(collections).toHaveLength(2)
    expect(collections[0]!.name).toBe('Collection 1')
    expect(collections[1]!.name).toBe('Collection 2')
    
    db.close()
  })

  test('should update version number correctly on subsequent events', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const collectionId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    
    // Create collection (version 0)
    const createPriorState = {} as any
    const createNewState = createCollectionState()
    const createEvent = new CollectionCreatedEvent({
      occurredAt: new Date('2024-01-01'),
      aggregateId: collectionId,
      correlationId,
      version: 0,
      priorState: createPriorState,
      newState: createNewState,
    })
    await collectionsListViewProjection(createEvent, repositories)
    await flushBatch(db, batch)

    // Update metadata (version 1)
    const batch2 = new TransactionBatch()
    const repositories2 = createRepositories(db, batch2)
    const updatePriorState = createCollectionState()
    const updateNewState = createCollectionState({ name: 'Updated Name', updatedAt: new Date('2024-01-02') })
    const updateEvent = new CollectionMetadataUpdatedEvent({
      occurredAt: new Date('2024-01-02'),
      aggregateId: collectionId,
      correlationId,
      version: 1,
      priorState: updatePriorState,
      newState: updateNewState,
    })
    await collectionsListViewProjection(updateEvent, repositories2)
    await flushBatch(db, batch2)

    // Archive collection (version 2)
    const batch3 = new TransactionBatch()
    const repositories3 = createRepositories(db, batch3)
    const archivePriorState = createCollectionState({ name: 'Updated Name' })
    const archiveNewState = createCollectionState({ name: 'Updated Name', status: 'archived', updatedAt: new Date('2024-01-03') })
    const archiveEvent = new CollectionArchivedEvent({
      occurredAt: new Date('2024-01-03'),
      aggregateId: collectionId,
      correlationId,
      version: 2,
      priorState: archivePriorState,
      newState: archiveNewState,
    })

    // Act
    await collectionsListViewProjection(archiveEvent, repositories3)
    await flushBatch(db, batch3)

    // Assert
    const collection = db.query(
      'SELECT * FROM collections_list_view WHERE aggregate_id = ?'
    ).get(collectionId) as any
    expect(collection).toBeDefined()
    expect(collection.version).toBe(2)
    expect(collection.status).toBe('archived')
    expect(collection.name).toBe('Updated Name')
    
    db.close()
  })
})

