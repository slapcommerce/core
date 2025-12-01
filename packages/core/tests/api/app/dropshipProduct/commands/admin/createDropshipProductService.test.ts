import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { CreateDropshipProductService } from '../../../../../../src/api/app/dropshipProduct/commands/admin/createDropshipProductService'
import { setupTestEnvironment, createValidProductCommand } from './helpers'

describe('CreateDropshipProductService', () => {
  test('should create a dropship product', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateDropshipProductService(unitOfWork)
      const command = createValidProductCommand()

      await service.execute(command)

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(command.id) as any
      expect(snapshot).not.toBeNull()
      const payload = JSON.parse(snapshot.payload)
      expect(payload.name).toBe('Test Dropship Product')
      expect(payload.productType).toBe('dropship')
      expect(payload.dropshipSafetyBuffer).toBe(5)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should reserve slug', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateDropshipProductService(unitOfWork)
      const command = createValidProductCommand()

      await service.execute(command)

      const slugSnapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(command.slug) as any
      expect(slugSnapshot).not.toBeNull()
      const slugPayload = JSON.parse(slugSnapshot.payload)
      expect(slugPayload.entityId).toBe(command.id)
      expect(slugPayload.entityType).toBe('dropship_product')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw if slug already in use', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateDropshipProductService(unitOfWork)
      const command1 = createValidProductCommand({ id: 'product-1' })
      const command2 = createValidProductCommand({ id: 'product-2' })

      await service.execute(command1)

      await expect(service.execute(command2)).rejects.toThrow('Slug "test-dropship-product" is already in use')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should create variant positions aggregate', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new CreateDropshipProductService(unitOfWork)
      const command = createValidProductCommand()

      await service.execute(command)

      const productSnapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(command.id) as any
      const productPayload = JSON.parse(productSnapshot.payload)
      const variantPositionsAggregateId = productPayload.variantPositionsAggregateId

      const positionsSnapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(variantPositionsAggregateId) as any
      expect(positionsSnapshot).not.toBeNull()
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
