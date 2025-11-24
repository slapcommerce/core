import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDatabase, closeTestDatabase } from '../../helpers/database'
import { TransactionBatcher } from '../../../../src/api/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../../src/api/infrastructure/unitOfWork'
import { DetachVariantDigitalAssetService } from '../../../../src/api/app/variant/detachVariantDigitalAssetService'
import { VariantAggregate } from '../../../../src/api/domain/variant/aggregate'
import type { DetachVariantDigitalAssetCommand } from '../../../../src/api/app/variant/commands'

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

function createValidCommand(): DetachVariantDigitalAssetCommand {
  return {
    type: 'detachVariantDigitalAsset',
    id: 'variant-123',
    userId: 'user-123',
    expectedVersion: 0,
  }
}

async function createVariantWithDigitalAssetInDatabase(
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
      inventory: -1,
      options: { Size: 'M' },
    })

    // Attach a digital asset
    const digitalAsset = {
      name: 'test-file.pdf',
      fileKey: 'test-asset-id',
      mimeType: 'application/pdf',
      size: 1024,
    }
    variantAggregate.attachDigitalAsset(digitalAsset, 'user-123')

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

describe('DetachVariantDigitalAssetService', () => {
  test('should successfully detach digital asset from variant', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      command.expectedVersion = 1 // After attaching asset
      await createVariantWithDigitalAssetInDatabase(unitOfWork, command.id)

      const service = new DetachVariantDigitalAssetService(unitOfWork)

      // Act
      await service.execute(command)

      // Assert
      const variantSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregate_id = ?
      `).get(command.id) as any

      expect(variantSnapshot).not.toBeNull()
      expect(variantSnapshot.version).toBe(2)

      const variantPayload = JSON.parse(variantSnapshot.payload)
      expect(variantPayload.digitalAsset).toBeNull()

      // Verify event was saved
      const events = db.query(`
        SELECT * FROM events
        WHERE aggregate_id = ? AND version = 2
      `).all(command.id) as any[]

      expect(events.length).toBeGreaterThan(0)
      expect(events[0].event_type).toBe('variant.digital_asset_detached')

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
      const service = new DetachVariantDigitalAssetService(unitOfWork)

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
      await createVariantWithDigitalAssetInDatabase(unitOfWork, command.id)

      const service = new DetachVariantDigitalAssetService(unitOfWork)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow(
        'Optimistic concurrency conflict: expected version 5 but found version 1'
      )
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should increment version after detaching asset', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      command.expectedVersion = 1
      await createVariantWithDigitalAssetInDatabase(unitOfWork, command.id)

      const service = new DetachVariantDigitalAssetService(unitOfWork)

      // Act
      await service.execute(command)

      // Assert
      const snapshot = db.query(`
        SELECT version FROM snapshots
        WHERE aggregate_id = ?
      `).get(command.id) as any

      expect(snapshot.version).toBe(2)
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
      command.expectedVersion = 1
      const originalCorrelationId = 'original-correlation-123'

      await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
        const variantAggregate = VariantAggregate.create({
          id: command.id,
          correlationId: originalCorrelationId,
          userId: 'user-123',
          productId: 'product-123',
          sku: 'TEST-SKU',
          price: 1999,
          inventory: -1,
          options: { Size: 'M' },
        })

        const digitalAsset = {
          name: 'test-file.pdf',
          fileKey: 'test-asset-id',
          mimeType: 'application/pdf',
          size: 1024,
        }
        variantAggregate.attachDigitalAsset(digitalAsset, 'user-123')

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

      const service = new DetachVariantDigitalAssetService(unitOfWork)

      // Act
      await service.execute(command)

      // Assert
      const snapshot = db.query(`
        SELECT correlation_id FROM snapshots
        WHERE aggregate_id = ? AND version = 2
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
      const service = new DetachVariantDigitalAssetService(unitOfWork)

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
      await createVariantWithDigitalAssetInDatabase(unitOfWork, command.id)

      const service = new DetachVariantDigitalAssetService(unitOfWork)

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
      expect(finalPayload.digitalAsset).not.toBeNull()
      expect(finalPayload.digitalAsset.fileKey).toBe(initialPayload.digitalAsset.fileKey)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should work when variant has no digital asset attached', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()

      // Create variant without digital asset
      await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
        const variantAggregate = VariantAggregate.create({
          id: command.id,
          correlationId: 'test-correlation',
          userId: 'user-123',
          productId: 'product-123',
          sku: 'TEST-SKU',
          price: 1999,
          inventory: -1,
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

      const service = new DetachVariantDigitalAssetService(unitOfWork)

      // Act
      await service.execute(command)

      // Assert
      const variantSnapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregate_id = ?
      `).get(command.id) as any

      const variantPayload = JSON.parse(variantSnapshot.payload)
      expect(variantPayload.digitalAsset).toBeNull()
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should preserve other variant properties when detaching asset', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      command.expectedVersion = 1
      await createVariantWithDigitalAssetInDatabase(unitOfWork, command.id)

      const service = new DetachVariantDigitalAssetService(unitOfWork)

      // Act
      await service.execute(command)

      // Assert
      const variantSnapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregate_id = ?
      `).get(command.id) as any

      const variantPayload = JSON.parse(variantSnapshot.payload)

      // Verify other properties are preserved
      expect(variantPayload.productId).toBe('product-123')
      expect(variantPayload.sku).toBe('TEST-SKU')
      expect(variantPayload.price).toBe(1999)
      expect(variantPayload.inventory).toBe(-1)
      expect(variantPayload.options).toEqual({ Size: 'M' })
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
