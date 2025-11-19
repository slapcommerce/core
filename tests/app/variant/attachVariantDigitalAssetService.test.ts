import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { CreateVariantService } from '../../../src/app/variant/createVariantService'
import { CreateProductService } from '../../../src/app/product/createProductService'
import { AttachVariantDigitalAssetService } from '../../../src/app/variant/attachVariantDigitalAssetService'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { schemas } from '../../../src/infrastructure/schemas'
import { ProjectionService } from '../../../src/infrastructure/projectionService'
import type { CreateVariantCommand } from '../../../src/app/variant/commands'
import type { CreateProductCommand } from '../../../src/app/product/commands'
import type { AttachVariantDigitalAssetCommand } from '../../../src/app/variant/commands'

function createValidProductCommand(variantId?: string, fulfillmentType: 'digital' | 'dropship' = 'digital'): CreateProductCommand {
  return {
    id: randomUUIDv7(),
    correlationId: randomUUIDv7(),
    userId: randomUUIDv7(),
    title: 'Test Product',
    shortDescription: 'A test product',
    slug: 'test-product',
    collectionIds: [randomUUIDv7()],
    variantIds: variantId ? [variantId] : [randomUUIDv7()],
    richDescriptionUrl: 'https://example.com/description',
    productType: 'physical',
    fulfillmentType,
    dropshipSafetyBuffer: fulfillmentType === 'dropship' ? 1 : undefined,
    vendor: 'Test Vendor',
    variantOptions: [
      { name: 'Size', values: ['S', 'M', 'L'] }
    ],
    metaTitle: 'Test Product Meta Title',
    metaDescription: 'Test Product Meta Description',
    tags: ['test', 'product'],
    requiresShipping: true,
    taxable: true,
    pageLayoutId: null,
  }
}

function createValidVariantCommand(productId: string): CreateVariantCommand {
  return {
    id: randomUUIDv7(),
    correlationId: randomUUIDv7(),
    userId: randomUUIDv7(),
    productId,
    sku: 'SKU-123',
    title: 'Test Variant',
    price: 29.99,
    inventory: 100,
    options: { Size: 'L' },
    barcode: '123456789',
  }
}

