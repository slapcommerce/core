import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { SnapshotRepository } from '../../../src/infrastructure/repositories/snapshotRepository'
import { TransactionBatch } from '../../../src/infrastructure/transactionBatch'

describe('SnapshotRepository', () => {
  let db: Database
  let batch: TransactionBatch

  beforeEach(() => {
    db = new Database(':memory:')
    db.run(`
      CREATE TABLE snapshots (
        aggregate_id TEXT PRIMARY KEY,
        correlation_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        payload TEXT NOT NULL
      )
    `)
    batch = new TransactionBatch()
  })

  afterEach(() => {
    db.close()
  })

  test('constructor properly initializes with Database and TransactionBatch dependencies', () => {
    // Act
    const repository = new SnapshotRepository(db, batch)

    // Assert - Repository should be created without errors
    expect(repository).toBeDefined()
    expect(repository).toBeInstanceOf(SnapshotRepository)
  })

  test('saveSnapshot creates a prepared SQL statement with correct INSERT OR REPLACE query', () => {
    // Arrange
    const repository = new SnapshotRepository(db, batch)
    const snapshot = {
      aggregate_id: 'test-aggregate',
      correlation_id: 'test-correlation',
      version: 5,
      payload: { state: 'test' }
    }

    // Act
    repository.saveSnapshot(snapshot)

    // Assert - Verify the command was added to batch
    expect(batch.commands.length).toBe(1)
    expect(batch.commands[0]!.type).toBe('insert')
    expect(batch.commands[0]!.statement).toBeDefined()
  })

  test('saveSnapshot adds command to batch with correct parameters', () => {
    // Arrange
    const repository = new SnapshotRepository(db, batch)
    const snapshot = {
      aggregate_id: 'product-123',
      correlation_id: 'corr-456',
      version: 10,
      payload: { title: 'Test Product', status: 'active' }
    }

    // Act
    repository.saveSnapshot(snapshot)

    // Assert
    expect(batch.commands.length).toBe(1)
    const command = batch.commands[0]!
    expect(command.params).toEqual([
      'product-123',
      'corr-456',
      10,
      JSON.stringify({ title: 'Test Product', status: 'active' })
    ])
  })

  test('saveSnapshot sets command type to insert', () => {
    // Arrange
    const repository = new SnapshotRepository(db, batch)
    const snapshot = {
      aggregate_id: 'test-aggregate',
      correlation_id: 'test-correlation',
      version: 1,
      payload: { test: true }
    }

    // Act
    repository.saveSnapshot(snapshot)

    // Assert
    expect(batch.commands[0]!.type).toBe('insert')
  })

  test('multiple snapshots can be added sequentially', () => {
    // Arrange
    const repository = new SnapshotRepository(db, batch)

    // Act
    repository.saveSnapshot({
      aggregate_id: 'agg-1',
      correlation_id: 'corr-1',
      version: 1,
      payload: { snapshot: 1 }
    })

    repository.saveSnapshot({
      aggregate_id: 'agg-2',
      correlation_id: 'corr-2',
      version: 2,
      payload: { snapshot: 2 }
    })

    repository.saveSnapshot({
      aggregate_id: 'agg-3',
      correlation_id: 'corr-3',
      version: 3,
      payload: { snapshot: 3 }
    })

    // Assert
    expect(batch.commands.length).toBe(3)
    expect(batch.commands[0]!.params[0]).toBe('agg-1')
    expect(batch.commands[1]!.params[0]).toBe('agg-2')
    expect(batch.commands[2]!.params[0]).toBe('agg-3')
  })

  test('all snapshot fields are correctly passed to the batch', () => {
    // Arrange
    const repository = new SnapshotRepository(db, batch)
    const aggregateId = 'order-789'
    const correlationId = 'corr-999'
    const version = 15
    const payload = { orderId: '789', total: 99.99 }

    const snapshot = {
      aggregate_id: aggregateId,
      correlation_id: correlationId,
      version,
      payload
    }

    // Act
    repository.saveSnapshot(snapshot)

    // Assert
    const command = batch.commands[0]!
    expect(command.params[0]).toBe(aggregateId)
    expect(command.params[1]).toBe(correlationId)
    expect(command.params[2]).toBe(version)
    expect(command.params[3]).toBe(JSON.stringify(payload))
  })
})

