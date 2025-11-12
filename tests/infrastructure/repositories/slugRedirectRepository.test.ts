import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { SlugRedirectRepository } from '../../../src/infrastructure/repositories/slugRedirectRepository'
import { TransactionBatch } from '../../../src/infrastructure/transactionBatch'

describe('SlugRedirectRepository', () => {
  let db: Database
  let batch: TransactionBatch

  beforeEach(() => {
    db = new Database(':memory:')
    db.run(`
      CREATE TABLE slug_redirects (
        old_slug TEXT PRIMARY KEY,
        new_slug TEXT NOT NULL,
        product_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `)
    batch = new TransactionBatch()
  })

  afterEach(() => {
    db.close()
  })

  test('constructor properly initializes with Database and TransactionBatch dependencies', () => {
    // Act
    const repository = new SlugRedirectRepository(db, batch)

    // Assert - Repository should be created without errors
    expect(repository).toBeDefined()
    expect(repository).toBeInstanceOf(SlugRedirectRepository)
  })

  test('save creates a prepared SQL statement with correct INSERT OR REPLACE query', () => {
    // Arrange
    const repository = new SlugRedirectRepository(db, batch)
    const data = {
      old_slug: 'old-slug',
      new_slug: 'new-slug',
      product_id: 'product-123',
      created_at: new Date(),
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
    const repository = new SlugRedirectRepository(db, batch)
    const createdAt = new Date(1234567890)
    const data = {
      old_slug: 'old-slug',
      new_slug: 'new-slug',
      product_id: 'product-123',
      created_at: createdAt,
    }

    // Act
    repository.save(data)

    // Assert
    expect(batch.commands.length).toBe(1)
    const command = batch.commands[0]!
    expect(command.params).toEqual([
      'old-slug',
      'new-slug',
      'product-123',
      createdAt.toISOString(),
    ])
  })

  test('save sets command type to insert', () => {
    // Arrange
    const repository = new SlugRedirectRepository(db, batch)
    const data = {
      old_slug: 'old-slug',
      new_slug: 'new-slug',
      product_id: 'product-123',
      created_at: new Date(),
    }

    // Act
    repository.save(data)

    // Assert
    expect(batch.commands[0]!.type).toBe('insert')
  })

  test('save can upsert existing records', async () => {
    // Arrange
    const repository = new SlugRedirectRepository(db, batch)
    const initialCreatedAt = new Date(1000)
    const initialData = {
      old_slug: 'old-slug',
      new_slug: 'initial-new-slug',
      product_id: 'product-123',
      created_at: initialCreatedAt,
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
    const updatedRepository = new SlugRedirectRepository(db, newBatch)
    const updatedData = {
      old_slug: 'old-slug',
      new_slug: 'updated-new-slug',
      product_id: 'product-456',
      created_at: initialCreatedAt, // Keep original created_at
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
    const updatedRecord = db.query('SELECT * FROM slug_redirects WHERE old_slug = ?').get('old-slug') as any
    expect(updatedRecord).toBeDefined()
    expect(updatedRecord.new_slug).toBe('updated-new-slug')
    expect(updatedRecord.product_id).toBe('product-456')
    expect(updatedRecord.created_at).toBe(initialCreatedAt.toISOString()) // Should preserve original created_at
  })

  test('findByOldSlug returns null when no redirect found', () => {
    // Arrange
    const repository = new SlugRedirectRepository(db, batch)

    // Act
    const result = repository.findByOldSlug('non-existent-slug')

    // Assert
    expect(result).toBeNull()
  })

  test('findByOldSlug returns SlugRedirectData when found', () => {
    // Arrange
    const repository = new SlugRedirectRepository(db, batch)
    const createdAt = new Date(1234567890)
    
    db.run(`
      INSERT INTO slug_redirects (old_slug, new_slug, product_id, created_at)
      VALUES (?, ?, ?, ?)
    `, [
      'old-slug',
      'new-slug',
      'product-123',
      createdAt.toISOString(),
    ])

    // Act
    const result = repository.findByOldSlug('old-slug')

    // Assert
    expect(result).not.toBeNull()
    expect(result!.old_slug).toBe('old-slug')
    expect(result!.new_slug).toBe('new-slug')
    expect(result!.product_id).toBe('product-123')
    expect(result!.created_at).toEqual(createdAt)
  })

  test('findByOldSlug correctly parses date from ISO string', () => {
    // Arrange
    const repository = new SlugRedirectRepository(db, batch)
    const createdAt = new Date('2023-01-15T10:30:00.000Z')
    
    db.run(`
      INSERT INTO slug_redirects (old_slug, new_slug, product_id, created_at)
      VALUES (?, ?, ?, ?)
    `, [
      'old-slug',
      'new-slug',
      'product-123',
      createdAt.toISOString(),
    ])

    // Act
    const result = repository.findByOldSlug('old-slug')

    // Assert
    expect(result).not.toBeNull()
    expect(result!.created_at).toBeInstanceOf(Date)
    expect(result!.created_at.getTime()).toBe(createdAt.getTime())
  })

  test('findByNewSlug returns empty array when no redirects found', () => {
    // Arrange
    const repository = new SlugRedirectRepository(db, batch)

    // Act
    const result = repository.findByNewSlug('non-existent-slug')

    // Assert
    expect(result).toEqual([])
  })

  test('findByNewSlug returns array of SlugRedirectData when found', () => {
    // Arrange
    const repository = new SlugRedirectRepository(db, batch)
    const createdAt1 = new Date(1000)
    const createdAt2 = new Date(2000)
    
    db.run(`
      INSERT INTO slug_redirects (old_slug, new_slug, product_id, created_at)
      VALUES (?, ?, ?, ?)
    `, [
      'old-slug-1',
      'new-slug',
      'product-123',
      createdAt1.toISOString(),
    ])

    db.run(`
      INSERT INTO slug_redirects (old_slug, new_slug, product_id, created_at)
      VALUES (?, ?, ?, ?)
    `, [
      'old-slug-2',
      'new-slug',
      'product-456',
      createdAt2.toISOString(),
    ])

    // Act
    const result = repository.findByNewSlug('new-slug')

    // Assert
    expect(result.length).toBe(2)
    expect(result[0]!.old_slug).toBe('old-slug-1')
    expect(result[0]!.new_slug).toBe('new-slug')
    expect(result[0]!.product_id).toBe('product-123')
    expect(result[0]!.created_at).toEqual(createdAt1)
    expect(result[1]!.old_slug).toBe('old-slug-2')
    expect(result[1]!.new_slug).toBe('new-slug')
    expect(result[1]!.product_id).toBe('product-456')
    expect(result[1]!.created_at).toEqual(createdAt2)
  })

  test('findByNewSlug correctly parses dates from ISO strings', () => {
    // Arrange
    const repository = new SlugRedirectRepository(db, batch)
    const createdAt = new Date('2023-01-15T10:30:00.000Z')
    
    db.run(`
      INSERT INTO slug_redirects (old_slug, new_slug, product_id, created_at)
      VALUES (?, ?, ?, ?)
    `, [
      'old-slug',
      'new-slug',
      'product-123',
      createdAt.toISOString(),
    ])

    // Act
    const result = repository.findByNewSlug('new-slug')

    // Assert
    expect(result.length).toBe(1)
    expect(result[0]!.created_at).toBeInstanceOf(Date)
    expect(result[0]!.created_at.getTime()).toBe(createdAt.getTime())
  })

  test('getAll returns empty array when no redirects exist', () => {
    // Arrange
    const repository = new SlugRedirectRepository(db, batch)

    // Act
    const result = repository.getAll()

    // Assert
    expect(result).toEqual([])
  })

  test('getAll returns all SlugRedirectData records', () => {
    // Arrange
    const repository = new SlugRedirectRepository(db, batch)
    const createdAt1 = new Date(1000)
    const createdAt2 = new Date(2000)
    const createdAt3 = new Date(3000)
    
    db.run(`
      INSERT INTO slug_redirects (old_slug, new_slug, product_id, created_at)
      VALUES (?, ?, ?, ?)
    `, [
      'old-slug-1',
      'new-slug-1',
      'product-123',
      createdAt1.toISOString(),
    ])

    db.run(`
      INSERT INTO slug_redirects (old_slug, new_slug, product_id, created_at)
      VALUES (?, ?, ?, ?)
    `, [
      'old-slug-2',
      'new-slug-2',
      'product-456',
      createdAt2.toISOString(),
    ])

    db.run(`
      INSERT INTO slug_redirects (old_slug, new_slug, product_id, created_at)
      VALUES (?, ?, ?, ?)
    `, [
      'old-slug-3',
      'new-slug-3',
      'product-789',
      createdAt3.toISOString(),
    ])

    // Act
    const result = repository.getAll()

    // Assert
    expect(result.length).toBe(3)
    expect(result[0]!.old_slug).toBe('old-slug-1')
    expect(result[1]!.old_slug).toBe('old-slug-2')
    expect(result[2]!.old_slug).toBe('old-slug-3')
  })

  test('getAll correctly parses dates from ISO strings', () => {
    // Arrange
    const repository = new SlugRedirectRepository(db, batch)
    const createdAt = new Date('2023-01-15T10:30:00.000Z')
    
    db.run(`
      INSERT INTO slug_redirects (old_slug, new_slug, product_id, created_at)
      VALUES (?, ?, ?, ?)
    `, [
      'old-slug',
      'new-slug',
      'product-123',
      createdAt.toISOString(),
    ])

    // Act
    const result = repository.getAll()

    // Assert
    expect(result.length).toBe(1)
    expect(result[0]!.created_at).toBeInstanceOf(Date)
    expect(result[0]!.created_at.getTime()).toBe(createdAt.getTime())
  })
})

