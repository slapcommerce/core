import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDatabase, closeTestDatabase } from '../../helpers/database'
import { TransactionBatcher } from '../../../../src/api/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../../src/api/infrastructure/unitOfWork'
import { PublishVariantService } from '../../../../src/api/app/variant/publishVariantService'
import { VariantAggregate } from '../../../../src/api/domain/variant/aggregate'
import type { PublishVariantCommand } from '../../../../src/api/app/variant/commands'

async function setupTestEnvironment() {
  const db = createTestDatabase()
  const batcher = new TransactionBatcher(db, {
    flushIntervalMs: 50,
    batchSizeThreshold: 10,
    maxQueueDepth: 100
  })
  batcher.start()
  const unitOfWork = new UnitOfWork(db, batcher)
  return { db, batcher, unitOfWork }
}

function createValidCommand(): PublishVariantCommand {
  return {
    type: 'publishVariant',
    id: 'variant-123',
    userId: 'user-123',
    expectedVersion: 0,
  }
}

async function createVariantInDatabase(
  unitOfWork: UnitOfWork,
  variantId: string
) {
  await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
    const variantAggregate = VariantAggregate.create({
      id: variantId,
      correlationId: 'test-correlation',
      userId: 'user-123',
      productId: 'product-123',
      sku: 'TEST-SKU',
      price: 1999,
      inventory: 50,
      options: { Size: 'M' },
    })

    snapshotRepository.saveSnapshot({
      aggregate_id: variantAggregate.id,
      correlation_id: 'test-correlation',
      version: variantAggregate.version,
      payload: variantAggregate.toSnapshot(),
    })

    for (const event of variantAggregate.uncommittedEvents) {
      eventRepository.addEvent(event)
      outboxRepository.addOutboxEvent(event, { id: crypto.randomUUID() })
    }
  })
}

describe('PublishVariantService', () => {
  test('should successfully publish variant', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      await createVariantInDatabase(unitOfWork, command.id)

      const service = new PublishVariantService(unitOfWork)

      // Act
      await service.execute(command)

      // Assert
      const variantSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregate_id = ?
      `).get(command.id) as any

      expect(variantSnapshot).not.toBeNull()
      expect(variantSnapshot.version).toBe(1)

      const variantPayload = JSON.parse(variantSnapshot.payload)
      expect(variantPayload.status).toBe('active')
      expect(variantPayload.publishedAt).not.toBeNull()

      // Verify event was saved
      const events = db.query(`
        SELECT * FROM events
        WHERE aggregate_id = ? AND version = 1
      `).all(command.id) as any[]

      expect(events.length).toBeGreaterThan(0)
      expect(events[0].event_type).toBe('variant.published')

      // Verify event added to outbox
      const outboxCount = db.query(`
        SELECT COUNT(*) as count FROM outbox
        WHERE aggregate_id = ?
      `).get(command.id) as any

      expect(outboxCount.count).toBeGreaterThan(0)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when variant does not exist', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      const service = new PublishVariantService(unitOfWork)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow(`Variant with id ${command.id} not found`)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error on optimistic concurrency conflict', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      command.expectedVersion = 5
      await createVariantInDatabase(unitOfWork, command.id)

      const service = new PublishVariantService(unitOfWork)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow(
        'Optimistic concurrency conflict: expected version 5 but found version 0'
      )
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should increment version after publish', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      await createVariantInDatabase(unitOfWork, command.id)

      const service = new PublishVariantService(unitOfWork)

      // Act
      await service.execute(command)

      // Assert
      const snapshot = db.query(`
        SELECT version FROM snapshots
        WHERE aggregate_id = ?
      `).get(command.id) as any

      expect(snapshot.version).toBe(1)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should preserve correlationId from original snapshot', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      const originalCorrelationId = 'original-correlation-123'

      await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
        const variantAggregate = VariantAggregate.create({
          id: command.id,
          correlationId: originalCorrelationId,
          userId: 'user-123',
          productId: 'product-123',
          sku: 'TEST-SKU',
          price: 1999,
          inventory: 50,
          options: { Size: 'M' },
        })

        snapshotRepository.saveSnapshot({
          aggregate_id: variantAggregate.id,
          correlation_id: originalCorrelationId,
          version: variantAggregate.version,
          payload: variantAggregate.toSnapshot(),
        })

        for (const event of variantAggregate.uncommittedEvents) {
          eventRepository.addEvent(event)
          outboxRepository.addOutboxEvent(event, { id: crypto.randomUUID() })
        }
      })

      const service = new PublishVariantService(unitOfWork)

      // Act
      await service.execute(command)

      // Assert
      const snapshot = db.query(`
        SELECT correlation_id FROM snapshots
        WHERE aggregate_id = ? AND version = 1
      `).get(command.id) as any

      expect(snapshot.correlation_id).toBe(originalCorrelationId)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should set correct access level', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new PublishVariantService(unitOfWork)

      // Assert
      expect(service.accessLevel).toBe('admin')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should rollback on error and not modify data', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      command.expectedVersion = 99
      await createVariantInDatabase(unitOfWork, command.id)

      const service = new PublishVariantService(unitOfWork)

      // Get initial state
      const initialSnapshot = db.query(`
        SELECT payload, version FROM snapshots
        WHERE aggregate_id = ?
      `).get(command.id) as any

      const initialPayload = JSON.parse(initialSnapshot.payload)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow()

      // Verify state wasn't modified
      const finalSnapshot = db.query(`
        SELECT payload, version FROM snapshots
        WHERE aggregate_id = ?
      `).get(command.id) as any

      const finalPayload = JSON.parse(finalSnapshot.payload)

      expect(finalSnapshot.version).toBe(initialSnapshot.version)
      expect(finalPayload.status).toBe(initialPayload.status)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should record publishedAt timestamp', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      await createVariantInDatabase(unitOfWork, command.id)

      const service = new PublishVariantService(unitOfWork)
      const beforePublish = new Date()

      // Act
      await service.execute(command)

      const afterPublish = new Date()

      // Assert
      const variantSnapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregate_id = ?
      `).get(command.id) as any

      const variantPayload = JSON.parse(variantSnapshot.payload)
      const publishedAt = new Date(variantPayload.publishedAt)

      expect(publishedAt.getTime()).toBeGreaterThanOrEqual(beforePublish.getTime())
      expect(publishedAt.getTime()).toBeLessThanOrEqual(afterPublish.getTime())
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
