import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { S3DigitalAssetStorageAdapter } from '../../../../src/api/infrastructure/adapters/s3DigitalAssetStorageAdapter'
import type { S3Client } from 'bun'

// Store original env values
const originalEnv = { ...process.env }

// Create a fake S3Client for testing
function createFakeS3Client(options?: { failDelete?: boolean }) {
  const uploadedFiles: Map<string, { buffer: ArrayBuffer; options: any }> = new Map()
  let listResponse: { contents: Array<{ key: string }> } = { contents: [] }

  const fakeFile = (key: string) => ({
    write: async (buffer: ArrayBuffer, options: any) => {
      uploadedFiles.set(key, { buffer, options })
      return Promise.resolve()
    },
    delete: async () => {
      if (options?.failDelete) {
        throw new Error('Delete failed')
      }
      uploadedFiles.delete(key)
      return Promise.resolve()
    },
  })

  const fakeClient = {
    file: fakeFile,
    list: async (opts: { prefix: string }) => {
      return Promise.resolve(listResponse)
    },
    // Test helpers
    _uploadedFiles: uploadedFiles,
    _setListResponse: (contents: Array<{ key: string }>) => {
      listResponse = { contents }
    },
  }

  return fakeClient as unknown as S3Client & {
    _uploadedFiles: Map<string, { buffer: ArrayBuffer; options: any }>
    _setListResponse: (contents: Array<{ key: string }>) => void
  }
}

