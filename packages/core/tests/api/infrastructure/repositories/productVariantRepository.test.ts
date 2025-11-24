import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { ProductVariantRepository } from '../../../../src/api/infrastructure/repositories/productVariantRepository'
import { TransactionBatch } from '../../../../src/api/infrastructure/transactionBatch'
import { createTestDatabase, closeTestDatabase } from '../../helpers/database'

describe('ProductVariantRepository', () => {
  test('constructor properly initializes with Database and TransactionBatch dependencies', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      // Act
      const repository = new ProductVariantRepository(db, batch)

      // Assert - Repository should be created without errors
      expect(repository).toBeDefined()
      expect(repository).toBeInstanceOf(ProductVariantRepository)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('save creates a prepared SQL statement with correct INSERT OR REPLACE query', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new ProductVariantRepository(db, batch)
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
      repository.save(data, 'variant-789')

      // Assert - Verify the command was added to batch
      expect(batch.commands.length).toBe(1)
      expect(batch.commands[0]!.type).toBe('insert')
      expect(batch.commands[0]!.statement).toBeDefined()
    } finally {
      closeTestDatabase(db)
    }
  })

  test('save adds command to batch with correct parameters', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new ProductVariantRepository(db, batch)
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
        taxable: 1,
        fulfillment_type: 'digital' as const,
        dropship_safety_buffer: null,
        variant_options: [],
        version: 0,
        updated_at: updatedAt,
        collection_ids: ['collection-1'],
        meta_title: '',
        meta_description: '',
      }

      // Act
      repository.save(data, 'variant-789')

      // Assert
      expect(batch.commands.length).toBe(1)
      const command = batch.commands[0]!
      expect(command.params).toEqual([
        'product-123',
        'variant-789',
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
        '',
        '',
      ])
    } finally {
      closeTestDatabase(db)
    }
  })

  test('save sets command type to insert', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new ProductVariantRepository(db, batch)
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
      repository.save(data, 'variant-789')

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
      const repository = new ProductVariantRepository(db, batch)
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
      repository.save(initialData, 'variant-789')
      // Manually execute to persist initial state
      db.transaction(() => {
        for (const command of batch.commands) {
          command.statement.run(...command.params)
        }
      })()

      // Create a new batch for the update
      const newBatch = new TransactionBatch()
      const updatedRepository = new ProductVariantRepository(db, newBatch)
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
        taxable: 0,
        fulfillment_type: 'dropship' as const,
        dropship_safety_buffer: 5,
        variant_options: [],
        version: 1,
        updated_at: new Date(2000),
        collection_ids: ['collection-1'],
        meta_title: '',
        meta_description: '',
      }

      // Act
      updatedRepository.save(updatedData, 'variant-789')
      // Manually execute to persist update
      db.transaction(() => {
        for (const command of newBatch.commands) {
          command.statement.run(...command.params)
        }
      })()

      // Assert
      const updatedRecord = db.query('SELECT * FROM product_variants WHERE aggregate_id = ? AND variant_id = ?').get('product-123', 'variant-789') as any
      expect(updatedRecord).toBeDefined()
      expect(updatedRecord.title).toBe('Updated Product')
      expect(updatedRecord.status).toBe('archived')
      expect(updatedRecord.version).toBe(1)
      expect(updatedRecord.created_at).toBe(initialCreatedAt.toISOString()) // Should preserve original created_at
    } finally {
      closeTestDatabase(db)
    }
  })

  test('deleteByProduct adds delete command to batch', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new ProductVariantRepository(db, batch)

      // Act
      repository.deleteByProduct('product-123')

      // Assert
      expect(batch.commands.length).toBe(1)
      expect(batch.commands[0]!.type).toBe('delete')
      expect(batch.commands[0]!.params).toEqual(['product-123'])
    } finally {
      closeTestDatabase(db)
    }
  })

  test('deleteByVariant adds delete command to batch', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new ProductVariantRepository(db, batch)

      // Act
      repository.deleteByVariant('variant-789')

      // Assert
      expect(batch.commands.length).toBe(1)
      expect(batch.commands[0]!.type).toBe('delete')
      expect(batch.commands[0]!.params).toEqual(['variant-789'])
    } finally {
      closeTestDatabase(db)
    }
  })

  test('findByProduct returns empty array when no variants found', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new ProductVariantRepository(db, batch)

      // Act
      const result = repository.findByProduct('product-123')

      // Assert
      expect(result).toEqual([])
    } finally {
      closeTestDatabase(db)
    }
  })

  test('findByProduct returns variantId and data pairs', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new ProductVariantRepository(db, batch)
      const createdAt = new Date(1000)
      const updatedAt = new Date(2000)
      
      // Insert product_list_view record
      db.run(`
        INSERT INTO product_list_view (
          aggregate_id, title, slug, vendor, product_type, short_description,
          tags, created_at, status, correlation_id, version, updated_at, collection_ids
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
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
        JSON.stringify(['collection-789', 'collection-999']),
      ])

      // Insert multiple product_variants records
      db.run(`
        INSERT INTO product_variants (
          aggregate_id, variant_id, title, slug, vendor, product_type, short_description,
          tags, created_at, status, correlation_id, version, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'product-123',
        'variant-789',
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

      db.run(`
        INSERT INTO product_variants (
          aggregate_id, variant_id, title, slug, vendor, product_type, short_description,
          tags, created_at, status, correlation_id, version, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'product-123',
        'variant-999',
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

      // Act
      const result = repository.findByProduct('product-123')

      // Assert
      expect(result.length).toBe(2)
      expect(result[0]!.variantId).toBe('variant-789')
      expect(result[1]!.variantId).toBe('variant-999')
      expect(result[0]!.data.aggregate_id).toBe('product-123')
      expect(result[0]!.data.collection_ids).toEqual(['collection-789', 'collection-999'])
    } finally {
      closeTestDatabase(db)
    }
  })

  test('findByProduct joins with product_list_view to get collection_ids', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new ProductVariantRepository(db, batch)
      const createdAt = new Date(1000)
      const updatedAt = new Date(2000)
      
      // Insert product_list_view record
      db.run(`
        INSERT INTO product_list_view (
          aggregate_id, title, slug, vendor, product_type, short_description,
          tags, created_at, status, correlation_id, version, updated_at, collection_ids
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'product-123',
        'Test Product',
        'test-product',
        'Test Vendor',
        'physical',
        'A test product',
        JSON.stringify(['tag1']),
        createdAt.toISOString(),
        'active',
        'corr-456',
        1,
        updatedAt.toISOString(),
        JSON.stringify(['collection-789']),
      ])

      // Insert product_variants record
      db.run(`
        INSERT INTO product_variants (
          aggregate_id, variant_id, title, slug, vendor, product_type, short_description,
          tags, created_at, status, correlation_id, version, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'product-123',
        'variant-789',
        'Test Product',
        'test-product',
        'Test Vendor',
        'physical',
        'A test product',
        JSON.stringify(['tag1']),
        createdAt.toISOString(),
        'active',
        'corr-456',
        1,
        updatedAt.toISOString(),
      ])

      // Act
      const result = repository.findByProduct('product-123')

      // Assert - Verify collection_ids comes from product_list_view join
      expect(result.length).toBe(1)
      expect(result[0]!.data.collection_ids).toEqual(['collection-789'])
    } finally {
      closeTestDatabase(db)
    }
  })

  test('findByVariant returns empty array when no variants found', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new ProductVariantRepository(db, batch)

      // Act
      const result = repository.findByVariant('variant-789')

      // Assert
      expect(result).toEqual([])
    } finally {
      closeTestDatabase(db)
    }
  })

  test('findByVariant returns ProductListViewData array', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new ProductVariantRepository(db, batch)
      const createdAt = new Date(1000)
      const updatedAt = new Date(2000)
      
      // Insert product_list_view record
      db.run(`
        INSERT INTO product_list_view (
          aggregate_id, title, slug, vendor, product_type, short_description,
          tags, created_at, status, correlation_id, version, updated_at, collection_ids
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
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
        JSON.stringify(['collection-789']),
      ])

      // Insert product_variants record
      db.run(`
        INSERT INTO product_variants (
          aggregate_id, variant_id, title, slug, vendor, product_type, short_description,
          tags, created_at, status, correlation_id, version, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'product-123',
        'variant-789',
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

      // Act
      const result = repository.findByVariant('variant-789')

      // Assert
      expect(result.length).toBe(1)
      expect(result[0]).toEqual({
        aggregate_id: 'product-123',
        title: 'Test Product',
        slug: 'test-product',
        vendor: 'Test Vendor',
        product_type: 'physical',
        short_description: 'A test product',
        tags: ['tag1', 'tag2'],
        created_at: createdAt,
        status: 'draft',
        correlation_id: 'corr-456',
        taxable: 1,
        fulfillment_type: 'digital',
        dropship_safety_buffer: null,
        variant_options: [],
        version: 0,
        updated_at: updatedAt,
        collection_ids: ['collection-789'],
        meta_title: '',
        meta_description: '',
      })
    } finally {
      closeTestDatabase(db)
    }
  })

  test('findByVariant joins with product_list_view to get collection_ids', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new ProductVariantRepository(db, batch)
      const createdAt = new Date(1000)
      const updatedAt = new Date(2000)
      
      // Insert product_list_view record
      db.run(`
        INSERT INTO product_list_view (
          aggregate_id, title, slug, vendor, product_type, short_description,
          tags, created_at, status, correlation_id, version, updated_at, collection_ids
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'product-123',
        'Test Product',
        'test-product',
        'Test Vendor',
        'physical',
        'A test product',
        JSON.stringify(['tag1']),
        createdAt.toISOString(),
        'active',
        'corr-456',
        1,
        updatedAt.toISOString(),
        JSON.stringify(['collection-789', 'collection-999']),
      ])

      // Insert product_variants record
      db.run(`
        INSERT INTO product_variants (
          aggregate_id, variant_id, title, slug, vendor, product_type, short_description,
          tags, created_at, status, correlation_id, version, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'product-123',
        'variant-789',
        'Test Product',
        'test-product',
        'Test Vendor',
        'physical',
        'A test product',
        JSON.stringify(['tag1']),
        createdAt.toISOString(),
        'active',
        'corr-456',
        1,
        updatedAt.toISOString(),
      ])

      // Act
      const result = repository.findByVariant('variant-789')

      // Assert - Verify collection_ids comes from product_list_view join
      expect(result.length).toBe(1)
      expect(result[0]!.collection_ids).toEqual(['collection-789', 'collection-999'])
    } finally {
      closeTestDatabase(db)
    }
  })
})

