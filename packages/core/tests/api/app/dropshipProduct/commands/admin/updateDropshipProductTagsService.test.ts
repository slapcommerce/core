import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { UpdateDropshipProductTagsService } from '../../../../../../src/api/app/dropshipProduct/commands/admin/updateDropshipProductTagsService'
import { setupTestEnvironment, createTestProduct } from './helpers'

describe('UpdateDropshipProductTagsService', () => {
  test('should update product tags', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new UpdateDropshipProductTagsService(unitOfWork)

      await service.execute({
        type: 'updateDropshipProductTags',
        id: product.id,
        userId: 'user-123',
        tags: ['new-tag1', 'new-tag2', 'new-tag3'],
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(product.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.tags).toEqual(['new-tag1', 'new-tag2', 'new-tag3'])
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw on version mismatch', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new UpdateDropshipProductTagsService(unitOfWork)

      await expect(service.execute({
        type: 'updateDropshipProductTags',
        id: product.id,
        userId: 'user-123',
        tags: ['new-tag1'],
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
      const service = new UpdateDropshipProductTagsService(unitOfWork)

      await expect(service.execute({
        type: 'updateDropshipProductTags',
        id: 'non-existent-id',
        userId: 'user-123',
        tags: ['new-tag1'],
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
