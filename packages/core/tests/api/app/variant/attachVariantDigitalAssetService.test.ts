import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDatabase, closeTestDatabase } from '../../helpers/database'
import { TransactionBatcher } from '../../../../src/api/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../../src/api/infrastructure/unitOfWork'
import { AttachVariantDigitalAssetService } from '../../../../src/api/app/variant/attachVariantDigitalAssetService'
import { VariantAggregate } from '../../../../src/api/domain/variant/aggregate'
import { ProductAggregate } from '../../../../src/api/domain/product/aggregate'
import type { AttachVariantDigitalAssetCommand } from '../../../../src/api/app/variant/commands'
import type { DigitalAssetUploadHelper } from '../../../../src/api/infrastructure/digitalAssetUploadHelper'
import type { DigitalAssetUploadResult } from '../../../../src/api/infrastructure/adapters/digitalAssetStorageAdapter'

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

function createValidCommand(): AttachVariantDigitalAssetCommand {
  const base64Asset = 'data:application/pdf;base64,JVBERi0xLjQKJeLjz9MNCg=='

  return {
    type: 'attachVariantDigitalAsset',
    id: 'variant-123',
    userId: 'user-123',
    assetData: base64Asset,
    filename: 'test-file.pdf',
    mimeType: 'application/pdf',
    expectedVersion: 0,
  }
}

async function createVariantInDatabase(
  unitOfWork: UnitOfWork,
  variantId: string,
  productId: string
) {
  await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
    const variantAggregate = VariantAggregate.create({
      id: variantId,
      correlationId: 'test-correlation',
      userId: 'user-123',
      productId,
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
}

async function createProductInDatabase(
  unitOfWork: UnitOfWork,
  productId: string,
  fulfillmentType: 'dropship' | 'digital'
) {
  await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
    const productAggregate = ProductAggregate.create({
      id: productId,
      correlationId: 'test-correlation',
      userId: 'user-123',
      title: 'Test Product',
      shortDescription: 'Test description',
      slug: 'test-product',
      collectionIds: ['collection-1'],
      variantIds: [],
      richDescriptionUrl: 'https://example.com',
      productType: 'physical',
      fulfillmentType,
      vendor: 'Test Vendor',
      variantOptions: [],
      metaTitle: 'Test Product',
      metaDescription: 'Test description',
      tags: [],
      taxable: true,
      taxId: 'TAX123',
      dropshipSafetyBuffer: 0,
    })

    snapshotRepository.saveSnapshot({
      aggregate_id: productAggregate.id,
      correlation_id: 'test-correlation',
      version: productAggregate.version,
      payload: productAggregate.toSnapshot(),
    })

    for (const event of productAggregate.uncommittedEvents) {
      eventRepository.addEvent(event)
      outboxRepository.addOutboxEvent(event, { id: crypto.randomUUID() })
    }
  })
}

class MockDigitalAssetUploadHelper {
  storageAdapter = null as any;

  async uploadAsset(
    buffer: ArrayBuffer,
    filename: string,
    mimeType: string
  ): Promise<DigitalAssetUploadResult> {
    return {
      assetId: 'test-asset-id',
      url: 'https://example.com/assets/test-asset-id',
      filename: filename,
      size: buffer.byteLength,
    }
  }
}

