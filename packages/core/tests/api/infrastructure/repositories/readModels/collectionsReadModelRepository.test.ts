import { describe, test, expect } from 'bun:test'
import { CollectionsReadModelRepository } from '../../../../../src/api/infrastructure/repositories/readModels/collectionsReadModelRepository'
import { TransactionBatch } from '../../../../../src/api/infrastructure/transactionBatch'
import { createTestDatabase, closeTestDatabase } from '../../../../helpers/database'

describe('CollectionsReadModelRepository', () => {
  test('constructor properly initializes with Database and TransactionBatch dependencies', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      // Act
      const repository = new CollectionsReadModelRepository(db, batch)

      // Assert - Repository should be created without errors
      expect(repository).toBeDefined()
      expect(repository).toBeInstanceOf(CollectionsReadModelRepository)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('save creates a prepared SQL statement with correct INSERT OR REPLACE query', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new CollectionsReadModelRepository(db, batch)
      const data = {
        aggregateId: 'collection-123',
        name: 'Test Collection',
        slug: 'test-collection',
        description: 'A test collection',
        status: 'draft' as const,
        correlationId: 'corr-456',
        version: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        metaTitle: 'Test Meta Title',
        metaDescription: 'Test Meta Description',
        publishedAt: null,
        images: '[]',
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
      const repository = new CollectionsReadModelRepository(db, batch)
      const createdAt = new Date('2024-01-01T00:00:00Z')
      const updatedAt = new Date('2024-01-02T00:00:00Z')
      const publishedAt = new Date('2024-01-03T00:00:00Z')
      const data = {
        aggregateId: 'collection-123',
        name: 'Test Collection',
        slug: 'test-collection',
        description: 'A test collection',
        status: 'active' as const,
        correlationId: 'corr-456',
        version: 1,
        createdAt: createdAt,
        updatedAt: updatedAt,
        metaTitle: 'Test Meta Title',
        metaDescription: 'Test Meta Description',
        publishedAt: publishedAt,
        images: JSON.stringify([{
          imageId: 'img-1',
          urls: {
            thumbnail: { original: 'https://example.com/thumb.jpg', webp: null },
            small: { original: 'https://example.com/small.jpg', webp: null },
            medium: { original: 'https://example.com/image.jpg', webp: 'https://example.com/image.webp' },
            large: { original: 'https://example.com/large.jpg', webp: null }
          },
          uploadedAt: '2024-01-01T00:00:00.000Z',
          altText: ''
        }]),
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
        JSON.stringify([{
          imageId: 'img-1',
          urls: {
            thumbnail: { original: 'https://example.com/thumb.jpg', webp: null },
            small: { original: 'https://example.com/small.jpg', webp: null },
            medium: { original: 'https://example.com/image.jpg', webp: 'https://example.com/image.webp' },
            large: { original: 'https://example.com/large.jpg', webp: null }
          },
          uploadedAt: '2024-01-01T00:00:00.000Z',
          altText: ''
        }]),
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
      const repository = new CollectionsReadModelRepository(db, batch)
      const createdAt = new Date('2024-01-01T00:00:00Z')
      const updatedAt = new Date('2024-01-02T00:00:00Z')
      const data = {
        aggregateId: 'collection-123',
        name: 'Test Collection',
        slug: 'test-collection',
        description: null,
        status: 'draft' as const,
        correlationId: 'corr-456',
        version: 0,
        createdAt: createdAt,
        updatedAt: updatedAt,
        metaTitle: 'Test Meta Title',
        metaDescription: 'Test Meta Description',
        publishedAt: null,
        images: null,
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
      const repository = new CollectionsReadModelRepository(db, batch)
      const data = {
        aggregateId: 'collection-123',
        name: 'Test Collection',
        slug: 'test-collection',
        description: 'A test collection',
        status: 'draft' as const,
        correlationId: 'corr-456',
        version: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        metaTitle: 'Test Meta Title',
        metaDescription: 'Test Meta Description',
        publishedAt: null,
        images: '[]',
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
      const repository = new CollectionsReadModelRepository(db, batch)
      const initialCreatedAt = new Date('2024-01-01T00:00:00Z')
      const initialUpdatedAt = new Date('2024-01-02T00:00:00Z')
      const initialData = {
        aggregateId: 'collection-123',
        name: 'Initial Collection',
        slug: 'initial-collection',
        description: 'Initial description',
        status: 'draft' as const,
        correlationId: 'corr-456',
        version: 0,
        createdAt: initialCreatedAt,
        updatedAt: initialUpdatedAt,
        metaTitle: 'Initial Meta Title',
        metaDescription: 'Initial Meta Description',
        publishedAt: null,
        images: '[]',
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
      const updatedRepository = new CollectionsReadModelRepository(db, newBatch)
      const updatedData = {
        aggregateId: 'collection-123',
        name: 'Updated Collection',
        slug: 'updated-collection',
        description: 'Updated description',
        status: 'active' as const,
        correlationId: 'corr-456',
        version: 1,
        createdAt: initialCreatedAt, // Keep original createdAt
        updatedAt: new Date('2024-01-03T00:00:00Z'),
        metaTitle: 'Updated Meta Title',
        metaDescription: 'Updated Meta Description',
        publishedAt: new Date('2024-01-03T00:00:00Z'),
        images: JSON.stringify([{
          imageId: 'img-2',
          urls: {
            thumbnail: { original: 'https://example.com/updated-thumb.jpg', webp: null },
            small: { original: 'https://example.com/updated-small.jpg', webp: null },
            medium: { original: 'https://example.com/updated-image.jpg', webp: 'https://example.com/updated-image.webp' },
            large: { original: 'https://example.com/updated-large.jpg', webp: null }
          },
          uploadedAt: '2024-01-03T00:00:00.000Z',
          altText: 'Updated image'
        }]),
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
      const updatedRecord = db.query('SELECT * FROM collectionsReadModel WHERE aggregateId = ?').get('collection-123') as any
      expect(updatedRecord).toBeDefined()
      expect(updatedRecord.name).toBe('Updated Collection')
      expect(updatedRecord.status).toBe('active')
      expect(updatedRecord.version).toBe(1)
      expect(updatedRecord.createdAt).toBe(initialCreatedAt.toISOString()) // Should preserve original createdAt
      expect(updatedRecord.publishedAt).toBe(new Date('2024-01-03T00:00:00Z').toISOString())
      expect(updatedRecord.images).toBeTruthy()
      const parsedImages = JSON.parse(updatedRecord.images)
      expect(parsedImages).toHaveLength(1)
      expect(parsedImages[0].urls.medium.original).toBe('https://example.com/updated-image.jpg')
    } finally {
      closeTestDatabase(db)
    }
  })

  test('findByCollectionId returns null when collection not found', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new CollectionsReadModelRepository(db, batch)

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
      const repository = new CollectionsReadModelRepository(db, batch)
      const createdAt = new Date('2024-01-01T00:00:00Z')
      const updatedAt = new Date('2024-01-02T00:00:00Z')
      const publishedAt = new Date('2024-01-03T00:00:00Z')

      // Insert test data directly
      db.run(`
        INSERT INTO collectionsReadModel (
          aggregateId, name, slug, description, status, correlationId, version,
          createdAt, updatedAt, metaTitle, metaDescription, publishedAt, images
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
        '[]',
      ])

      // Act
      const result = repository.findByCollectionId('collection-123')

      // Assert
      expect(result).toBeDefined()
      expect(result).toEqual({
        aggregateId: 'collection-123',
        name: 'Test Collection',
        slug: 'test-collection',
        description: 'A test collection',
        status: 'active',
        correlationId: 'corr-456',
        version: 1,
        createdAt: createdAt,
        updatedAt: updatedAt,
        metaTitle: 'Test Meta Title',
        metaDescription: 'Test Meta Description',
        publishedAt: publishedAt,
        images: '[]',
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
      const repository = new CollectionsReadModelRepository(db, batch)
      const createdAt = new Date('2024-01-01T00:00:00Z')
      const updatedAt = new Date('2024-01-02T00:00:00Z')

      // Insert test data with null values
      db.run(`
        INSERT INTO collectionsReadModel (
          aggregateId, name, slug, description, status, correlationId, version,
          createdAt, updatedAt, metaTitle, metaDescription, publishedAt, images
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
      expect(result!.publishedAt).toBeNull()
      expect(result!.images).toBeNull()
      expect(result!.metaTitle).toBe('')
      expect(result!.metaDescription).toBe('')
    } finally {
      closeTestDatabase(db)
    }
  })

  test('findByCollectionId converts date strings to Date objects', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new CollectionsReadModelRepository(db, batch)
      const createdAt = new Date('2024-01-01T00:00:00Z')
      const updatedAt = new Date('2024-01-02T00:00:00Z')
      const publishedAt = new Date('2024-01-03T00:00:00Z')

      // Insert test data
      db.run(`
        INSERT INTO collectionsReadModel (
          aggregateId, name, slug, description, status, correlationId, version,
          createdAt, updatedAt, metaTitle, metaDescription, publishedAt, images
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
        '[]',
      ])

      // Act
      const result = repository.findByCollectionId('collection-123')

      // Assert - Verify dates are Date objects, not strings
      expect(result).toBeDefined()
      expect(result!.createdAt).toBeInstanceOf(Date)
      expect(result!.updatedAt).toBeInstanceOf(Date)
      expect(result!.publishedAt).toBeInstanceOf(Date)
      expect(result!.createdAt.getTime()).toBe(createdAt.getTime())
      expect(result!.updatedAt.getTime()).toBe(updatedAt.getTime())
      expect(result!.publishedAt!.getTime()).toBe(publishedAt.getTime())
    } finally {
      closeTestDatabase(db)
    }
  })

  test('findByCollectionId handles all status types', () => {
    // Arrange
    const db = createTestDatabase()
    const batch = new TransactionBatch()

    try {
      const repository = new CollectionsReadModelRepository(db, batch)
      const createdAt = new Date('2024-01-01T00:00:00Z')
      const updatedAt = new Date('2024-01-02T00:00:00Z')

      const statuses: Array<'draft' | 'active' | 'archived'> = ['draft', 'active', 'archived']

      for (const status of statuses) {
        // Insert test data
        db.run(`
          INSERT INTO collectionsReadModel (
            aggregateId, name, slug, description, status, correlationId, version,
            createdAt, updatedAt, metaTitle, metaDescription, publishedAt, images
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


