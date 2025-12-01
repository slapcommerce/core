import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { PublishDigitalDownloadableVariantService } from '../../../../../../src/api/app/digitalDownloadableVariant/commands/admin/publishDigitalDownloadableVariantService'
import { setupTestEnvironment, createTestProduct, createTestVariant } from './helpers'

describe('PublishDigitalDownloadableVariantService', () => {
  test('should publish a variant', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const service = new PublishDigitalDownloadableVariantService(unitOfWork)

      await service.execute({
        type: 'publishDigitalDownloadableVariant',
        id: variant.id,
        userId: 'user-123',
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(variant.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.status).toBe('active')
      expect(payload.publishedAt).not.toBeNull()
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
      const service = new PublishDigitalDownloadableVariantService(unitOfWork)

      await expect(service.execute({
        type: 'publishDigitalDownloadableVariant',
        id: variant.id,
        userId: 'user-123',
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
      const service = new PublishDigitalDownloadableVariantService(unitOfWork)

      await expect(service.execute({
        type: 'publishDigitalDownloadableVariant',
        id: 'non-existent-id',
        userId: 'user-123',
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
