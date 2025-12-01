import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { UpdateDigitalDownloadableProductTaxDetailsService } from '../../../../../../src/api/app/digitalDownloadableProduct/commands/admin/updateDigitalDownloadableProductTaxDetailsService'
import { setupTestEnvironment, createTestProduct } from './helpers'

describe('UpdateDigitalDownloadableProductTaxDetailsService', () => {
  test('should update tax details', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new UpdateDigitalDownloadableProductTaxDetailsService(unitOfWork)

      await service.execute({
        type: 'updateDigitalDownloadableProductTaxDetails',
        id: product.id,
        userId: 'user-123',
        taxable: false,
        taxId: 'NEW-TAX-ID',
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(product.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.taxable).toBe(false)
      expect(payload.taxId).toBe('NEW-TAX-ID')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw on version mismatch', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new UpdateDigitalDownloadableProductTaxDetailsService(unitOfWork)

      await expect(service.execute({
        type: 'updateDigitalDownloadableProductTaxDetails',
        id: product.id,
        userId: 'user-123',
        taxable: false,
        taxId: 'NEW-TAX-ID',
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
      const service = new UpdateDigitalDownloadableProductTaxDetailsService(unitOfWork)

      await expect(service.execute({
        type: 'updateDigitalDownloadableProductTaxDetails',
        id: 'non-existent-id',
        userId: 'user-123',
        taxable: false,
        taxId: 'NEW-TAX-ID',
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
