import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { UpdateDropshipProductCollectionsService } from '../../../../../../src/api/app/dropshipProduct/commands/admin/updateDropshipProductCollectionsService'
import { setupTestEnvironment, createTestProduct } from './helpers'

describe('UpdateDropshipProductCollectionsService', () => {
  test('should update product collections', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new UpdateDropshipProductCollectionsService(unitOfWork)

      await service.execute({
        type: 'updateDropshipProductCollections',
        id: product.id,
        userId: 'user-123',
        collections: ['collection-2', 'collection-3'],
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(product.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.collections).toEqual(['collection-2', 'collection-3'])
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw on version mismatch', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new UpdateDropshipProductCollectionsService(unitOfWork)

      await expect(service.execute({
        type: 'updateDropshipProductCollections',
        id: product.id,
        userId: 'user-123',
        collections: ['collection-2'],
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
      const service = new UpdateDropshipProductCollectionsService(unitOfWork)

      await expect(service.execute({
        type: 'updateDropshipProductCollections',
        id: 'non-existent-id',
        userId: 'user-123',
        collections: ['collection-2'],
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
