import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { CreateDropshipVariantService } from '../../../../../../src/api/app/dropshipVariant/commands/admin/createDropshipVariantService'
import { setupTestEnvironment, createValidVariantCommand, createTestProduct } from './helpers'

describe('CreateDropshipVariantService', () => {
  test('should create a dropship variant', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const service = new CreateDropshipVariantService(unitOfWork)
      const command = createValidVariantCommand()

      await service.execute(command)

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(command.id) as any
      expect(snapshot).not.toBeNull()
      const payload = JSON.parse(snapshot.payload)
      expect(payload.productId).toBe('product-123')
      expect(payload.sku).toBe('TEST-SKU-001')
      expect(payload.listPrice).toBe(1999)
      expect(payload.inventory).toBe(10)
      expect(payload.options).toEqual({ Size: 'M' })
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should reserve SKU when creating variant', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const service = new CreateDropshipVariantService(unitOfWork)
      const command = createValidVariantCommand()

      await service.execute(command)

      const skuSnapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get('TEST-SKU-001') as any
      expect(skuSnapshot).not.toBeNull()
      const skuPayload = JSON.parse(skuSnapshot.payload)
      expect(skuPayload.status).toBe('active')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw if product not found', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateDropshipVariantService(unitOfWork)
      const command = createValidVariantCommand({ productId: 'non-existent-product' })

      await expect(service.execute(command)).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw if SKU is already in use', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const service = new CreateDropshipVariantService(unitOfWork)

      await service.execute(createValidVariantCommand({ id: 'variant-1' }))

      await expect(service.execute(createValidVariantCommand({ id: 'variant-2' }))).rejects.toThrow('already in use')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw if variant option is not valid for product', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const service = new CreateDropshipVariantService(unitOfWork)

      await expect(service.execute(createValidVariantCommand({
        id: 'variant-1',
        sku: 'SKU-1',
        options: { InvalidOption: 'Value' }
      }))).rejects.toThrow('not valid for this product')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should update variant positions when creating variant', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new CreateDropshipVariantService(unitOfWork)
      const command = createValidVariantCommand()

      await service.execute(command)

      const productSnapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(product.id) as any
      const productPayload = JSON.parse(productSnapshot.payload)
      const positionsSnapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(productPayload.variantPositionsAggregateId) as any
      const positionsPayload = JSON.parse(positionsSnapshot.payload)
      expect(positionsPayload.variantIds).toContain(command.id)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
