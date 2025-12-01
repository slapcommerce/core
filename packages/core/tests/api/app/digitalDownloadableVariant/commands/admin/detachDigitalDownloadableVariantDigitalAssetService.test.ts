import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { AttachDigitalDownloadableVariantDigitalAssetService } from '../../../../../../src/api/app/digitalDownloadableVariant/commands/admin/attachDigitalDownloadableVariantDigitalAssetService'
import { DetachDigitalDownloadableVariantDigitalAssetService } from '../../../../../../src/api/app/digitalDownloadableVariant/commands/admin/detachDigitalDownloadableVariantDigitalAssetService'
import { setupTestEnvironment, createTestProduct, createTestVariant, MockDigitalAssetUploadHelper } from './helpers'

describe('DetachDigitalDownloadableVariantDigitalAssetService', () => {
  test('should detach digital asset from variant', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const mockDigitalAssetUploadHelper = new MockDigitalAssetUploadHelper()

      // First attach a digital asset
      const attachService = new AttachDigitalDownloadableVariantDigitalAssetService(unitOfWork, mockDigitalAssetUploadHelper as any)
      await attachService.execute({
        type: 'attachDigitalDownloadableVariantDigitalAsset',
        id: variant.id,
        userId: 'user-123',
        assetData: btoa('test-asset-data'),
        filename: 'ebook.pdf',
        mimeType: 'application/pdf',
        expectedVersion: 0,
      })

      // Now detach it
      const detachService = new DetachDigitalDownloadableVariantDigitalAssetService(unitOfWork)
      await detachService.execute({
        type: 'detachDigitalDownloadableVariantDigitalAsset',
        id: variant.id,
        userId: 'user-123',
        expectedVersion: 1,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(variant.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.digitalAsset).toBeNull()
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
      const detachService = new DetachDigitalDownloadableVariantDigitalAssetService(unitOfWork)

      await expect(detachService.execute({
        type: 'detachDigitalDownloadableVariantDigitalAsset',
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
      const detachService = new DetachDigitalDownloadableVariantDigitalAssetService(unitOfWork)

      await expect(detachService.execute({
        type: 'detachDigitalDownloadableVariantDigitalAsset',
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
