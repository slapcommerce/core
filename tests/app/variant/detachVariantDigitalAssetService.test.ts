import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { CreateVariantService } from '../../../src/app/variant/createVariantService'
import { CreateProductService } from '../../../src/app/product/createProductService'
import { AttachVariantDigitalAssetService } from '../../../src/app/variant/attachVariantDigitalAssetService'
import { DetachVariantDigitalAssetService } from '../../../src/app/variant/detachVariantDigitalAssetService'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { schemas } from '../../../src/infrastructure/schemas'
import { ProjectionService } from '../../../src/infrastructure/projectionService'
import type { CreateVariantCommand } from '../../../src/app/variant/commands'
import type { CreateProductCommand } from '../../../src/app/product/commands'
import type { AttachVariantDigitalAssetCommand, DetachVariantDigitalAssetCommand } from '../../../src/app/variant/commands'

function createValidProductCommand(variantId?: string): CreateProductCommand {
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
    fulfillmentType: 'digital' as const,
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

describe('DetachVariantDigitalAssetService', () => {
  // Mock DigitalAssetUploadHelper for attach operations
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

  test('should successfully detach digital asset from variant', async () => {
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
    const productCommand = createValidProductCommand(variantId)
    productCommand.id = productId
    await productService.execute(productCommand)

    await new Promise(resolve => setTimeout(resolve, 100))

    const createVariantService = new CreateVariantService(unitOfWork, projectionService)
    const variantCommand = createValidVariantCommand(productId)
    variantCommand.id = variantId
    await createVariantService.execute(variantCommand)

    await new Promise(resolve => setTimeout(resolve, 100))

    // First attach a digital asset
    const variantSnapshot1 = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(variantCommand.id) as any
    const attachCommand: AttachVariantDigitalAssetCommand = {
      id: variantCommand.id,
      userId: variantCommand.userId,
      assetData: 'data:application/pdf;base64,VGVzdCBmaWxlIGNvbnRlbnQ=',
      filename: 'ebook.pdf',
      mimeType: 'application/pdf',
      expectedVersion: JSON.parse(variantSnapshot1.payload).version,
    }

    const attachService = new AttachVariantDigitalAssetService(unitOfWork, projectionService, mockDigitalAssetUploadHelper)
    await attachService.execute(attachCommand)

    await new Promise(resolve => setTimeout(resolve, 100))

    // Now detach it
    const variantSnapshot2 = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(variantCommand.id) as any
    const detachCommand: DetachVariantDigitalAssetCommand = {
      id: variantCommand.id,
      userId: variantCommand.userId,
      expectedVersion: JSON.parse(variantSnapshot2.payload).version,
    }

    const detachService = new DetachVariantDigitalAssetService(unitOfWork, projectionService)

    // Act
    await detachService.execute(detachCommand)

    // Assert - Verify variant.digital_asset_detached event was saved
    await new Promise(resolve => setTimeout(resolve, 100))
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(variantCommand.id) as any[]
    expect(events.length).toBe(3) // created + attached + detached
    expect(events[2]!.event_type).toBe('variant.digital_asset_detached')
    expect(events[2]!.version).toBe(2)

    const eventPayload = JSON.parse(events[2]!.payload)
    expect(eventPayload.newState.digitalAsset).toBeNull()
    expect(eventPayload.priorState.digitalAsset).toEqual({
      name: 'ebook.pdf',
      fileKey: 'assets/ebook.pdf',
      mimeType: 'application/pdf',
      size: 17, // Base64 decoded size of 'VGVzdCBmaWxlIGNvbnRlbnQ=' = 'Test file content'
    })

    // Assert - Verify snapshot was updated
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(variantCommand.id) as any
    expect(snapshot.version).toBe(2)
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.digitalAsset).toBeNull()

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
    const service = new DetachVariantDigitalAssetService(unitOfWork, projectionService)
    const command: DetachVariantDigitalAssetCommand = {
      id: randomUUIDv7(),
      userId: randomUUIDv7(),
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
    const productCommand = createValidProductCommand(variantId)
    productCommand.id = productId
    await productService.execute(productCommand)

    const createVariantService = new CreateVariantService(unitOfWork, projectionService)
    const variantCommand = createValidVariantCommand(productId)
    variantCommand.id = variantId
    await createVariantService.execute(variantCommand)

    await new Promise(resolve => setTimeout(resolve, 100))

    const detachCommand: DetachVariantDigitalAssetCommand = {
      id: variantCommand.id,
      userId: variantCommand.userId,
      expectedVersion: 5, // Wrong version
    }

    const detachService = new DetachVariantDigitalAssetService(unitOfWork, projectionService)

    // Act & Assert
    await expect(detachService.execute(detachCommand)).rejects.toThrow('Optimistic concurrency conflict')
    batcher.stop()
    db.close()
  })

  test('should work when variant has no digital asset', async () => {
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
    const productCommand = createValidProductCommand(variantId)
    productCommand.id = productId
    await productService.execute(productCommand)

    await new Promise(resolve => setTimeout(resolve, 100))

    const createVariantService = new CreateVariantService(unitOfWork, projectionService)
    const variantCommand = createValidVariantCommand(productId)
    variantCommand.id = variantId
    await createVariantService.execute(variantCommand)

    await new Promise(resolve => setTimeout(resolve, 100))

    // Detach without attaching first
    const variantSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(variantCommand.id) as any
    const detachCommand: DetachVariantDigitalAssetCommand = {
      id: variantCommand.id,
      userId: variantCommand.userId,
      expectedVersion: JSON.parse(variantSnapshot.payload).version,
    }

    const detachService = new DetachVariantDigitalAssetService(unitOfWork, projectionService)

    // Act
    await detachService.execute(detachCommand)

    // Assert - Verify event was created even though no asset existed
    await new Promise(resolve => setTimeout(resolve, 100))
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(variantCommand.id) as any[]
    expect(events.length).toBe(2) // created + detached
    expect(events[1]!.event_type).toBe('variant.digital_asset_detached')

    const eventPayload = JSON.parse(events[1]!.payload)
    expect(eventPayload.newState.digitalAsset).toBeNull()
    expect(eventPayload.priorState.digitalAsset).toBeNull()

    batcher.stop()
    db.close()
  })
})
