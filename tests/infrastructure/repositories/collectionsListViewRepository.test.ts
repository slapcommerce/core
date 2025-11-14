import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { CollectionsListViewRepository } from '../../../src/infrastructure/repositories/collectionsListViewRepository'
import { TransactionBatch } from '../../../src/infrastructure/transactionBatch'
import { createTestDatabase, closeTestDatabase } from '../../helpers/database'

describe('CollectionsListViewRepository', () => {
  test('constructor properly initializes with Database and TransactionBatch dependencies', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      // Act
      const repository = new CollectionsListViewRepository(db, batch)

      // Assert - Repository should be created without errors
      expect(repository).toBeDefined()
      expect(repository).toBeInstanceOf(CollectionsListViewRepository)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('save creates a prepared SQL statement with correct INSERT OR REPLACE query', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new CollectionsListViewRepository(db, batch)
      const data = {
        aggregate_id: 'collection-123',
        name: 'Test Collection',
        slug: 'test-collection',
        description: 'A test collection',
        status: 'draft' as const,
        correlation_id: 'corr-456',
        version: 0,
        created_at: new Date(),
        updated_at: new Date(),
        meta_title: 'Test Meta Title',
        meta_description: 'Test Meta Description',
        published_at: null,
        image_url: null,
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

  test('save adds command to batch with correct parameters', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new CollectionsListViewRepository(db, batch)
      const createdAt = new Date('2024-01-01T00:00:00Z')
      const updatedAt = new Date('2024-01-02T00:00:00Z')
      const publishedAt = new Date('2024-01-03T00:00:00Z')
      const data = {
        aggregate_id: 'collection-123',
        name: 'Test Collection',
        slug: 'test-collection',
        description: 'A test collection',
        status: 'active' as const,
        correlation_id: 'corr-456',
        version: 1,
        created_at: createdAt,
        updated_at: updatedAt,
        meta_title: 'Test Meta Title',
        meta_description: 'Test Meta Description',
        published_at: publishedAt,
        image_url: 'https://example.com/image.jpg',
      }

      // Act
      repository.save(data)

      // Assert
      expect(batch.commands.length).toBe(1)
      const command = batch.commands[0]!
      expect(command.params).toEqual([
        'collection-123',
        'Test Collection',
        'test-collection',
        'A test collection',
        'active',
        'corr-456',
        1,
        createdAt.toISOString(),
        updatedAt.toISOString(),
        'Test Meta Title',
        'Test Meta Description',
        publishedAt.toISOString(),
        'https://example.com/image.jpg',
      ])
    } finally {
      closeTestDatabase(db)
    }
  })

  test('save handles null values for optional fields', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new CollectionsListViewRepository(db, batch)
      const createdAt = new Date('2024-01-01T00:00:00Z')
      const updatedAt = new Date('2024-01-02T00:00:00Z')
      const data = {
        aggregate_id: 'collection-123',
        name: 'Test Collection',
        slug: 'test-collection',
        description: null,
        status: 'draft' as const,
        correlation_id: 'corr-456',
        version: 0,
        created_at: createdAt,
        updated_at: updatedAt,
        meta_title: 'Test Meta Title',
        meta_description: 'Test Meta Description',
        published_at: null,
        image_url: null,
      }

      // Act
      repository.save(data)

      // Assert
      expect(batch.commands.length).toBe(1)
      const command = batch.commands[0]!
      expect(command.params).toEqual([
        'collection-123',
        'Test Collection',
        'test-collection',
        null,
        'draft',
        'corr-456',
        0,
        createdAt.toISOString(),
        updatedAt.toISOString(),
        'Test Meta Title',
        'Test Meta Description',
        null,
        null,
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
      const repository = new CollectionsListViewRepository(db, batch)
      const data = {
        aggregate_id: 'collection-123',
        name: 'Test Collection',
        slug: 'test-collection',
        description: 'A test collection',
        status: 'draft' as const,
        correlation_id: 'corr-456',
        version: 0,
        created_at: new Date(),
        updated_at: new Date(),
        meta_title: 'Test Meta Title',
        meta_description: 'Test Meta Description',
        published_at: null,
        image_url: null,
      }

      // Act
      repository.save(data)

      // Assert
      expect(batch.commands[0]!.type).toBe('insert')
    } finally {
      closeTestDatabase(db)
    }
  })

  test('save can upsert existing records', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new CollectionsListViewRepository(db, batch)
      const initialCreatedAt = new Date('2024-01-01T00:00:00Z')
      const initialUpdatedAt = new Date('2024-01-02T00:00:00Z')
      const initialData = {
        aggregate_id: 'collection-123',
        name: 'Initial Collection',
        slug: 'initial-collection',
        description: 'Initial description',
        status: 'draft' as const,
        correlation_id: 'corr-456',
        version: 0,
        created_at: initialCreatedAt,
        updated_at: initialUpdatedAt,
        meta_title: 'Initial Meta Title',
        meta_description: 'Initial Meta Description',
        published_at: null,
        image_url: null,
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
      const updatedRepository = new CollectionsListViewRepository(db, newBatch)
      const updatedData = {
        aggregate_id: 'collection-123',
        name: 'Updated Collection',
        slug: 'updated-collection',
        description: 'Updated description',
        status: 'active' as const,
        correlation_id: 'corr-456',
        version: 1,
        created_at: initialCreatedAt, // Keep original created_at
        updated_at: new Date('2024-01-03T00:00:00Z'),
        meta_title: 'Updated Meta Title',
        meta_description: 'Updated Meta Description',
        published_at: new Date('2024-01-03T00:00:00Z'),
        image_url: 'https://example.com/updated-image.jpg',
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
      const updatedRecord = db.query('SELECT * FROM collections_list_view WHERE aggregate_id = ?').get('collection-123') as any
      expect(updatedRecord).toBeDefined()
      expect(updatedRecord.name).toBe('Updated Collection')
      expect(updatedRecord.status).toBe('active')
      expect(updatedRecord.version).toBe(1)
      expect(updatedRecord.created_at).toBe(initialCreatedAt.toISOString()) // Should preserve original created_at
      expect(updatedRecord.published_at).toBe(new Date('2024-01-03T00:00:00Z').toISOString())
      expect(updatedRecord.image_url).toBe('https://example.com/updated-image.jpg')
    } finally {
      closeTestDatabase(db)
    }
  })

  test('findByCollectionId returns null when collection not found', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new CollectionsListViewRepository(db, batch)

      // Act
      const result = repository.findByCollectionId('non-existent-collection')

      // Assert
      expect(result).toBeNull()
    } finally {
      closeTestDatabase(db)
    }
  })

  test('findByCollectionId returns collection with correct data structure', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new CollectionsListViewRepository(db, batch)
      const createdAt = new Date('2024-01-01T00:00:00Z')
      const updatedAt = new Date('2024-01-02T00:00:00Z')
      const publishedAt = new Date('2024-01-03T00:00:00Z')

      // Insert test data directly
      db.run(`
        INSERT INTO collections_list_view (
          aggregate_id, name, slug, description, status, correlation_id, version,
          created_at, updated_at, meta_title, meta_description, published_at, image_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'collection-123',
        'Test Collection',
        'test-collection',
        'A test collection',
        'active',
        'corr-456',
        1,
        createdAt.toISOString(),
        updatedAt.toISOString(),
        'Test Meta Title',
        'Test Meta Description',
        publishedAt.toISOString(),
        'https://example.com/image.jpg',
      ])

      // Act
      const result = repository.findByCollectionId('collection-123')

      // Assert
      expect(result).toBeDefined()
      expect(result).toEqual({
        aggregate_id: 'collection-123',
        name: 'Test Collection',
        slug: 'test-collection',
        description: 'A test collection',
        status: 'active',
        correlation_id: 'corr-456',
        version: 1,
        created_at: createdAt,
        updated_at: updatedAt,
        meta_title: 'Test Meta Title',
        meta_description: 'Test Meta Description',
        published_at: publishedAt,
        image_url: 'https://example.com/image.jpg',
      })
    } finally {
      closeTestDatabase(db)
    }
  })

  test('findByCollectionId handles null values for optional fields', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new CollectionsListViewRepository(db, batch)
      const createdAt = new Date('2024-01-01T00:00:00Z')
      const updatedAt = new Date('2024-01-02T00:00:00Z')

      // Insert test data with null values
      db.run(`
        INSERT INTO collections_list_view (
          aggregate_id, name, slug, description, status, correlation_id, version,
          created_at, updated_at, meta_title, meta_description, published_at, image_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'collection-123',
        'Test Collection',
        'test-collection',
        null,
        'draft',
        'corr-456',
        0,
        createdAt.toISOString(),
        updatedAt.toISOString(),
        '',
        '',
        null,
        null,
      ])

      // Act
      const result = repository.findByCollectionId('collection-123')

      // Assert
      expect(result).toBeDefined()
      expect(result!.description).toBeNull()
      expect(result!.published_at).toBeNull()
      expect(result!.image_url).toBeNull()
      expect(result!.meta_title).toBe('')
      expect(result!.meta_description).toBe('')
    } finally {
      closeTestDatabase(db)
    }
  })

  test('findByCollectionId converts date strings to Date objects', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new CollectionsListViewRepository(db, batch)
      const createdAt = new Date('2024-01-01T00:00:00Z')
      const updatedAt = new Date('2024-01-02T00:00:00Z')
      const publishedAt = new Date('2024-01-03T00:00:00Z')

      // Insert test data
      db.run(`
        INSERT INTO collections_list_view (
          aggregate_id, name, slug, description, status, correlation_id, version,
          created_at, updated_at, meta_title, meta_description, published_at, image_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'collection-123',
        'Test Collection',
        'test-collection',
        'A test collection',
        'active',
        'corr-456',
        1,
        createdAt.toISOString(),
        updatedAt.toISOString(),
        'Test Meta Title',
        'Test Meta Description',
        publishedAt.toISOString(),
        'https://example.com/image.jpg',
      ])

      // Act
      const result = repository.findByCollectionId('collection-123')

      // Assert - Verify dates are Date objects, not strings
      expect(result).toBeDefined()
      expect(result!.created_at).toBeInstanceOf(Date)
      expect(result!.updated_at).toBeInstanceOf(Date)
      expect(result!.published_at).toBeInstanceOf(Date)
      expect(result!.created_at.getTime()).toBe(createdAt.getTime())
      expect(result!.updated_at.getTime()).toBe(updatedAt.getTime())
      expect(result!.published_at!.getTime()).toBe(publishedAt.getTime())
    } finally {
      closeTestDatabase(db)
    }
  })

  test('findByCollectionId handles all status types', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new CollectionsListViewRepository(db, batch)
      const createdAt = new Date('2024-01-01T00:00:00Z')
      const updatedAt = new Date('2024-01-02T00:00:00Z')

      const statuses: Array<'draft' | 'active' | 'archived'> = ['draft', 'active', 'archived']

      for (const status of statuses) {
        // Insert test data
        db.run(`
          INSERT INTO collections_list_view (
            aggregate_id, name, slug, description, status, correlation_id, version,
            created_at, updated_at, meta_title, meta_description, published_at, image_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          `collection-${status}`,
          `Test Collection ${status}`,
          `test-collection-${status}`,
          'A test collection',
          status,
          'corr-456',
          0,
          createdAt.toISOString(),
          updatedAt.toISOString(),
          'Test Meta Title',
          'Test Meta Description',
          null,
          null,
        ])

        // Act
        const result = repository.findByCollectionId(`collection-${status}`)

        // Assert
        expect(result).toBeDefined()
        expect(result!.status).toBe(status)
      }
    } finally {
      closeTestDatabase(db)
    }
  })
})

