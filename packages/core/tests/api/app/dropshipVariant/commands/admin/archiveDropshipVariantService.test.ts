import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { ArchiveDropshipVariantService } from '../../../../../../src/api/app/dropshipVariant/commands/admin/archiveDropshipVariantService'
import { setupTestEnvironment, createTestProduct, createTestVariant } from './helpers'

describe('ArchiveDropshipVariantService', () => {
  test('should archive a dropship variant', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const service = new ArchiveDropshipVariantService(unitOfWork)

      await service.execute({
        type: 'archiveDropshipVariant',
        id: variant.id,
        userId: 'user-123',
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(variant.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.status).toBe('archived')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should release SKU when archiving variant', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const service = new ArchiveDropshipVariantService(unitOfWork)

      await service.execute({
        type: 'archiveDropshipVariant',
        id: variant.id,
        userId: 'user-123',
        expectedVersion: 0,
      })

      const skuSnapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(variant.sku) as any
      const skuPayload = JSON.parse(skuSnapshot.payload)
      expect(skuPayload.status).toBe('released')
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
      const service = new ArchiveDropshipVariantService(unitOfWork)

      await expect(service.execute({
        type: 'archiveDropshipVariant',
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
      const service = new ArchiveDropshipVariantService(unitOfWork)

      await expect(service.execute({
        type: 'archiveDropshipVariant',
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
