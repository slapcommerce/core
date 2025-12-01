import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { UpdateDigitalDownloadableProductDownloadSettingsService } from '../../../../../../src/api/app/digitalDownloadableProduct/commands/admin/updateDigitalDownloadableProductDownloadSettingsService'
import { setupTestEnvironment, createTestProduct } from './helpers'

describe('UpdateDigitalDownloadableProductDownloadSettingsService', () => {
  test('should update download settings', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new UpdateDigitalDownloadableProductDownloadSettingsService(unitOfWork)

      await service.execute({
        type: 'updateDigitalDownloadableProductDownloadSettings',
        id: product.id,
        userId: 'user-123',
        maxDownloads: 10,
        accessDurationDays: 60,
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(product.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.maxDownloads).toBe(10)
      expect(payload.accessDurationDays).toBe(60)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should allow setting download settings to null', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new UpdateDigitalDownloadableProductDownloadSettingsService(unitOfWork)

      await service.execute({
        type: 'updateDigitalDownloadableProductDownloadSettings',
        id: product.id,
        userId: 'user-123',
        maxDownloads: null,
        accessDurationDays: null,
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(product.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.maxDownloads).toBeNull()
      expect(payload.accessDurationDays).toBeNull()
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw on version mismatch', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new UpdateDigitalDownloadableProductDownloadSettingsService(unitOfWork)

      await expect(service.execute({
        type: 'updateDigitalDownloadableProductDownloadSettings',
        id: product.id,
        userId: 'user-123',
        maxDownloads: 10,
        accessDurationDays: 60,
        expectedVersion: 99,
      })).rejects.toThrow('Optimistic concurrency conflict')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw if product not found', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new UpdateDigitalDownloadableProductDownloadSettingsService(unitOfWork)

      await expect(service.execute({
        type: 'updateDigitalDownloadableProductDownloadSettings',
        id: 'non-existent-id',
        userId: 'user-123',
        maxDownloads: 10,
        accessDurationDays: 60,
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should create download settings updated event', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new UpdateDigitalDownloadableProductDownloadSettingsService(unitOfWork)

      await service.execute({
        type: 'updateDigitalDownloadableProductDownloadSettings',
        id: product.id,
        userId: 'user-123',
        maxDownloads: 10,
        accessDurationDays: 60,
        expectedVersion: 0,
      })

      const events = db.query(`SELECT eventType FROM events WHERE aggregateId = ?`).all(product.id) as any[]
      const eventTypes = events.map(e => e.eventType)
      expect(eventTypes).toContain('digital_downloadable_product.download_settings_updated')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
