import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { ArchiveDigitalDownloadableVariantService } from '../../../../../../src/api/app/digitalDownloadableVariant/commands/admin/archiveDigitalDownloadableVariantService'
import { SetDigitalDownloadableProductDefaultVariantService } from '../../../../../../src/api/app/digitalDownloadableProduct/commands/admin/setDigitalDownloadableProductDefaultVariantService'
import { setupTestEnvironment, createTestProduct, createTestVariant } from './helpers'

describe('ArchiveDigitalDownloadableVariantService', () => {
  test('should archive a variant', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const service = new ArchiveDigitalDownloadableVariantService(unitOfWork)

      await service.execute({
        type: 'archiveDigitalDownloadableVariant',
        id: variant.id,
        userId: 'user-123',
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(variant.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.status).toBe('archived')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should release SKU when archiving', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork, { sku: 'RELEASE-SKU' })
      const service = new ArchiveDigitalDownloadableVariantService(unitOfWork)

      await service.execute({
        type: 'archiveDigitalDownloadableVariant',
        id: variant.id,
        userId: 'user-123',
        expectedVersion: 0,
      })

      const skuSnapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get('RELEASE-SKU') as any
      const skuPayload = JSON.parse(skuSnapshot.payload)
      expect(skuPayload.status).toBe('released')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should clear default variant on product if archived variant was default', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)

      // Create variant (this adds it to positions automatically)
      const variant = await createTestVariant(unitOfWork)

      // Set it as default
      const setDefaultService = new SetDigitalDownloadableProductDefaultVariantService(unitOfWork)
      await setDefaultService.execute({
        type: 'setDigitalDownloadableProductDefaultVariant',
        productId: product.id,
        variantId: variant.id,
        userId: 'user-123',
        expectedVersion: 0,
      })

      // Archive the variant
      const archiveService = new ArchiveDigitalDownloadableVariantService(unitOfWork)
      await archiveService.execute({
        type: 'archiveDigitalDownloadableVariant',
        id: variant.id,
        userId: 'user-123',
        expectedVersion: 0,
      })

      // Check that default variant is cleared
      const updatedProductSnapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(product.id) as any
      const updatedProductPayload = JSON.parse(updatedProductSnapshot.payload)
      expect(updatedProductPayload.defaultVariantId).toBeNull()
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw on version mismatch', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const service = new ArchiveDigitalDownloadableVariantService(unitOfWork)

      await expect(service.execute({
        type: 'archiveDigitalDownloadableVariant',
        id: variant.id,
        userId: 'user-123',
        expectedVersion: 99,
      })).rejects.toThrow('Optimistic concurrency conflict')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw if variant not found', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new ArchiveDigitalDownloadableVariantService(unitOfWork)

      await expect(service.execute({
        type: 'archiveDigitalDownloadableVariant',
        id: 'non-existent-id',
        userId: 'user-123',
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
