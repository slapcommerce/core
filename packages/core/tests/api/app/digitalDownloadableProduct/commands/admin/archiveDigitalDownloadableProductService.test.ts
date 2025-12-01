import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { ArchiveDigitalDownloadableProductService } from '../../../../../../src/api/app/digitalDownloadableProduct/commands/admin/archiveDigitalDownloadableProductService'
import { setupTestEnvironment, createTestProduct } from './helpers'

describe('ArchiveDigitalDownloadableProductService', () => {
  test('should archive product', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new ArchiveDigitalDownloadableProductService(unitOfWork)

      await service.execute({
        type: 'archiveDigitalDownloadableProduct',
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
      const service = new ArchiveDigitalDownloadableProductService(unitOfWork)

      await expect(service.execute({
        type: 'archiveDigitalDownloadableProduct',
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
      const service = new ArchiveDigitalDownloadableProductService(unitOfWork)

      await expect(service.execute({
        type: 'archiveDigitalDownloadableProduct',
        id: 'non-existent-id',
        userId: 'user-123',
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should create archived event', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new ArchiveDigitalDownloadableProductService(unitOfWork)

      await service.execute({
        type: 'archiveDigitalDownloadableProduct',
        id: product.id,
        userId: 'user-123',
        expectedVersion: 0,
      })

      const events = db.query(`SELECT eventType FROM events WHERE aggregateId = ?`).all(product.id) as any[]
      const eventTypes = events.map(e => e.eventType)
      expect(eventTypes).toContain('digital_downloadable_product.archived')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
