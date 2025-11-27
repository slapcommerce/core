import { describe, test, expect } from 'bun:test'
import { LocalDigitalAssetStorageAdapter } from '../../../../src/api/infrastructure/adapters/localDigitalAssetStorageAdapter'
import { rm, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

// Helper to generate unique test storage path for isolation
function getTestStoragePath() {
  return `./storage/test-digital-assets-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

describe('LocalDigitalAssetStorageAdapter', () => {
  describe('uploadAsset', () => {
    test('creates directory and file for uploaded asset', async () => {
      // Arrange
      const storagePath = getTestStoragePath()
      const adapter = new LocalDigitalAssetStorageAdapter(storagePath)
      const assetId = 'asset-123'
      const filename = 'test-file.pdf'
      const mimeType = 'application/pdf'
      const fileContent = new TextEncoder().encode('test file content')
      const file = fileContent.buffer as ArrayBuffer

      try {
        // Act
        const result = await adapter.uploadAsset(file, assetId, filename, mimeType)

        // Assert
        expect(result.assetId).toBe(assetId)
        expect(result.filename).toBe(filename)
        expect(result.size).toBe(fileContent.length)
        expect(result.url).toBe(`/storage/digital-assets/${assetId}/${filename}`)

        // Verify file exists
        const filePath = join(storagePath, assetId, filename)
        const savedFile = Bun.file(filePath)
        expect(await savedFile.exists()).toBe(true)
      } finally {
        await rm(storagePath, { recursive: true, force: true }).catch(() => {})
      }
    })

    test('returns correct result with URL, filename, and size', async () => {
      // Arrange
      const storagePath = getTestStoragePath()
      const adapter = new LocalDigitalAssetStorageAdapter(storagePath)
      const assetId = 'asset-456'
      const filename = 'document.docx'
      const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      const content = new Uint8Array(1000) // 1000 bytes
      const file = content.buffer as ArrayBuffer

      try {
        // Act
        const result = await adapter.uploadAsset(file, assetId, filename, mimeType)

        // Assert
        expect(result).toEqual({
          assetId: 'asset-456',
          url: '/storage/digital-assets/asset-456/document.docx',
          filename: 'document.docx',
          size: 1000,
        })
      } finally {
        await rm(storagePath, { recursive: true, force: true }).catch(() => {})
      }
    })

    test('handles binary file content', async () => {
      // Arrange
      const storagePath = getTestStoragePath()
      const adapter = new LocalDigitalAssetStorageAdapter(storagePath)
      const assetId = 'asset-binary'
      const filename = 'image.png'
      const mimeType = 'image/png'
      const binaryContent = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
      const file = binaryContent.buffer as ArrayBuffer

      try {
        // Act
        const result = await adapter.uploadAsset(file, assetId, filename, mimeType)

        // Assert
        expect(result.size).toBe(8)
        const filePath = join(storagePath, assetId, filename)
        const savedFile = Bun.file(filePath)
        const savedContent = new Uint8Array(await savedFile.arrayBuffer())
        expect(savedContent).toEqual(binaryContent)
      } finally {
        await rm(storagePath, { recursive: true, force: true }).catch(() => {})
      }
    })
  })

  describe('deleteAsset', () => {
    test('removes asset directory', async () => {
      // Arrange
      const storagePath = getTestStoragePath()
      const adapter = new LocalDigitalAssetStorageAdapter(storagePath)
      const assetId = 'asset-to-delete'
      const filename = 'file.txt'
      const file = new TextEncoder().encode('content').buffer as ArrayBuffer

      try {
        // First upload an asset
        await adapter.uploadAsset(file, assetId, filename, 'text/plain')

        // Verify it exists
        const assetDir = join(storagePath, assetId)
        const dirExists = await Bun.file(join(assetDir, filename)).exists()
        expect(dirExists).toBe(true)

        // Act
        await adapter.deleteAsset(assetId, filename)

        // Assert - directory should be removed
        const fileAfterDelete = Bun.file(join(assetDir, filename))
        expect(await fileAfterDelete.exists()).toBe(false)
      } finally {
        await rm(storagePath, { recursive: true, force: true }).catch(() => {})
      }
    })

    test('handles non-existent asset gracefully (ENOENT)', async () => {
      // Arrange
      const storagePath = getTestStoragePath()
      const adapter = new LocalDigitalAssetStorageAdapter(storagePath)
      const nonExistentAssetId = 'non-existent-asset-' + Date.now()

      try {
        // Act & Assert - should not throw
        await expect(adapter.deleteAsset(nonExistentAssetId, 'file.txt')).resolves.toBeUndefined()
      } finally {
        await rm(storagePath, { recursive: true, force: true }).catch(() => {})
      }
    })

    test('removes entire asset directory including multiple files', async () => {
      // Arrange
      const storagePath = getTestStoragePath()
      const adapter = new LocalDigitalAssetStorageAdapter(storagePath)
      const assetId = 'asset-multi-file'

      try {
        // Manually create directory with multiple files
        const assetDir = join(storagePath, assetId)
        await mkdir(assetDir, { recursive: true })
        await Bun.write(join(assetDir, 'file1.txt'), 'content1')
        await Bun.write(join(assetDir, 'file2.txt'), 'content2')

        // Act
        await adapter.deleteAsset(assetId, 'file1.txt')

        // Assert - entire directory should be gone
        expect(await Bun.file(join(assetDir, 'file1.txt')).exists()).toBe(false)
        expect(await Bun.file(join(assetDir, 'file2.txt')).exists()).toBe(false)
      } finally {
        await rm(storagePath, { recursive: true, force: true }).catch(() => {})
      }
    })
  })

  describe('getAssetUrl', () => {
    test('returns correct URL format', async () => {
      // Arrange
      const storagePath = getTestStoragePath()
      const adapter = new LocalDigitalAssetStorageAdapter(storagePath)
      const assetId = 'asset-url-test'
      const filename = 'document.pdf'

      // Act
      const url = await adapter.getAssetUrl(assetId, filename)

      // Assert
      expect(url).toBe('/storage/digital-assets/asset-url-test/document.pdf')
    })

    test('returns URL without requiring file to exist', async () => {
      // Arrange
      const storagePath = getTestStoragePath()
      const adapter = new LocalDigitalAssetStorageAdapter(storagePath)
      const assetId = 'non-existent-asset'
      const filename = 'missing-file.pdf'

      // Act
      const url = await adapter.getAssetUrl(assetId, filename)

      // Assert
      expect(url).toBe('/storage/digital-assets/non-existent-asset/missing-file.pdf')
    })

    test('handles special characters in filename', async () => {
      // Arrange
      const storagePath = getTestStoragePath()
      const adapter = new LocalDigitalAssetStorageAdapter(storagePath)
      const assetId = 'asset-special'
      const filename = 'file with spaces.pdf'

      // Act
      const url = await adapter.getAssetUrl(assetId, filename)

      // Assert
      expect(url).toBe('/storage/digital-assets/asset-special/file with spaces.pdf')
    })
  })

  describe('constructor', () => {
    test('uses default storage path when not provided', async () => {
      // Arrange & Act
      const adapter = new LocalDigitalAssetStorageAdapter()

      // Assert - check URL format uses default path
      const url = await adapter.getAssetUrl('test', 'file.txt')
      expect(url).toBe('/storage/digital-assets/test/file.txt')
    })

    test('uses custom storage path when provided', async () => {
      // Arrange & Act
      const customPath = getTestStoragePath()
      const adapter = new LocalDigitalAssetStorageAdapter(customPath)

      try {
        // Assert - upload should work with custom path
        const file = new TextEncoder().encode('test').buffer as ArrayBuffer
        const result = await adapter.uploadAsset(file, 'asset-custom', 'test.txt', 'text/plain')

        expect(result.url).toBe('/storage/digital-assets/asset-custom/test.txt')
      } finally {
        await rm(customPath, { recursive: true, force: true }).catch(() => {})
      }
    })
  })
})
