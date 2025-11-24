import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { ProductListViewRepository } from '../../../src/infrastructure/repositories/productListViewRepository'
import { TransactionBatch } from '../../../src/infrastructure/transactionBatch'
import { createTestDatabase, closeTestDatabase } from '../../helpers/database'

describe('ProductListViewRepository', () => {
  test('constructor properly initializes with Database and TransactionBatch dependencies', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      // Act
      const repository = new ProductListViewRepository(db, batch)

      // Assert - Repository should be created without errors
      expect(repository).toBeDefined()
      expect(repository).toBeInstanceOf(ProductListViewRepository)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('save creates a prepared SQL statement with correct INSERT OR REPLACE query', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
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
        taxable: 1,
        fulfillment_type: 'digital' as const,
        dropship_safety_buffer: null,
        variant_options: [],
        version: 0,
        updated_at: new Date(),
        collection_ids: ['collection-1'],
        meta_title: '',
        meta_description: '',
      }

      // Act
      repository.save(data)

      // Assert - Verify the command was added to batch
      expect(batch.commands.length).toBe(1)
      expect(batch.commands[0]!.type).toBe('insert')
      expect(batch.commands[0]!.statement).toBeDefined()
    } finally {
      closeTestDatabase(db)
    }
  })

  test('save sets command type to insert', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
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
        taxable: 1,
        fulfillment_type: 'digital' as const,
        dropship_safety_buffer: null,
        variant_options: [],
        version: 0,
        updated_at: new Date(),
        collection_ids: ['collection-1'],
        meta_title: '',
        meta_description: '',
      }

      // Act
      repository.save(data)

      // Assert
      expect(batch.commands[0]!.type).toBe('insert')
    } finally {
      closeTestDatabase(db)
    }
  })

  test('save can upsert existing records', async () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
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
        taxable: 1,
        fulfillment_type: 'digital' as const,
        dropship_safety_buffer: null,
        variant_options: [],
        version: 0,
        updated_at: initialUpdatedAt,
        collection_ids: ['collection-1'],
        meta_title: '',
        meta_description: '',
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
        taxable: 1,
        fulfillment_type: 'digital' as const,
        dropship_safety_buffer: null,
        variant_options: [],
        version: 1,
        updated_at: new Date(2000),
        collection_ids: ['collection-1'],
        meta_title: '',
        meta_description: '',
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
    } finally {
      closeTestDatabase(db)
    }
  })
})

