import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { PublishDigitalDownloadableProductService } from '../../../../../../src/api/app/digitalDownloadableProduct/commands/admin/publishDigitalDownloadableProductService'
import { setupTestEnvironment, createTestProduct } from './helpers'

describe('PublishDigitalDownloadableProductService', () => {
  test('should publish product', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new PublishDigitalDownloadableProductService(unitOfWork)

      await service.execute({
        type: 'publishDigitalDownloadableProduct',
        id: product.id,
        userId: 'user-123',
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(product.id) as any
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
      const product = await createTestProduct(unitOfWork)
      const service = new PublishDigitalDownloadableProductService(unitOfWork)

      await expect(service.execute({
        type: 'publishDigitalDownloadableProduct',
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
      const service = new PublishDigitalDownloadableProductService(unitOfWork)

      await expect(service.execute({
        type: 'publishDigitalDownloadableProduct',
        id: 'non-existent-id',
        userId: 'user-123',
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should create published event', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new PublishDigitalDownloadableProductService(unitOfWork)

      await service.execute({
        type: 'publishDigitalDownloadableProduct',
        id: product.id,
        userId: 'user-123',
        expectedVersion: 0,
      })

      const events = db.query(`SELECT eventType FROM events WHERE aggregateId = ?`).all(product.id) as any[]
      const eventTypes = events.map(e => e.eventType)
      expect(eventTypes).toContain('digital_downloadable_product.published')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
