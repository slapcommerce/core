import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { ChangeDropshipProductSlugService } from '../../../../../../src/api/app/dropshipProduct/commands/admin/changeDropshipProductSlugService'
import { setupTestEnvironment, createTestProduct } from './helpers'

describe('ChangeDropshipProductSlugService', () => {
  test('should change product slug', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new ChangeDropshipProductSlugService(unitOfWork)

      await service.execute({
        type: 'changeDropshipProductSlug',
        id: product.id,
        userId: 'user-123',
        newSlug: 'new-slug',
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(product.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.slug).toBe('new-slug')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should release old slug and reserve new slug', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new ChangeDropshipProductSlugService(unitOfWork)

      await service.execute({
        type: 'changeDropshipProductSlug',
        id: product.id,
        userId: 'user-123',
        newSlug: 'new-slug',
        expectedVersion: 0,
      })

      // New slug should be reserved
      const newSlugSnapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get('new-slug') as any
      const newSlugPayload = JSON.parse(newSlugSnapshot.payload)
      expect(newSlugPayload.entityId).toBe(product.id)

      // Old slug should be released
      const oldSlugSnapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(product.slug) as any
      const oldSlugPayload = JSON.parse(oldSlugSnapshot.payload)
      expect(oldSlugPayload.entityId).toBeNull()
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw on version mismatch', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new ChangeDropshipProductSlugService(unitOfWork)

      await expect(service.execute({
        type: 'changeDropshipProductSlug',
        id: product.id,
        userId: 'user-123',
        newSlug: 'new-slug',
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
      const service = new ChangeDropshipProductSlugService(unitOfWork)

      await expect(service.execute({
        type: 'changeDropshipProductSlug',
        id: 'non-existent-id',
        userId: 'user-123',
        newSlug: 'new-slug',
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
