import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { CreateDigitalDownloadableVariantService } from '../../../../../../src/api/app/digitalDownloadableVariant/commands/admin/createDigitalDownloadableVariantService'
import { setupTestEnvironment, createTestProduct, createValidVariantCommand } from './helpers'

describe('CreateDigitalDownloadableVariantService', () => {
  test('should create a digital downloadable variant', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const service = new CreateDigitalDownloadableVariantService(unitOfWork)
      const command = createValidVariantCommand()

      await service.execute(command)

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(command.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.productId).toBe('product-123')
      expect(payload.sku).toBe('TEST-SKU-001')
      expect(payload.price).toBe(1999)
      expect(payload.options).toEqual({ Size: 'M' })
      expect(payload.variantType).toBe('digital_downloadable')
      expect(payload.maxDownloads).toBe(5)
      expect(payload.accessDurationDays).toBe(30)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should reserve SKU when creating variant', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const service = new CreateDigitalDownloadableVariantService(unitOfWork)
      const command = createValidVariantCommand({ sku: 'UNIQUE-SKU' })

      await service.execute(command)

      const skuSnapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get('UNIQUE-SKU') as any
      const skuPayload = JSON.parse(skuSnapshot.payload)
      expect(skuPayload.variantId).toBe(command.id)
      expect(skuPayload.status).toBe('active')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw if product not found', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateDigitalDownloadableVariantService(unitOfWork)
      const command = createValidVariantCommand({ productId: 'non-existent' })

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
      const service = new CreateDigitalDownloadableVariantService(unitOfWork)

      // Create first variant with SKU
      await service.execute(createValidVariantCommand({ id: 'variant-1', sku: 'SAME-SKU' }))

      // Try to create second variant with same SKU
      await expect(
        service.execute(createValidVariantCommand({ id: 'variant-2', sku: 'SAME-SKU', options: { Size: 'L' } }))
      ).rejects.toThrow('already in use')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw if option value is invalid for product', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const service = new CreateDigitalDownloadableVariantService(unitOfWork)
      const command = createValidVariantCommand({ options: { Size: 'XL' } }) // XL not in product options

      await expect(service.execute(command)).rejects.toThrow('not valid for option')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should add variant to product positions', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new CreateDigitalDownloadableVariantService(unitOfWork)
      const command = createValidVariantCommand()

      await service.execute(command)

      // Get variant positions aggregate ID from product
      const productSnapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(product.id) as any
      const productPayload = JSON.parse(productSnapshot.payload)
      const positionsAggregateId = productPayload.variantPositionsAggregateId

      const positionsSnapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(positionsAggregateId) as any
      const positionsPayload = JSON.parse(positionsSnapshot.payload)
      expect(positionsPayload.variantIds).toContain(command.id)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
