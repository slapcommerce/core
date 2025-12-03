import { describe, test, expect } from 'bun:test'
import { randomUUIDv7 } from 'bun'
import { ScheduleDropshipVariantDropService } from '../../../../../../src/api/app/dropshipVariant/commands/admin/scheduleDropshipVariantDropService'
import type { ScheduleDropshipVariantDropCommand } from '../../../../../../src/api/app/dropshipVariant/commands/admin/commands'
import { setupTestEnvironment, createTestProduct, createTestVariant } from './helpers'
import { closeTestDatabase } from '../../../../../helpers/database'

describe('ScheduleDropshipVariantDropService', () => {
  test('should schedule a hidden drop for a variant', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    const productId = randomUUIDv7()
    const variantId = randomUUIDv7()

    try {
      await createTestProduct(unitOfWork, {
        id: productId,
        correlationId: randomUUIDv7(),
        slug: `test-product-${Date.now()}`
      })

      await createTestVariant(unitOfWork, {
        id: variantId,
        correlationId: randomUUIDv7(),
        productId: productId,
        sku: 'TEST-SKU-001',
        price: 1000,
      })

      const service = new ScheduleDropshipVariantDropService(unitOfWork)
      const command: ScheduleDropshipVariantDropCommand = {
        type: 'scheduleDropshipVariantDrop',
        id: variantId,
        correlationId: randomUUIDv7(),
        userId: 'user-123',
        dropType: 'hidden',
        scheduledFor: new Date(Date.now() + 86400000),
        expectedVersion: 0,
      }

      const result = await service.execute(command)
      expect(result.scheduleId).toBeDefined()
      expect(typeof result.scheduleId).toBe('string')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should schedule a visible drop for a variant', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    const productId = randomUUIDv7()
    const variantId = randomUUIDv7()

    try {
      await createTestProduct(unitOfWork, {
        id: productId,
        correlationId: randomUUIDv7(),
        slug: `test-product-${Date.now()}`
      })

      await createTestVariant(unitOfWork, {
        id: variantId,
        correlationId: randomUUIDv7(),
        productId: productId,
        sku: 'TEST-SKU-002',
        price: 2000,
      })

      const service = new ScheduleDropshipVariantDropService(unitOfWork)
      const command: ScheduleDropshipVariantDropCommand = {
        type: 'scheduleDropshipVariantDrop',
        id: variantId,
        correlationId: randomUUIDv7(),
        userId: 'user-123',
        dropType: 'visible',
        scheduledFor: new Date(Date.now() + 86400000),
        expectedVersion: 0,
      }

      const result = await service.execute(command)
      expect(result.scheduleId).toBeDefined()
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when variant not found', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new ScheduleDropshipVariantDropService(unitOfWork)
      const command: ScheduleDropshipVariantDropCommand = {
        type: 'scheduleDropshipVariantDrop',
        id: randomUUIDv7(),
        correlationId: randomUUIDv7(),
        userId: 'user-123',
        dropType: 'hidden',
        scheduledFor: new Date(Date.now() + 86400000),
        expectedVersion: 0,
      }

      await expect(service.execute(command)).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error on version mismatch', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    const productId = randomUUIDv7()
    const variantId = randomUUIDv7()

    try {
      await createTestProduct(unitOfWork, {
        id: productId,
        correlationId: randomUUIDv7(),
        slug: `test-product-${Date.now()}`
      })

      await createTestVariant(unitOfWork, {
        id: variantId,
        correlationId: randomUUIDv7(),
        productId: productId,
        sku: 'TEST-SKU-003',
        price: 1000,
      })

      const service = new ScheduleDropshipVariantDropService(unitOfWork)
      const command: ScheduleDropshipVariantDropCommand = {
        type: 'scheduleDropshipVariantDrop',
        id: variantId,
        correlationId: randomUUIDv7(),
        userId: 'user-123',
        dropType: 'hidden',
        scheduledFor: new Date(Date.now() + 86400000),
        expectedVersion: 99,
      }

      await expect(service.execute(command)).rejects.toThrow('Optimistic concurrency conflict')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
