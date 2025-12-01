import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { SetDropshipProductDefaultVariantService } from '../../../../../../src/api/app/dropshipProduct/commands/admin/setDropshipProductDefaultVariantService'
import { setupTestEnvironment, createTestProduct } from './helpers'

describe('SetDropshipProductDefaultVariantService', () => {
  test('should throw on version mismatch', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new SetDropshipProductDefaultVariantService(unitOfWork)

      await expect(service.execute({
        type: 'setDropshipProductDefaultVariant',
        productId: product.id,
        variantId: 'variant-123',
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
      const service = new SetDropshipProductDefaultVariantService(unitOfWork)

      await expect(service.execute({
        type: 'setDropshipProductDefaultVariant',
        productId: 'non-existent-id',
        variantId: 'variant-123',
        userId: 'user-123',
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw if variant does not belong to product', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new SetDropshipProductDefaultVariantService(unitOfWork)

      await expect(service.execute({
        type: 'setDropshipProductDefaultVariant',
        productId: product.id,
        variantId: 'non-existent-variant',
        userId: 'user-123',
        expectedVersion: 0,
      })).rejects.toThrow('does not belong to product')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
