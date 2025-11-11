import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { ProjectionRepository } from '../../src/infrastructure/repository'
import { TransactionBatch } from '../../src/infrastructure/transactionBatch'

describe('ProjectionRepository', () => {
  let db: Database
  let batch: TransactionBatch

  beforeEach(() => {
    db = new Database(':memory:')
    db.run(`
      CREATE TABLE projections (
        id TEXT PRIMARY KEY,
        projection_type TEXT NOT NULL,
        aggregate_id TEXT NOT NULL,
        correlation_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `)
    batch = new TransactionBatch()
  })

  afterEach(() => {
    db.close()
  })

  test('constructor properly initializes with Database and TransactionBatch dependencies', () => {
    // Act
    const repository = new ProjectionRepository(db, batch)

    // Assert - Repository should be created without errors
    expect(repository).toBeDefined()
    expect(repository).toBeInstanceOf(ProjectionRepository)
  })

  test('saveProjection creates a prepared SQL statement with correct INSERT query', () => {
    // Arrange
    const repository = new ProjectionRepository(db, batch)
    const projection = {
      id: 'test-id',
      projection_type: 'test_projection',
      aggregate_id: 'aggregate-id',
      correlation_id: 'correlation-id',
      version: 1,
      payload: JSON.stringify({ test: true }),
      created_at: Date.now()
    }

    // Act
    repository.saveProjection(projection)

    // Assert - Verify the command was added to batch
    expect(batch.commands.length).toBe(1)
    expect(batch.commands[0]!.type).toBe('insert')
    expect(batch.commands[0]!.statement).toBeDefined()
  })

  test('saveProjection adds command to batch with correct parameters', () => {
    // Arrange
    const repository = new ProjectionRepository(db, batch)
    const projection = {
      id: 'test-id-123',
      projection_type: 'product_list_view',
      aggregate_id: 'aggregate-456',
      correlation_id: 'correlation-789',
      version: 5,
      payload: JSON.stringify({ title: 'Test Product' }),
      created_at: 1234567890
    }

    // Act
    repository.saveProjection(projection)

    // Assert - Verify parameters match
    expect(batch.commands.length).toBe(1)
    const command = batch.commands[0]!
    expect(command.params).toEqual([
      'test-id-123',
      'product_list_view',
      'aggregate-456',
      'correlation-789',
      5,
      JSON.stringify({ title: 'Test Product' }),
      1234567890
    ])
  })

  test('saveProjection can queue multiple projections', () => {
    // Arrange
    const repository = new ProjectionRepository(db, batch)
    const projection1 = {
      id: 'id-1',
      projection_type: 'type-1',
      aggregate_id: 'agg-1',
      correlation_id: 'corr-1',
      version: 1,
      payload: JSON.stringify({ data: 1 }),
      created_at: Date.now()
    }
    const projection2 = {
      id: 'id-2',
      projection_type: 'type-2',
      aggregate_id: 'agg-2',
      correlation_id: 'corr-2',
      version: 2,
      payload: JSON.stringify({ data: 2 }),
      created_at: Date.now()
    }

    // Act
    repository.saveProjection(projection1)
    repository.saveProjection(projection2)

    // Assert - Both commands should be queued
    expect(batch.commands.length).toBe(2)
    expect(batch.commands[0]!.params[0]).toBe('id-1')
    expect(batch.commands[1]!.params[0]).toBe('id-2')
  })

  test('saveProjection persists projection when batch is executed', async () => {
    // Arrange
    const repository = new ProjectionRepository(db, batch)
    const projection = {
      id: 'persist-test-id',
      projection_type: 'test_projection',
      aggregate_id: 'test-aggregate',
      correlation_id: 'test-correlation',
      version: 1,
      payload: JSON.stringify({ test: 'data' }),
      created_at: Date.now()
    }

    repository.saveProjection(projection)

    // Act - Execute the batch commands
    for (const command of batch.commands) {
      command.statement.run(...command.params)
    }

    // Assert - Verify projection was saved
    const result = db.query('SELECT * FROM projections WHERE id = ?').get(projection.id) as any
    expect(result).toBeDefined()
    expect(result.id).toBe(projection.id)
    expect(result.projection_type).toBe(projection.projection_type)
    expect(result.aggregate_id).toBe(projection.aggregate_id)
    expect(result.correlation_id).toBe(projection.correlation_id)
    expect(result.version).toBe(projection.version)
    expect(result.payload).toBe(projection.payload)
    expect(result.created_at).toBe(projection.created_at)
  })

  test('saveProjection handles JSON payload correctly', () => {
    // Arrange
    const repository = new ProjectionRepository(db, batch)
    const complexPayload = {
      title: 'Test Product',
      tags: ['tag1', 'tag2'],
      metadata: {
        nested: {
          value: 123
        }
      }
    }
    const projection = {
      id: 'json-test-id',
      projection_type: 'test_projection',
      aggregate_id: 'test-aggregate',
      correlation_id: 'test-correlation',
      version: 1,
      payload: JSON.stringify(complexPayload),
      created_at: Date.now()
    }

    // Act
    repository.saveProjection(projection)

    // Assert - Verify JSON is stringified correctly
    expect(batch.commands.length).toBe(1)
    const savedPayload = JSON.parse(batch.commands[0]!.params[5] as string)
    expect(savedPayload).toEqual(complexPayload)
  })

  test('saveProjection handles different projection types', () => {
    // Arrange
    const repository = new ProjectionRepository(db, batch)
    const types = ['product_list_view', 'product_detail_view', 'product_search_index']

    // Act
    types.forEach((type, index) => {
      repository.saveProjection({
        id: `id-${index}`,
        projection_type: type,
        aggregate_id: 'test-aggregate',
        correlation_id: 'test-correlation',
        version: index,
        payload: JSON.stringify({ type }),
        created_at: Date.now()
      })
    })

    // Assert - All types should be queued
    expect(batch.commands.length).toBe(3)
    types.forEach((type, index) => {
      expect(batch.commands[index]!.params[1]).toBe(type)
    })
  })
})

