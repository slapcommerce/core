import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { ProductListViewRepository } from '../../src/infrastructure/productListViewRepository'
import { TransactionBatch } from '../../src/infrastructure/transactionBatch'

describe('ProductListViewRepository', () => {
  let db: Database
  let batch: TransactionBatch

  beforeEach(() => {
    db = new Database(':memory:')
    db.run(`
      CREATE TABLE product_list_view (
        aggregate_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        slug TEXT NOT NULL,
        vendor TEXT NOT NULL,
        product_type TEXT NOT NULL,
        short_description TEXT NOT NULL,
        tags TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        correlation_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)
    batch = new TransactionBatch()
  })

  afterEach(() => {
    db.close()
  })

  test('constructor properly initializes with Database and TransactionBatch dependencies', () => {
    // Act
    const repository = new ProductListViewRepository(db, batch)

    // Assert - Repository should be created without errors
    expect(repository).toBeDefined()
    expect(repository).toBeInstanceOf(ProductListViewRepository)
  })

  test('save creates a prepared SQL statement with correct INSERT OR REPLACE query', () => {
    // Arrange
    const repository = new ProductListViewRepository(db, batch)
    const data = {
      aggregate_id: 'product-123',
      title: 'Test Product',
      slug: 'test-product',
      vendor: 'Test Vendor',
      product_type: 'physical',
      short_description: 'A test product',
      tags: ['test', 'product'],
      created_at: new Date(),
      status: 'draft' as const,
      correlation_id: 'corr-456',
      version: 0,
      updated_at: new Date(),
    }

    // Act
    repository.save(data)

    // Assert - Verify the command was added to batch
    expect(batch.commands.length).toBe(1)
    expect(batch.commands[0]!.type).toBe('insert')
    expect(batch.commands[0]!.statement).toBeDefined()
  })

  test('save adds command to batch with correct parameters', () => {
    // Arrange
    const repository = new ProductListViewRepository(db, batch)
    const createdAt = new Date(1234567890)
    const updatedAt = new Date(1234567890)
    const data = {
      aggregate_id: 'product-123',
      title: 'Test Product',
      slug: 'test-product',
      vendor: 'Test Vendor',
      product_type: 'physical',
      short_description: 'A test product',
      tags: ['tag1', 'tag2'],
      created_at: createdAt,
      status: 'draft' as const,
      correlation_id: 'corr-456',
      version: 0,
      updated_at: updatedAt,
    }

    // Act
    repository.save(data)

    // Assert
    expect(batch.commands.length).toBe(1)
    const command = batch.commands[0]!
    expect(command.params).toEqual([
      'product-123',
      'Test Product',
      'test-product',
      'Test Vendor',
      'physical',
      'A test product',
      JSON.stringify(['tag1', 'tag2']),
      createdAt.toISOString(),
      'draft',
      'corr-456',
      0,
      updatedAt.toISOString(),
    ])
  })

  test('save sets command type to insert', () => {
    // Arrange
    const repository = new ProductListViewRepository(db, batch)
    const data = {
      aggregate_id: 'product-123',
      title: 'Test Product',
      slug: 'test-product',
      vendor: 'Test Vendor',
      product_type: 'physical',
      short_description: 'A test product',
      tags: [],
      created_at: new Date(),
      status: 'draft' as const,
      correlation_id: 'corr-456',
      version: 0,
      updated_at: new Date(),
    }

    // Act
    repository.save(data)

    // Assert
    expect(batch.commands[0]!.type).toBe('insert')
  })

  test('save can upsert existing records', async () => {
    // Arrange
    const repository = new ProductListViewRepository(db, batch)
    const initialCreatedAt = new Date(1000)
    const initialUpdatedAt = new Date(1000)
    const initialData = {
      aggregate_id: 'product-123',
      title: 'Initial Product',
      slug: 'initial-product',
      vendor: 'Initial Vendor',
      product_type: 'physical',
      short_description: 'Initial description',
      tags: ['initial'],
      created_at: initialCreatedAt,
      status: 'draft' as const,
      correlation_id: 'corr-456',
      version: 0,
      updated_at: initialUpdatedAt,
    }
    repository.save(initialData)
    // Manually execute to persist initial state
    db.transaction(() => {
      for (const command of batch.commands) {
        command.statement.run(...command.params)
      }
    })()

    // Create a new batch for the update
    const newBatch = new TransactionBatch()
    const updatedRepository = new ProductListViewRepository(db, newBatch)
    const updatedData = {
      aggregate_id: 'product-123',
      title: 'Updated Product',
      slug: 'updated-product',
      vendor: 'Updated Vendor',
      product_type: 'digital',
      short_description: 'Updated description',
      tags: ['updated'],
      created_at: initialCreatedAt, // Keep original created_at
      status: 'archived' as const,
      correlation_id: 'corr-456',
      version: 1,
      updated_at: new Date(2000),
    }

    // Act
    updatedRepository.save(updatedData)
    // Manually execute to persist update
    db.transaction(() => {
      for (const command of newBatch.commands) {
        command.statement.run(...command.params)
      }
    })()

    // Assert
    const updatedRecord = db.query('SELECT * FROM product_list_view WHERE aggregate_id = ?').get('product-123') as any
    expect(updatedRecord).toBeDefined()
    expect(updatedRecord.title).toBe('Updated Product')
    expect(updatedRecord.status).toBe('archived')
    expect(updatedRecord.version).toBe(1)
    expect(updatedRecord.created_at).toBe(initialCreatedAt.toISOString()) // Should preserve original created_at
  })
})

