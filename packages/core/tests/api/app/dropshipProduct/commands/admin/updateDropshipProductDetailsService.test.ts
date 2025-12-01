import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { UpdateDropshipProductDetailsService } from '../../../../../../src/api/app/dropshipProduct/commands/admin/updateDropshipProductDetailsService'
import { setupTestEnvironment, createTestProduct } from './helpers'

describe('UpdateDropshipProductDetailsService', () => {
  test('should update product details', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new UpdateDropshipProductDetailsService(unitOfWork)

      await service.execute({
        type: 'updateDropshipProductDetails',
        id: product.id,
        userId: 'user-123',
        name: 'Updated Name',
        description: 'Updated description',
        richDescriptionUrl: 'https://example.com/updated',
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(product.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.name).toBe('Updated Name')
      expect(payload.description).toBe('Updated description')
      expect(payload.richDescriptionUrl).toBe('https://example.com/updated')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw on version mismatch', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new UpdateDropshipProductDetailsService(unitOfWork)

      await expect(service.execute({
        type: 'updateDropshipProductDetails',
        id: product.id,
        userId: 'user-123',
        name: 'Updated Name',
        description: 'Updated description',
        richDescriptionUrl: 'https://example.com/updated',
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
      const service = new UpdateDropshipProductDetailsService(unitOfWork)

      await expect(service.execute({
        type: 'updateDropshipProductDetails',
        id: 'non-existent-id',
        userId: 'user-123',
        name: 'Updated Name',
        description: 'Updated description',
        richDescriptionUrl: 'https://example.com/updated',
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