describe('S3DigitalAssetStorageAdapter', () => {
  beforeEach(() => {
    // Clear AWS env vars before each test
    delete process.env.AWS_S3_BUCKET_NAME
    delete process.env.AWS_ACCESS_KEY_ID
    delete process.env.AWS_SECRET_ACCESS_KEY
    delete process.env.AWS_REGION
  })

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv }
  })

  describe('constructor without config', () => {
    test('throws error when AWS_S3_BUCKET_NAME is not set', () => {
      process.env.AWS_ACCESS_KEY_ID = 'test-access-key'
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key'

      expect(() => new S3DigitalAssetStorageAdapter()).toThrow(
        'AWS_S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY must be set'
      )
    })

    test('throws error when AWS_ACCESS_KEY_ID is not set', () => {
      process.env.AWS_S3_BUCKET_NAME = 'test-bucket'
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key'

      expect(() => new S3DigitalAssetStorageAdapter()).toThrow(
        'AWS_S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY must be set'
      )
    })

    test('throws error when AWS_SECRET_ACCESS_KEY is not set', () => {
      process.env.AWS_S3_BUCKET_NAME = 'test-bucket'
      process.env.AWS_ACCESS_KEY_ID = 'test-access-key'

      expect(() => new S3DigitalAssetStorageAdapter()).toThrow(
        'AWS_S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY must be set'
      )
    })

    test('throws error when all AWS credentials are missing', () => {
      expect(() => new S3DigitalAssetStorageAdapter()).toThrow(
        'AWS_S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY must be set'
      )
    })

    test('creates adapter from env vars with injected factory', () => {
      process.env.AWS_S3_BUCKET_NAME = 'test-bucket'
      process.env.AWS_ACCESS_KEY_ID = 'test-key'
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret'
      process.env.AWS_REGION = 'us-west-2'

      const fakeClient = createFakeS3Client()
      const adapter = new S3DigitalAssetStorageAdapter(undefined, () => fakeClient)

      expect(adapter).toBeDefined()
    })

    test('uses default region us-east-1 when AWS_REGION not set', () => {
      process.env.AWS_S3_BUCKET_NAME = 'test-bucket'
      process.env.AWS_ACCESS_KEY_ID = 'test-key'
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret'
      delete process.env.AWS_REGION

      let capturedConfig: any = null
      const fakeClient = createFakeS3Client()
      const adapter = new S3DigitalAssetStorageAdapter(undefined, (config) => {
        capturedConfig = config
        return fakeClient
      })

      expect(adapter).toBeDefined()
      expect(capturedConfig.region).toBe('us-east-1')
    })

    test('passes correct config to S3Client factory', () => {
      process.env.AWS_S3_BUCKET_NAME = 'my-bucket'
      process.env.AWS_ACCESS_KEY_ID = 'my-key'
      process.env.AWS_SECRET_ACCESS_KEY = 'my-secret'
      process.env.AWS_REGION = 'eu-west-1'

      let capturedConfig: any = null
      const fakeClient = createFakeS3Client()
      const adapter = new S3DigitalAssetStorageAdapter(undefined, (config) => {
        capturedConfig = config
        return fakeClient
      })

      expect(capturedConfig).toEqual({
        accessKeyId: 'my-key',
        secretAccessKey: 'my-secret',
        bucket: 'my-bucket',
        region: 'eu-west-1',
      })
    })

    test('uses default S3Client factory when no factory provided', () => {
      process.env.AWS_S3_BUCKET_NAME = 'test-bucket'
      process.env.AWS_ACCESS_KEY_ID = 'test-key'
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret'
      process.env.AWS_REGION = 'us-west-2'

      // Call constructor without factory - exercises the default (cfg) => new S3Client(cfg)
      const adapter = new S3DigitalAssetStorageAdapter()

      expect(adapter).toBeDefined()
    })
  })

  describe('with injected config', () => {
    test('uploadAsset uploads file to S3', async () => {
      const fakeClient = createFakeS3Client()
      const adapter = new S3DigitalAssetStorageAdapter({
        bucketName: 'test-bucket',
        region: 'us-west-2',
        s3Client: fakeClient,
      })

      const buffer = new ArrayBuffer(1024)
      const assetId = 'asset-123'
      const filename = 'document.pdf'
      const mimeType = 'application/pdf'

      // Act
      const result = await adapter.uploadAsset(buffer, assetId, filename, mimeType)

      // Assert
      expect(fakeClient._uploadedFiles.has(`digital-assets/${assetId}/${filename}`)).toBe(true)
      const uploaded = fakeClient._uploadedFiles.get(`digital-assets/${assetId}/${filename}`)
      expect(uploaded?.options.type).toBe(mimeType)

      expect(result.assetId).toBe(assetId)
      expect(result.filename).toBe(filename)
      expect(result.size).toBe(1024)
      expect(result.url).toBe(`/api/digital-assets/${assetId}/download`)
    })

    test('uploadAsset returns correct size for various buffer sizes', async () => {
      const fakeClient = createFakeS3Client()
      const adapter = new S3DigitalAssetStorageAdapter({
        bucketName: 'test-bucket',
        region: 'us-west-2',
        s3Client: fakeClient,
      })

      const testCases = [
        { size: 0, description: 'empty file' },
        { size: 1, description: 'single byte' },
        { size: 1024, description: '1KB' },
        { size: 1024 * 1024, description: '1MB' },
      ]

      for (const testCase of testCases) {
        const buffer = new ArrayBuffer(testCase.size)
        const result = await adapter.uploadAsset(buffer, `asset-${testCase.size}`, 'file.bin', 'application/octet-stream')
        expect(result.size).toBe(testCase.size)
      }
    })

    test('deleteAsset lists and deletes all files with prefix', async () => {
      const fakeClient = createFakeS3Client()
      const adapter = new S3DigitalAssetStorageAdapter({
        bucketName: 'test-bucket',
        region: 'us-west-2',
        s3Client: fakeClient,
      })

      // Set up list response
      fakeClient._setListResponse([
        { key: 'digital-assets/asset-123/document.pdf' },
        { key: 'digital-assets/asset-123/document-v2.pdf' },
      ])

      // Pre-populate files
      fakeClient._uploadedFiles.set('digital-assets/asset-123/document.pdf', { buffer: new ArrayBuffer(0), options: {} })
      fakeClient._uploadedFiles.set('digital-assets/asset-123/document-v2.pdf', { buffer: new ArrayBuffer(0), options: {} })

      // Act
      await adapter.deleteAsset('asset-123', 'document.pdf')

      // Assert
      expect(fakeClient._uploadedFiles.has('digital-assets/asset-123/document.pdf')).toBe(false)
      expect(fakeClient._uploadedFiles.has('digital-assets/asset-123/document-v2.pdf')).toBe(false)
    })

    test('deleteAsset handles empty contents', async () => {
      const fakeClient = createFakeS3Client()
      const adapter = new S3DigitalAssetStorageAdapter({
        bucketName: 'test-bucket',
        region: 'us-west-2',
        s3Client: fakeClient,
      })

      fakeClient._setListResponse([])

      // Act - should not throw
      await adapter.deleteAsset('non-existent-asset', 'file.pdf')

      // Assert - no errors
      expect(fakeClient._uploadedFiles.size).toBe(0)
    })

    test('deleteAsset ignores errors when delete fails', async () => {
      const fakeClient = createFakeS3Client({ failDelete: true })
      const adapter = new S3DigitalAssetStorageAdapter({
        bucketName: 'test-bucket',
        region: 'us-west-2',
        s3Client: fakeClient,
      })

      fakeClient._setListResponse([
        { key: 'digital-assets/asset-123/document.pdf' },
      ])

      // Act - should not throw even when delete fails
      await adapter.deleteAsset('asset-123', 'document.pdf')

      // Assert - no errors thrown, method completed
      expect(true).toBe(true)
    })

    test('getAssetUrl returns API endpoint', async () => {
      const fakeClient = createFakeS3Client()
      const adapter = new S3DigitalAssetStorageAdapter({
        bucketName: 'test-bucket',
        region: 'us-west-2',
        s3Client: fakeClient,
      })

      // Act
      const url = await adapter.getAssetUrl('asset-123', 'document.pdf')

      // Assert
      expect(url).toBe('/api/digital-assets/asset-123/download')
    })

    test('getS3File returns S3 file reference', async () => {
      const fakeClient = createFakeS3Client()
      const adapter = new S3DigitalAssetStorageAdapter({
        bucketName: 'test-bucket',
        region: 'us-west-2',
        s3Client: fakeClient,
      })

      // Act
      const file = adapter.getS3File('asset-123', 'document.pdf')

      // Assert
      expect(file).toBeDefined()
      expect(typeof file.write).toBe('function')
      expect(typeof file.delete).toBe('function')
    })

    test('getS3Key returns correct key path', async () => {
      const fakeClient = createFakeS3Client()
      const adapter = new S3DigitalAssetStorageAdapter({
        bucketName: 'test-bucket',
        region: 'us-west-2',
        s3Client: fakeClient,
      })

      // Act
      const key = adapter.getS3Key('asset-123', 'document.pdf')

      // Assert
      expect(key).toBe('digital-assets/asset-123/document.pdf')
    })

    test('uploadAsset works with different mime types', async () => {
      const fakeClient = createFakeS3Client()
      const adapter = new S3DigitalAssetStorageAdapter({
        bucketName: 'test-bucket',
        region: 'us-west-2',
        s3Client: fakeClient,
      })

      const testCases = [
        { filename: 'doc.pdf', mimeType: 'application/pdf' },
        { filename: 'image.png', mimeType: 'image/png' },
        { filename: 'archive.zip', mimeType: 'application/zip' },
        { filename: 'video.mp4', mimeType: 'video/mp4' },
        { filename: 'audio.mp3', mimeType: 'audio/mpeg' },
        { filename: 'data.json', mimeType: 'application/json' },
      ]

      for (const testCase of testCases) {
        const buffer = new ArrayBuffer(100)
        await adapter.uploadAsset(buffer, 'asset-id', testCase.filename, testCase.mimeType)
        const uploaded = fakeClient._uploadedFiles.get(`digital-assets/asset-id/${testCase.filename}`)
        expect(uploaded?.options.type).toBe(testCase.mimeType)
      }
    })

    test('isLocalStorage returns false', () => {
      const fakeClient = createFakeS3Client()
      const adapter = new S3DigitalAssetStorageAdapter({
        bucketName: 'test-bucket',
        region: 'us-west-2',
        s3Client: fakeClient,
      })

      expect(adapter.isLocalStorage()).toBe(false)
    })
  })
})
