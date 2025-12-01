import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { UpdateDigitalDownloadableVariantDownloadSettingsService } from '../../../../../../src/api/app/digitalDownloadableVariant/commands/admin/updateDigitalDownloadableVariantDownloadSettingsService'
import { setupTestEnvironment, createTestProduct, createTestVariant } from './helpers'

describe('UpdateDigitalDownloadableVariantDownloadSettingsService', () => {
  test('should update download settings', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const service = new UpdateDigitalDownloadableVariantDownloadSettingsService(unitOfWork)

      await service.execute({
        type: 'updateDigitalDownloadableVariantDownloadSettings',
        id: variant.id,
        userId: 'user-123',
        maxDownloads: 10,
        accessDurationDays: 60,
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(variant.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.maxDownloads).toBe(10)
      expect(payload.accessDurationDays).toBe(60)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should allow setting download settings to null (unlimited)', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const service = new UpdateDigitalDownloadableVariantDownloadSettingsService(unitOfWork)

      await service.execute({
        type: 'updateDigitalDownloadableVariantDownloadSettings',
        id: variant.id,
        userId: 'user-123',
        maxDownloads: null,
        accessDurationDays: null,
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(variant.id) as any
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
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const service = new UpdateDigitalDownloadableVariantDownloadSettingsService(unitOfWork)

      await expect(service.execute({
        type: 'updateDigitalDownloadableVariantDownloadSettings',
        id: variant.id,
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

  test('should throw if variant not found', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new UpdateDigitalDownloadableVariantDownloadSettingsService(unitOfWork)

      await expect(service.execute({
        type: 'updateDigitalDownloadableVariantDownloadSettings',
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
})
