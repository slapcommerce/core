import { describe, test, expect } from 'bun:test'
import { DigitalAssetUploadHelper } from '../../../src/api/infrastructure/digitalAssetUploadHelper'
import type { DigitalAssetStorageAdapter, DigitalAssetUploadResult } from '../../../src/api/infrastructure/adapters/digitalAssetStorageAdapter'

// Mock storage adapter for testing
class MockDigitalAssetStorageAdapter implements DigitalAssetStorageAdapter {
  uploadedAssets: Array<{
    file: ArrayBuffer
    assetId: string
    filename: string
    mimeType: string
  }> = []

  async uploadAsset(
    file: ArrayBuffer,
    assetId: string,
    filename: string,
    mimeType: string
  ): Promise<DigitalAssetUploadResult> {
    this.uploadedAssets.push({ file, assetId, filename, mimeType })
    return {
      assetId,
      url: `/api/digital-assets/${assetId}/download`,
      filename,
      size: file.byteLength,
    }
  }

  async deleteAsset(assetId: string, filename: string): Promise<void> {
    // Not needed for helper tests
  }

  async getAssetUrl(assetId: string, filename: string): Promise<string> {
    return `/api/digital-assets/${assetId}/download`
  }
}

describe('DigitalAssetUploadHelper', () => {
  describe('uploadAsset', () => {
    test('generates unique UUID for asset', async () => {
      // Arrange
      const mockAdapter = new MockDigitalAssetStorageAdapter()
      const helper = new DigitalAssetUploadHelper(mockAdapter)
      const buffer = new ArrayBuffer(100)
      const filename = 'test-file.pdf'
      const mimeType = 'application/pdf'

      // Act
      const result = await helper.uploadAsset(buffer, filename, mimeType)

      // Assert
      expect(result.assetId).toBeDefined()
      expect(result.assetId).toMatch(/^[0-9a-f-]+$/i) // UUID format
      expect(result.assetId.length).toBeGreaterThan(30) // UUIDs are 36 chars
    })

    test('generates different UUIDs for multiple uploads', async () => {
      // Arrange
      const mockAdapter = new MockDigitalAssetStorageAdapter()
      const helper = new DigitalAssetUploadHelper(mockAdapter)
      const buffer = new ArrayBuffer(100)
      const filename = 'test-file.pdf'
      const mimeType = 'application/pdf'

      // Act
      const result1 = await helper.uploadAsset(buffer, filename, mimeType)
      const result2 = await helper.uploadAsset(buffer, filename, mimeType)

      // Assert
      expect(result1.assetId).not.toBe(result2.assetId)
    })

    test('passes buffer to storage adapter', async () => {
      // Arrange
      const mockAdapter = new MockDigitalAssetStorageAdapter()
      const helper = new DigitalAssetUploadHelper(mockAdapter)
      const buffer = new ArrayBuffer(256)
      const filename = 'test-file.pdf'
      const mimeType = 'application/pdf'

      // Act
      await helper.uploadAsset(buffer, filename, mimeType)

      // Assert
      expect(mockAdapter.uploadedAssets).toHaveLength(1)
      expect(mockAdapter.uploadedAssets[0].file.byteLength).toBe(256)
    })

    test('passes filename to storage adapter', async () => {
      // Arrange
      const mockAdapter = new MockDigitalAssetStorageAdapter()
      const helper = new DigitalAssetUploadHelper(mockAdapter)
      const buffer = new ArrayBuffer(100)
      const filename = 'my-document.pdf'
      const mimeType = 'application/pdf'

      // Act
      await helper.uploadAsset(buffer, filename, mimeType)

      // Assert
      expect(mockAdapter.uploadedAssets[0].filename).toBe('my-document.pdf')
    })

    test('passes mimeType to storage adapter', async () => {
      // Arrange
      const mockAdapter = new MockDigitalAssetStorageAdapter()
      const helper = new DigitalAssetUploadHelper(mockAdapter)
      const buffer = new ArrayBuffer(100)
      const filename = 'test-file.zip'
      const mimeType = 'application/zip'

      // Act
      await helper.uploadAsset(buffer, filename, mimeType)

      // Assert
      expect(mockAdapter.uploadedAssets[0].mimeType).toBe('application/zip')
    })

    test('returns result from storage adapter', async () => {
      // Arrange
      const mockAdapter = new MockDigitalAssetStorageAdapter()
      const helper = new DigitalAssetUploadHelper(mockAdapter)
      const buffer = new ArrayBuffer(500)
      const filename = 'test-file.pdf'
      const mimeType = 'application/pdf'

      // Act
      const result = await helper.uploadAsset(buffer, filename, mimeType)

      // Assert
      expect(result.filename).toBe(filename)
      expect(result.size).toBe(500)
      expect(result.url).toContain(result.assetId)
    })

    test('works with different file types', async () => {
      // Arrange
      const mockAdapter = new MockDigitalAssetStorageAdapter()
      const helper = new DigitalAssetUploadHelper(mockAdapter)

      const testCases = [
        { filename: 'document.pdf', mimeType: 'application/pdf' },
        { filename: 'image.png', mimeType: 'image/png' },
        { filename: 'archive.zip', mimeType: 'application/zip' },
        { filename: 'video.mp4', mimeType: 'video/mp4' },
        { filename: 'audio.mp3', mimeType: 'audio/mpeg' },
      ]

      // Act & Assert
      for (const testCase of testCases) {
        const buffer = new ArrayBuffer(100)
        const result = await helper.uploadAsset(buffer, testCase.filename, testCase.mimeType)
        expect(result.filename).toBe(testCase.filename)
      }

      expect(mockAdapter.uploadedAssets).toHaveLength(5)
    })

    test('handles empty buffer', async () => {
      // Arrange
      const mockAdapter = new MockDigitalAssetStorageAdapter()
      const helper = new DigitalAssetUploadHelper(mockAdapter)
      const buffer = new ArrayBuffer(0)
      const filename = 'empty-file.txt'
      const mimeType = 'text/plain'

      // Act
      const result = await helper.uploadAsset(buffer, filename, mimeType)

      // Assert
      expect(result.size).toBe(0)
      expect(result.assetId).toBeDefined()
    })

    test('handles large buffer', async () => {
      // Arrange
      const mockAdapter = new MockDigitalAssetStorageAdapter()
      const helper = new DigitalAssetUploadHelper(mockAdapter)
      const buffer = new ArrayBuffer(10 * 1024 * 1024) // 10MB
      const filename = 'large-file.zip'
      const mimeType = 'application/zip'

      // Act
      const result = await helper.uploadAsset(buffer, filename, mimeType)

      // Assert
      expect(result.size).toBe(10 * 1024 * 1024)
      expect(result.assetId).toBeDefined()
    })
  })
})
