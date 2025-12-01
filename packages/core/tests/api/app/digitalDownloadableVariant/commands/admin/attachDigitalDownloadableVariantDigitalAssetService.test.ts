import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { AttachDigitalDownloadableVariantDigitalAssetService } from '../../../../../../src/api/app/digitalDownloadableVariant/commands/admin/attachDigitalDownloadableVariantDigitalAssetService'
import { setupTestEnvironment, createTestProduct, createTestVariant, MockDigitalAssetUploadHelper } from './helpers'

describe('AttachDigitalDownloadableVariantDigitalAssetService', () => {
  test('should attach digital asset to variant', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      await createTestProduct(unitOfWork)
      const variant = await createTestVariant(unitOfWork)
      const mockDigitalAssetUploadHelper = new MockDigitalAssetUploadHelper()
      const service = new AttachDigitalDownloadableVariantDigitalAssetService(unitOfWork, mockDigitalAssetUploadHelper as any)

      await service.execute({
        type: 'attachDigitalDownloadableVariantDigitalAsset',
        id: variant.id,
        userId: 'user-123',
        assetData: btoa('test-asset-data'),
        filename: 'ebook.pdf',
        mimeType: 'application/pdf',
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(variant.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.digitalAsset).not.toBeNull()
      expect(payload.digitalAsset.name).toBe('ebook.pdf')
      expect(payload.digitalAsset.fileKey).toBe('test-asset-id')
      expect(payload.digitalAsset.mimeType).toBe('application/pdf')
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
      const mockDigitalAssetUploadHelper = new MockDigitalAssetUploadHelper()
      const service = new AttachDigitalDownloadableVariantDigitalAssetService(unitOfWork, mockDigitalAssetUploadHelper as any)

      await expect(service.execute({
        type: 'attachDigitalDownloadableVariantDigitalAsset',
        id: variant.id,
        userId: 'user-123',
        assetData: btoa('test-asset-data'),
        filename: 'ebook.pdf',
        mimeType: 'application/pdf',
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
      const mockDigitalAssetUploadHelper = new MockDigitalAssetUploadHelper()
      const service = new AttachDigitalDownloadableVariantDigitalAssetService(unitOfWork, mockDigitalAssetUploadHelper as any)

      await expect(service.execute({
        type: 'attachDigitalDownloadableVariantDigitalAsset',
        id: 'non-existent-id',
        userId: 'user-123',
        assetData: btoa('test-asset-data'),
        filename: 'ebook.pdf',
        mimeType: 'application/pdf',
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
