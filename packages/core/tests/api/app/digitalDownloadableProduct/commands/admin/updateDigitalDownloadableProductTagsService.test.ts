import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { UpdateDigitalDownloadableProductTagsService } from '../../../../../../src/api/app/digitalDownloadableProduct/commands/admin/updateDigitalDownloadableProductTagsService'
import { setupTestEnvironment, createTestProduct } from './helpers'

describe('UpdateDigitalDownloadableProductTagsService', () => {
  test('should update product tags', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new UpdateDigitalDownloadableProductTagsService(unitOfWork)

      await service.execute({
        type: 'updateDigitalDownloadableProductTags',
        id: product.id,
        userId: 'user-123',
        tags: ['new-tag-1', 'new-tag-2'],
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(product.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.tags).toEqual(['new-tag-1', 'new-tag-2'])
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw on version mismatch', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new UpdateDigitalDownloadableProductTagsService(unitOfWork)

      await expect(service.execute({
        type: 'updateDigitalDownloadableProductTags',
        id: product.id,
        userId: 'user-123',
        tags: ['new-tag'],
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
      const service = new UpdateDigitalDownloadableProductTagsService(unitOfWork)

      await expect(service.execute({
        type: 'updateDigitalDownloadableProductTags',
        id: 'non-existent-id',
        userId: 'user-123',
        tags: ['new-tag'],
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
