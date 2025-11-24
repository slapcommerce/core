import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDatabase, closeTestDatabase } from '../../helpers/database'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { ArchiveVariantService } from '../../../src/app/variant/archiveVariantService'
import { VariantAggregate } from '../../../src/domain/variant/aggregate'
import { SkuAggregate } from '../../../src/domain/sku/skuAggregate'
import type { ArchiveVariantCommand } from '../../../src/app/variant/commands'

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

function createValidCommand(): ArchiveVariantCommand {
  return {
    type: 'archiveVariant',
    id: 'variant-123',
    userId: 'user-123',
    expectedVersion: 0,
  }
}

async function createVariantWithSkuInDatabase(
  unitOfWork: UnitOfWork,
  variantId: string,
  sku: string
) {
  await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
    // Create SKU aggregate
    const skuAggregate = SkuAggregate.create({
      sku,
      correlationId: 'test-correlation',
    })
    skuAggregate.reserveSku(variantId, 'user-123')

    snapshotRepository.saveSnapshot({
      aggregate_id: skuAggregate.id,
      correlation_id: 'test-correlation',
      version: skuAggregate.version,
      payload: skuAggregate.toSnapshot(),
    })

    for (const event of skuAggregate.uncommittedEvents) {
      eventRepository.addEvent(event)
      outboxRepository.addOutboxEvent(event, { id: crypto.randomUUID() })
    }

    // Create variant aggregate
    const variantAggregate = VariantAggregate.create({
      id: variantId,
      correlationId: 'test-correlation',
      userId: 'user-123',
      productId: 'product-123',
      sku,
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

describe('ArchiveVariantService', () => {
  test('should successfully archive variant and release SKU', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      const sku = 'TEST-SKU-001'
      await createVariantWithSkuInDatabase(unitOfWork, command.id, sku)

      const service = new ArchiveVariantService(unitOfWork)

      // Act
      await service.execute(command)

      // Assert - Verify variant was archived
      const variantSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregate_id = ?
      `).get(command.id) as any

      expect(variantSnapshot).not.toBeNull()
      expect(variantSnapshot.version).toBe(1)

      const variantPayload = JSON.parse(variantSnapshot.payload)
      expect(variantPayload.status).toBe('archived')

      // Verify SKU was released
      const skuSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregate_id = ?
      `).get(sku) as any

      expect(skuSnapshot).not.toBeNull()
      const skuPayload = JSON.parse(skuSnapshot.payload)
      expect(skuPayload.status).toBe('released')
      expect(skuPayload.targetId).toBeUndefined()

      // Verify events were saved
      const variantEvents = db.query(`
        SELECT * FROM events
        WHERE aggregate_id = ? AND version = 1
      `).all(command.id) as any[]

      expect(variantEvents.length).toBeGreaterThan(0)
      expect(variantEvents[0].event_type).toBe('variant.archived')

      const skuEvents = db.query(`
        SELECT * FROM events
        WHERE aggregate_id = ? AND event_type = ?
      `).all(sku, 'sku.released') as any[]

      expect(skuEvents.length).toBeGreaterThan(0)

      // Verify events added to outbox
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
      const service = new ArchiveVariantService(unitOfWork)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow(`Variant with id ${command.id} not found`)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when SKU does not exist', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      const sku = 'TEST-SKU-001'

      // Create variant without creating SKU
      await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
        const variantAggregate = VariantAggregate.create({
          id: command.id,
          correlationId: 'test-correlation',
          userId: 'user-123',
          productId: 'product-123',
          sku,
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

      const service = new ArchiveVariantService(unitOfWork)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow(`SKU "${sku}" not found`)
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
      await createVariantWithSkuInDatabase(unitOfWork, command.id, 'TEST-SKU-001')

      const service = new ArchiveVariantService(unitOfWork)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow(
        'Optimistic concurrency conflict: expected version 5 but found version 0'
      )
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should increment version after archive', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      await createVariantWithSkuInDatabase(unitOfWork, command.id, 'TEST-SKU-001')

      const service = new ArchiveVariantService(unitOfWork)

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
      const sku = 'TEST-SKU-001'

      await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
        // Create SKU aggregate
        const skuAggregate = SkuAggregate.create({
          sku,
          correlationId: originalCorrelationId,
        })
        skuAggregate.reserveSku(command.id, 'user-123')

        snapshotRepository.saveSnapshot({
          aggregate_id: skuAggregate.id,
          correlation_id: originalCorrelationId,
          version: skuAggregate.version,
          payload: skuAggregate.toSnapshot(),
        })

        for (const event of skuAggregate.uncommittedEvents) {
          eventRepository.addEvent(event)
          outboxRepository.addOutboxEvent(event, { id: crypto.randomUUID() })
        }

        // Create variant aggregate
        const variantAggregate = VariantAggregate.create({
          id: command.id,
          correlationId: originalCorrelationId,
          userId: 'user-123',
          productId: 'product-123',
          sku,
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

      const service = new ArchiveVariantService(unitOfWork)

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
      const service = new ArchiveVariantService(unitOfWork)

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
      await createVariantWithSkuInDatabase(unitOfWork, command.id, 'TEST-SKU-001')

      const service = new ArchiveVariantService(unitOfWork)

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

  test('should create both variant and SKU events', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      const sku = 'TEST-SKU-001'
      await createVariantWithSkuInDatabase(unitOfWork, command.id, sku)

      const service = new ArchiveVariantService(unitOfWork)

      // Act
      await service.execute(command)

      // Assert - Check both variant and SKU events exist
      const variantEvents = db.query(`
        SELECT COUNT(*) as count FROM events
        WHERE aggregate_id = ? AND version = 1
      `).get(command.id) as any

      expect(variantEvents.count).toBeGreaterThan(0)

      const skuEvents = db.query(`
        SELECT COUNT(*) as count FROM events
        WHERE aggregate_id = ? AND event_type = 'sku.released'
      `).get(sku) as any

      expect(skuEvents.count).toBeGreaterThan(0)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
