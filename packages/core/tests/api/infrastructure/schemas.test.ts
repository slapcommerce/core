import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { schemas, runMigrations } from '../../../src/api/infrastructure/schemas'

describe('schemas', () => {
  describe('runMigrations', () => {
    test('throws error when table does not exist', () => {
      // Arrange - create database without the variantDetailsReadModel table
      const db = new Database(':memory:')

      // Act & Assert - runMigrations should throw when table doesn't exist
      expect(() => runMigrations(db)).toThrow()

      db.close()
    })

    test('adds digitalAsset column when it does not exist', () => {
      // Arrange - create database without digitalAsset column
      const db = new Database(':memory:')

      // Create variantDetailsReadModel without digitalAsset column
      db.run(`CREATE TABLE IF NOT EXISTS variantDetailsReadModel (
        aggregateId TEXT PRIMARY KEY,
        productId TEXT NOT NULL,
        sku TEXT NOT NULL,
        price REAL NOT NULL,
        inventory INTEGER NOT NULL,
        options TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        correlationId TEXT NOT NULL,
        version INTEGER NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        images TEXT
      )`)

      // Verify column doesn't exist before migration
      const tableInfoBefore = db.query("PRAGMA table_info(variantDetailsReadModel)").all() as Array<{
        cid: number
        name: string
        type: string
        notnull: number
        dflt_value: string | null
        pk: number
      }>
      const hasColumnBefore = tableInfoBefore.some(col => col.name === 'digitalAsset')
      expect(hasColumnBefore).toBe(false)

      // Act
      runMigrations(db)

      // Assert
      const tableInfoAfter = db.query("PRAGMA table_info(variantDetailsReadModel)").all() as Array<{
        cid: number
        name: string
        type: string
        notnull: number
        dflt_value: string | null
        pk: number
      }>
      const hasColumnAfter = tableInfoAfter.some(col => col.name === 'digitalAsset')
      expect(hasColumnAfter).toBe(true)

      db.close()
    })

    test('is idempotent - does not fail when column already exists', () => {
      // Arrange - create database with digitalAsset column already present
      const db = new Database(':memory:')

      // Create variantDetailsReadModel with digitalAsset column
      db.run(`CREATE TABLE IF NOT EXISTS variantDetailsReadModel (
        aggregateId TEXT PRIMARY KEY,
        productId TEXT NOT NULL,
        sku TEXT NOT NULL,
        price REAL NOT NULL,
        inventory INTEGER NOT NULL,
        options TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        correlationId TEXT NOT NULL,
        version INTEGER NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        images TEXT,
        digitalAsset TEXT
      )`)

      // Act - should not throw
      runMigrations(db)

      // Assert - column should still exist
      const tableInfo = db.query("PRAGMA table_info(variantDetailsReadModel)").all() as Array<{
        cid: number
        name: string
        type: string
        notnull: number
        dflt_value: string | null
        pk: number
      }>
      const hasColumn = tableInfo.some(col => col.name === 'digitalAsset')
      expect(hasColumn).toBe(true)

      db.close()
    })

    test('preserves existing data when adding column', () => {
      // Arrange - create database with existing data
      const db = new Database(':memory:')

      db.run(`CREATE TABLE IF NOT EXISTS variantDetailsReadModel (
        aggregateId TEXT PRIMARY KEY,
        productId TEXT NOT NULL,
        sku TEXT NOT NULL,
        price REAL NOT NULL,
        inventory INTEGER NOT NULL,
        options TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        correlationId TEXT NOT NULL,
        version INTEGER NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        images TEXT
      )`)

      // Insert test data
      db.run(`INSERT INTO variantDetailsReadModel (
        aggregateId, productId, sku, price, inventory, options, status, correlationId, version, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        'variant-123',
        'product-456',
        'SKU-001',
        99.99,
        10,
        '[]',
        'active',
        'corr-789',
        1,
        '2024-01-01T00:00:00.000Z',
        '2024-01-01T00:00:00.000Z'
      ])

      // Act
      runMigrations(db)

      // Assert - data should be preserved
      const row = db.query("SELECT * FROM variantDetailsReadModel WHERE aggregateId = ?").get('variant-123') as {
        aggregateId: string
        productId: string
        sku: string
        price: number
        digitalAsset: string | null
      }
      expect(row.aggregateId).toBe('variant-123')
      expect(row.productId).toBe('product-456')
      expect(row.sku).toBe('SKU-001')
      expect(row.price).toBe(99.99)
      expect(row.digitalAsset).toBeNull() // New column should be null for existing rows

      db.close()
    })
  })

  describe('schemas array', () => {
    test('creates all required tables', () => {
      // Arrange
      const db = new Database(':memory:')

      // Act - execute all schema statements
      for (const schema of schemas) {
        db.run(schema)
      }

      // Assert - verify key tables exist
      const tables = db.query("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>
      const tableNames = tables.map(t => t.name)

      expect(tableNames).toContain('events')
      expect(tableNames).toContain('snapshots')
      expect(tableNames).toContain('outbox')
      expect(tableNames).toContain('outboxProcessing')
      expect(tableNames).toContain('outboxDlq')
      expect(tableNames).toContain('productReadModel')
      expect(tableNames).toContain('collectionsReadModel')
      expect(tableNames).toContain('productCollections')
      expect(tableNames).toContain('slugRedirects')
      expect(tableNames).toContain('productVariants')
      expect(tableNames).toContain('variantDetailsReadModel')
      expect(tableNames).toContain('user')
      expect(tableNames).toContain('session')
      expect(tableNames).toContain('account')
      expect(tableNames).toContain('verification')
      expect(tableNames).toContain('schedulesReadModel')

      db.close()
    })

    test('creates required indexes', () => {
      // Arrange
      const db = new Database(':memory:')

      // Act - execute all schema statements
      for (const schema of schemas) {
        db.run(schema)
      }

      // Assert - verify key indexes exist
      const indexes = db.query("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'").all() as Array<{ name: string }>
      const indexNames = indexes.map(i => i.name)

      expect(indexNames).toContain('idx_productReadModel_status')
      expect(indexNames).toContain('idx_collectionsReadModel_status')
      expect(indexNames).toContain('idx_productCollections_collectionId')
      expect(indexNames).toContain('idx_slugRedirects_newSlug')
      expect(indexNames).toContain('idx_slugRedirects_aggregate')
      expect(indexNames).toContain('idx_productVariants_variantId')
      expect(indexNames).toContain('idx_variantDetailsReadModel_productId')
      expect(indexNames).toContain('idx_variantDetailsReadModel_status')
      expect(indexNames).toContain('idx_variantDetailsReadModel_sku')
      expect(indexNames).toContain('idx_schedulesReadModel_status')
      expect(indexNames).toContain('idx_schedulesReadModel_scheduledFor')
      expect(indexNames).toContain('idx_schedulesReadModel_status_scheduledFor')
      expect(indexNames).toContain('idx_schedulesReadModel_targetAggregate')

      db.close()
    })

    test('is idempotent - can run multiple times without error', () => {
      // Arrange
      const db = new Database(':memory:')

      // Act - execute all schema statements twice
      for (const schema of schemas) {
        db.run(schema)
      }
      for (const schema of schemas) {
        db.run(schema)
      }

      // Assert - database should still be functional
      const tables = db.query("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>
      expect(tables.length).toBeGreaterThan(0)

      db.close()
    })
  })
})
