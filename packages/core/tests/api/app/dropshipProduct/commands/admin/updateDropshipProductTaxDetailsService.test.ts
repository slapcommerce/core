import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { UpdateDropshipProductTaxDetailsService } from '../../../../../../src/api/app/dropshipProduct/commands/admin/updateDropshipProductTaxDetailsService'
import { setupTestEnvironment, createTestProduct } from './helpers'

describe('UpdateDropshipProductTaxDetailsService', () => {
  test('should update product tax details', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new UpdateDropshipProductTaxDetailsService(unitOfWork)

      await service.execute({
        type: 'updateDropshipProductTaxDetails',
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
      const service = new UpdateDropshipProductTaxDetailsService(unitOfWork)

      await expect(service.execute({
        type: 'updateDropshipProductTaxDetails',
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
      const service = new UpdateDropshipProductTaxDetailsService(unitOfWork)

      await expect(service.execute({
        type: 'updateDropshipProductTaxDetails',
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