describe('AttachVariantDigitalAssetService', () => {
  // Mock DigitalAssetUploadHelper
  const mockDigitalAssetUploadHelper = {
    async uploadAsset(buffer: ArrayBuffer, filename: string, mimeType: string) {
      return {
        assetId: `assets/${filename}`,
        filename: filename,
        size: buffer.byteLength,
        url: `/storage/digital-assets/assets/${filename}/${filename}`,
      }
    }
  }

  test('should successfully attach digital asset to variant', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    const unitOfWork = new UnitOfWork(db, batcher)
    const projectionService = new ProjectionService()

    // Create product with digital fulfillmentType
    const variantId = randomUUIDv7()
    const productId = randomUUIDv7()

    const productService = new CreateProductService(unitOfWork, projectionService)
    const productCommand = createValidProductCommand(variantId, 'digital')
    productCommand.id = productId
    await productService.execute(productCommand)

    await new Promise(resolve => setTimeout(resolve, 100))

    const createVariantService = new CreateVariantService(unitOfWork, projectionService)
    const variantCommand = createValidVariantCommand(productId)
    variantCommand.id = variantId
    await createVariantService.execute(variantCommand)

    await new Promise(resolve => setTimeout(resolve, 100))

    const variantSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(variantCommand.id) as any
    const attachCommand: AttachVariantDigitalAssetCommand = {
      id: variantCommand.id,
      userId: variantCommand.userId,
      assetData: 'data:application/pdf;base64,VGVzdCBmaWxlIGNvbnRlbnQ=',
      filename: 'ebook.pdf',
      mimeType: 'application/pdf',
      expectedVersion: JSON.parse(variantSnapshot.payload).version,
    }

    const attachService = new AttachVariantDigitalAssetService(unitOfWork, projectionService, mockDigitalAssetUploadHelper)

    // Act
    await attachService.execute(attachCommand)

    // Assert - Verify variant.digital_asset_attached event was saved
    await new Promise(resolve => setTimeout(resolve, 100))
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(variantCommand.id) as any[]
    expect(events.length).toBe(2)
    expect(events[1]!.event_type).toBe('variant.digital_asset_attached')
    expect(events[1]!.version).toBe(1)

    const eventPayload = JSON.parse(events[1]!.payload)
    expect(eventPayload.newState.digitalAsset).toEqual({
      name: 'ebook.pdf',
      fileKey: 'assets/ebook.pdf',
      mimeType: 'application/pdf',
      size: 17, // Base64 decoded size of 'VGVzdCBmaWxlIGNvbnRlbnQ=' = 'Test file content'
    })
    expect(eventPayload.priorState.digitalAsset).toBeNull()

    // Assert - Verify snapshot was updated
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(variantCommand.id) as any
    expect(snapshot.version).toBe(1)
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.digitalAsset).toEqual({
      name: 'ebook.pdf',
      fileKey: 'assets/ebook.pdf',
      mimeType: 'application/pdf',
      size: 17,
    })

    batcher.stop()
    db.close()
  })

  test('should throw error when variant not found', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    const unitOfWork = new UnitOfWork(db, batcher)
    const projectionService = new ProjectionService()
    const service = new AttachVariantDigitalAssetService(unitOfWork, projectionService, mockDigitalAssetUploadHelper)
    const command: AttachVariantDigitalAssetCommand = {
      id: randomUUIDv7(),
      userId: randomUUIDv7(),
      assetData: 'data:application/pdf;base64,VGVzdCBmaWxlIGNvbnRlbnQ=',
      filename: 'ebook.pdf',
      mimeType: 'application/pdf',
      expectedVersion: 0,
    }

    // Act & Assert
    await expect(service.execute(command)).rejects.toThrow('Variant with id')
    batcher.stop()
    db.close()
  })

  test('should throw error on optimistic concurrency conflict', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    const unitOfWork = new UnitOfWork(db, batcher)
    const projectionService = new ProjectionService()

    const variantId = randomUUIDv7()
    const productId = randomUUIDv7()

    const productService = new CreateProductService(unitOfWork, projectionService)
    const productCommand = createValidProductCommand(variantId, 'digital')
    productCommand.id = productId
    await productService.execute(productCommand)

    const createVariantService = new CreateVariantService(unitOfWork, projectionService)
    const variantCommand = createValidVariantCommand(productId)
    variantCommand.id = variantId
    await createVariantService.execute(variantCommand)

    await new Promise(resolve => setTimeout(resolve, 100))

    const attachCommand: AttachVariantDigitalAssetCommand = {
      id: variantCommand.id,
      userId: variantCommand.userId,
      assetData: 'data:application/pdf;base64,VGVzdCBmaWxlIGNvbnRlbnQ=',
      filename: 'ebook.pdf',
      mimeType: 'application/pdf',
      expectedVersion: 5, // Wrong version
    }

    const attachService = new AttachVariantDigitalAssetService(unitOfWork, projectionService, mockDigitalAssetUploadHelper)

    // Act & Assert
    await expect(attachService.execute(attachCommand)).rejects.toThrow('Optimistic concurrency conflict')
    batcher.stop()
    db.close()
  })

  test('should throw error when product fulfillmentType is not digital', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    const unitOfWork = new UnitOfWork(db, batcher)
    const projectionService = new ProjectionService()

    // Create product with dropship fulfillmentType
    const variantId = randomUUIDv7()
    const productId = randomUUIDv7()

    const productService = new CreateProductService(unitOfWork, projectionService)
    const productCommand = createValidProductCommand(variantId, 'dropship')
    productCommand.id = productId
    await productService.execute(productCommand)

    await new Promise(resolve => setTimeout(resolve, 100))

    const createVariantService = new CreateVariantService(unitOfWork, projectionService)
    const variantCommand = createValidVariantCommand(productId)
    variantCommand.id = variantId
    await createVariantService.execute(variantCommand)

    await new Promise(resolve => setTimeout(resolve, 100))

    const variantSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(variantCommand.id) as any
    const attachCommand: AttachVariantDigitalAssetCommand = {
      id: variantCommand.id,
      userId: variantCommand.userId,
      assetData: 'data:application/pdf;base64,VGVzdCBmaWxlIGNvbnRlbnQ=',
      filename: 'ebook.pdf',
      mimeType: 'application/pdf',
      expectedVersion: JSON.parse(variantSnapshot.payload).version,
    }

    const attachService = new AttachVariantDigitalAssetService(unitOfWork, projectionService, mockDigitalAssetUploadHelper)

    // Act & Assert
    await expect(attachService.execute(attachCommand)).rejects.toThrow('Cannot attach digital asset to variant: product fulfillmentType must be "digital"')
    batcher.stop()
    db.close()
  })

  test('should replace existing digital asset', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    const unitOfWork = new UnitOfWork(db, batcher)
    const projectionService = new ProjectionService()

    const variantId = randomUUIDv7()
    const productId = randomUUIDv7()

    const productService = new CreateProductService(unitOfWork, projectionService)
    const productCommand = createValidProductCommand(variantId, 'digital')
    productCommand.id = productId
    await productService.execute(productCommand)

    await new Promise(resolve => setTimeout(resolve, 100))

    const createVariantService = new CreateVariantService(unitOfWork, projectionService)
    const variantCommand = createValidVariantCommand(productId)
    variantCommand.id = variantId
    await createVariantService.execute(variantCommand)

    await new Promise(resolve => setTimeout(resolve, 100))

    // Attach first asset
    const variantSnapshot1 = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(variantCommand.id) as any
    const attachCommand1: AttachVariantDigitalAssetCommand = {
      id: variantCommand.id,
      userId: variantCommand.userId,
      assetData: 'data:application/pdf;base64,VGVzdCBvbGQgZmlsZQ==',
      filename: 'old.pdf',
      mimeType: 'application/pdf',
      expectedVersion: JSON.parse(variantSnapshot1.payload).version,
    }

    const attachService = new AttachVariantDigitalAssetService(unitOfWork, projectionService, mockDigitalAssetUploadHelper)
    await attachService.execute(attachCommand1)

    await new Promise(resolve => setTimeout(resolve, 100))

    // Attach second asset (replacement)
    const variantSnapshot2 = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(variantCommand.id) as any
    const attachCommand2: AttachVariantDigitalAssetCommand = {
      id: variantCommand.id,
      userId: variantCommand.userId,
      assetData: 'data:application/pdf;base64,VGVzdCBuZXcgZmlsZQ==',
      filename: 'new.pdf',
      mimeType: 'application/pdf',
      expectedVersion: JSON.parse(variantSnapshot2.payload).version,
    }

    // Act
    await attachService.execute(attachCommand2)

    // Assert
    await new Promise(resolve => setTimeout(resolve, 100))
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(variantCommand.id) as any[]
    expect(events.length).toBe(3) // created + first attach + second attach
    expect(events[2]!.event_type).toBe('variant.digital_asset_attached')
    expect(events[2]!.version).toBe(2)

    const eventPayload = JSON.parse(events[2]!.payload)
    expect(eventPayload.newState.digitalAsset).toEqual({
      name: 'new.pdf',
      fileKey: 'assets/new.pdf',
      mimeType: 'application/pdf',
      size: 13, // Base64 decoded size of 'VGVzdCBuZXcgZmlsZQ=='
    })
    expect(eventPayload.priorState.digitalAsset).toEqual({
      name: 'old.pdf',
      fileKey: 'assets/old.pdf',
      mimeType: 'application/pdf',
      size: 13, // Base64 decoded size of 'VGVzdCBvbGQgZmlsZQ=='
    })

    // Assert - Verify snapshot has new asset
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(variantCommand.id) as any
    expect(snapshot.version).toBe(2)
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.digitalAsset).toEqual({
      name: 'new.pdf',
      fileKey: 'assets/new.pdf',
      mimeType: 'application/pdf',
      size: 13,
    })

    batcher.stop()
    db.close()
  })
})
