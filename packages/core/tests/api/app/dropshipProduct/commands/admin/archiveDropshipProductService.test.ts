import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { ArchiveDropshipProductService } from '../../../../../../src/api/app/dropshipProduct/commands/admin/archiveDropshipProductService'
import { setupTestEnvironment, createTestProduct } from './helpers'

describe('ArchiveDropshipProductService', () => {
  test('should archive a dropship product', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new ArchiveDropshipProductService(unitOfWork)

      await service.execute({
        type: 'archiveDropshipProduct',
        id: product.id,
        userId: 'user-123',
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(product.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.status).toBe('archived')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw on version mismatch', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new ArchiveDropshipProductService(unitOfWork)

      await expect(service.execute({
        type: 'archiveDropshipProduct',
        id: product.id,
        userId: 'user-123',
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
      const service = new ArchiveDropshipProductService(unitOfWork)

      await expect(service.execute({
        type: 'archiveDropshipProduct',
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