describe('AttachVariantDigitalAssetService', () => {
  test('should successfully attach digital asset to variant for digital product', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      const productId = 'product-123'

      await createProductInDatabase(unitOfWork, productId, 'digital')
      await createVariantInDatabase(unitOfWork, command.id, productId)

      const mockDigitalAssetUploadHelper = new MockDigitalAssetUploadHelper()
      const service = new AttachVariantDigitalAssetService(unitOfWork, mockDigitalAssetUploadHelper as any)

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
      expect(variantPayload.digitalAsset).not.toBeNull()
      expect(variantPayload.digitalAsset.fileKey).toBe('test-asset-id')
      expect(variantPayload.digitalAsset.name).toBe(command.filename)
      expect(variantPayload.digitalAsset.mimeType).toBe(command.mimeType)

      // Verify event was saved
      const events = db.query(`
        SELECT * FROM events
        WHERE aggregate_id = ? AND version = 1
      `).all(command.id) as any[]

      expect(events.length).toBeGreaterThan(0)
      expect(events[0].event_type).toBe('variant.digital_asset_attached')

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

  test('should throw error when product fulfillmentType is not digital', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      const productId = 'product-123'

      await createProductInDatabase(unitOfWork, productId, 'dropship')
      await createVariantInDatabase(unitOfWork, command.id, productId)

      const mockDigitalAssetUploadHelper = new MockDigitalAssetUploadHelper()
      const service = new AttachVariantDigitalAssetService(unitOfWork, mockDigitalAssetUploadHelper as any)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow(
        'Cannot attach digital asset to variant: product fulfillmentType must be "digital" but is "dropship"'
      )
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
      const mockDigitalAssetUploadHelper = new MockDigitalAssetUploadHelper()
      const service = new AttachVariantDigitalAssetService(unitOfWork, mockDigitalAssetUploadHelper as any)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow(`Variant with id ${command.id} not found`)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when product does not exist', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      const productId = 'product-123'

      await createVariantInDatabase(unitOfWork, command.id, productId)

      const mockDigitalAssetUploadHelper = new MockDigitalAssetUploadHelper()
      const service = new AttachVariantDigitalAssetService(unitOfWork, mockDigitalAssetUploadHelper as any)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow(`Product with id ${productId} not found`)
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
      const productId = 'product-123'

      await createProductInDatabase(unitOfWork, productId, 'digital')
      await createVariantInDatabase(unitOfWork, command.id, productId)

      const mockDigitalAssetUploadHelper = new MockDigitalAssetUploadHelper()
      const service = new AttachVariantDigitalAssetService(unitOfWork, mockDigitalAssetUploadHelper as any)

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow(
        'Optimistic concurrency conflict: expected version 5 but found version 0'
      )
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should increment version after attaching asset', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      const productId = 'product-123'

      await createProductInDatabase(unitOfWork, productId, 'digital')
      await createVariantInDatabase(unitOfWork, command.id, productId)

      const mockDigitalAssetUploadHelper = new MockDigitalAssetUploadHelper()
      const service = new AttachVariantDigitalAssetService(unitOfWork, mockDigitalAssetUploadHelper as any)

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
      const productId = 'product-123'
      const originalCorrelationId = 'original-correlation-123'

      await createProductInDatabase(unitOfWork, productId, 'digital')

      await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
        const variantAggregate = VariantAggregate.create({
          id: command.id,
          correlationId: originalCorrelationId,
          userId: 'user-123',
          productId,
          sku: 'TEST-SKU',
          price: 1999,
          inventory: -1,
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

      const mockDigitalAssetUploadHelper = new MockDigitalAssetUploadHelper()
      const service = new AttachVariantDigitalAssetService(unitOfWork, mockDigitalAssetUploadHelper as any)

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
      const mockDigitalAssetUploadHelper = new MockDigitalAssetUploadHelper()
      const service = new AttachVariantDigitalAssetService(unitOfWork, mockDigitalAssetUploadHelper as any)

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
      const productId = 'product-123'

      await createProductInDatabase(unitOfWork, productId, 'dropship')
      await createVariantInDatabase(unitOfWork, command.id, productId)

      const mockDigitalAssetUploadHelper = new MockDigitalAssetUploadHelper()
      const service = new AttachVariantDigitalAssetService(unitOfWork, mockDigitalAssetUploadHelper as any)

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
      expect(finalPayload.digitalAsset).toBe(initialPayload.digitalAsset)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should store asset size in digital asset', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const command = createValidCommand()
      const productId = 'product-123'

      await createProductInDatabase(unitOfWork, productId, 'digital')
      await createVariantInDatabase(unitOfWork, command.id, productId)

      const mockDigitalAssetUploadHelper = new MockDigitalAssetUploadHelper()
      const service = new AttachVariantDigitalAssetService(unitOfWork, mockDigitalAssetUploadHelper as any)

      // Act
      await service.execute(command)

      // Assert
      const variantSnapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregate_id = ?
      `).get(command.id) as any

      const variantPayload = JSON.parse(variantSnapshot.payload)
      expect(variantPayload.digitalAsset.size).toBeGreaterThan(0)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
