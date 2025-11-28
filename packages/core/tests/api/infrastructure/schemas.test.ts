import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { schemas, runMigrations } from '../../../src/api/infrastructure/schemas'

describe('schemas', () => {
  describe('runMigrations', () => {
    test('does not throw on empty database', () => {
      // Arrange - create database without any tables
      const db = new Database(':memory:')

      // Act & Assert - runMigrations should not throw
      expect(() => runMigrations(db)).not.toThrow()

      db.close()
    })

    test('is idempotent - can be called multiple times', () => {
      // Arrange
      const db = new Database(':memory:')

      // Act - should not throw when called multiple times
      runMigrations(db)
      runMigrations(db)
      runMigrations(db)

      // Assert - function completed without throwing
      expect(true).toBe(true)

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
      expect(tableNames).toContain('slugRedirects')
      expect(tableNames).toContain('user')
      expect(tableNames).toContain('session')
      expect(tableNames).toContain('account')
      expect(tableNames).toContain('verification')
      expect(tableNames).toContain('schedulesReadModel')
      expect(tableNames).toContain('variantReadModel')

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
      expect(indexNames).toContain('idx_slugRedirects_newSlug')
      expect(indexNames).toContain('idx_slugRedirects_aggregate')
      expect(indexNames).toContain('idx_schedulesReadModel_status')
      expect(indexNames).toContain('idx_schedulesReadModel_scheduledFor')
      expect(indexNames).toContain('idx_schedulesReadModel_status_scheduledFor')
      expect(indexNames).toContain('idx_schedulesReadModel_targetAggregate')
      expect(indexNames).toContain('idx_variantReadModel_productId')
      expect(indexNames).toContain('idx_variantReadModel_status')
      expect(indexNames).toContain('idx_variantReadModel_sku')

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
