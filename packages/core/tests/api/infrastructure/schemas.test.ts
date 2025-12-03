import { describe, test, expect } from 'bun:test'
import { randomUUIDv7 } from 'bun'
import { Database } from 'bun:sqlite'
import { schemas } from '../../../src/api/infrastructure/schemas'
import { AttachDigitalDownloadableVariantDigitalAssetCommand } from '../../../src/api/app/digitalDownloadableVariant/commands/admin/commands'

describe('schemas', () => {
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
      expect(tableNames).toContain('pendingSchedulesReadModel')
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
      expect(indexNames).toContain('idx_pendingSchedules_status_dueAt')
      expect(indexNames).toContain('idx_pendingSchedules_aggregateId')
      expect(indexNames).toContain('idx_pendingSchedules_scheduleGroupId')
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

  describe('Zod command schemas', () => {
    describe('AttachDigitalDownloadableVariantDigitalAssetCommand', () => {
      test('should accept valid base64 data URI', () => {
        const validCommand = {
          id: randomUUIDv7(),
          type: 'attachDigitalDownloadableVariantDigitalAsset' as const,
          userId: 'user-123',
          assetData: 'data:application/pdf;base64,SGVsbG8gV29ybGQ=',
          filename: 'test.pdf',
          mimeType: 'application/pdf',
          expectedVersion: 0,
        }

        const result = AttachDigitalDownloadableVariantDigitalAssetCommand.safeParse(validCommand)
        expect(result.success).toBe(true)
      })

      test('should accept plain base64 string', () => {
        const validCommand = {
          id: randomUUIDv7(),
          type: 'attachDigitalDownloadableVariantDigitalAsset' as const,
          userId: 'user-123',
          assetData: 'SGVsbG8gV29ybGQ=',
          filename: 'test.pdf',
          mimeType: 'application/pdf',
          expectedVersion: 0,
        }

        const result = AttachDigitalDownloadableVariantDigitalAssetCommand.safeParse(validCommand)
        expect(result.success).toBe(true)
      })

      test('should reject invalid base64 string', () => {
        const invalidCommand = {
          id: randomUUIDv7(),
          type: 'attachDigitalDownloadableVariantDigitalAsset' as const,
          userId: 'user-123',
          assetData: 'not!valid@base64#string',
          filename: 'test.pdf',
          mimeType: 'application/pdf',
          expectedVersion: 0,
        }

        const result = AttachDigitalDownloadableVariantDigitalAssetCommand.safeParse(invalidCommand)
        expect(result.success).toBe(false)
        if (!result.success && result.error.issues[0]) {
          expect(result.error.issues[0].message).toBe('assetData must be a valid base64 string')
        }
      })
    })
  })
})
