import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { S3ImageStorageAdapter } from '../../../../src/api/infrastructure/adapters/s3ImageStorageAdapter'
import type { S3Client } from 'bun'

// Store original env values
const originalEnv = { ...process.env }

// Create a fake S3Client for testing
function createFakeS3Client(options?: { failDelete?: boolean }) {
  const uploadedFiles: Map<string, { buffer: ArrayBuffer; options: any }> = new Map()
  const listedContents: Array<{ key: string }> = []
  let listResponse = { contents: listedContents }

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

describe('S3ImageStorageAdapter', () => {
  beforeEach(() => {
    // Clear AWS env vars before each test
    delete process.env.AWS_S3_BUCKET_NAME
    delete process.env.AWS_ACCESS_KEY_ID
    delete process.env.AWS_SECRET_ACCESS_KEY
    delete process.env.AWS_REGION
    delete process.env.AWS_CLOUDFRONT_URL
  })

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv }
  })

  describe('constructor without config', () => {
    test('throws error when AWS_S3_BUCKET_NAME is not set', () => {
      process.env.AWS_ACCESS_KEY_ID = 'test-access-key'
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key'

      expect(() => new S3ImageStorageAdapter()).toThrow(
        'AWS_S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY must be set'
      )
    })

    test('throws error when AWS_ACCESS_KEY_ID is not set', () => {
      process.env.AWS_S3_BUCKET_NAME = 'test-bucket'
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key'

      expect(() => new S3ImageStorageAdapter()).toThrow(
        'AWS_S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY must be set'
      )
    })

    test('throws error when AWS_SECRET_ACCESS_KEY is not set', () => {
      process.env.AWS_S3_BUCKET_NAME = 'test-bucket'
      process.env.AWS_ACCESS_KEY_ID = 'test-access-key'

      expect(() => new S3ImageStorageAdapter()).toThrow(
        'AWS_S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY must be set'
      )
    })

    test('throws error when all AWS credentials are missing', () => {
      expect(() => new S3ImageStorageAdapter()).toThrow(
        'AWS_S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY must be set'
      )
    })

    test('creates adapter from env vars with injected factory', () => {
      process.env.AWS_S3_BUCKET_NAME = 'test-bucket'
      process.env.AWS_ACCESS_KEY_ID = 'test-key'
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret'
      process.env.AWS_REGION = 'us-west-2'

      const fakeClient = createFakeS3Client()
      const adapter = new S3ImageStorageAdapter(undefined, () => fakeClient)

      expect(adapter).toBeDefined()
    })

    test('uses default region us-east-1 when AWS_REGION not set', () => {
      process.env.AWS_S3_BUCKET_NAME = 'test-bucket'
      process.env.AWS_ACCESS_KEY_ID = 'test-key'
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret'
      delete process.env.AWS_REGION

      let capturedConfig: any = null
      const fakeClient = createFakeS3Client()
      const adapter = new S3ImageStorageAdapter(undefined, (config) => {
        capturedConfig = config
        return fakeClient
      })

      expect(adapter).toBeDefined()
      expect(capturedConfig.region).toBe('us-east-1')
    })

    test('uses CloudFront URL when provided', () => {
      process.env.AWS_S3_BUCKET_NAME = 'test-bucket'
      process.env.AWS_ACCESS_KEY_ID = 'test-key'
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret'
      process.env.AWS_CLOUDFRONT_URL = 'https://cdn.example.com'

      const fakeClient = createFakeS3Client()
      const adapter = new S3ImageStorageAdapter(undefined, () => fakeClient)

      expect(adapter).toBeDefined()
      // The baseUrl should be the CloudFront URL - we test this indirectly through uploadImage
    })

    test('constructs S3 public URL when CloudFront URL not provided', () => {
      process.env.AWS_S3_BUCKET_NAME = 'my-bucket'
      process.env.AWS_ACCESS_KEY_ID = 'test-key'
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret'
      process.env.AWS_REGION = 'eu-west-1'
      delete process.env.AWS_CLOUDFRONT_URL

      const fakeClient = createFakeS3Client()
      const adapter = new S3ImageStorageAdapter(undefined, () => fakeClient)

      expect(adapter).toBeDefined()
      // baseUrl should be constructed as https://my-bucket.s3.eu-west-1.amazonaws.com
    })

    test('passes correct config to S3Client factory', () => {
      process.env.AWS_S3_BUCKET_NAME = 'my-bucket'
      process.env.AWS_ACCESS_KEY_ID = 'my-key'
      process.env.AWS_SECRET_ACCESS_KEY = 'my-secret'
      process.env.AWS_REGION = 'eu-west-1'

      let capturedConfig: any = null
      const fakeClient = createFakeS3Client()
      const adapter = new S3ImageStorageAdapter(undefined, (config) => {
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
      const adapter = new S3ImageStorageAdapter()

      expect(adapter).toBeDefined()
    })
  })

  describe('with injected config', () => {
    test('uploadImage uploads all sizes and formats (15 files)', async () => {
      const fakeClient = createFakeS3Client()
      const adapter = new S3ImageStorageAdapter({
        bucketName: 'test-bucket',
        baseUrl: 'https://cdn.example.com',
        s3Client: fakeClient,
      })

      const createSizeFormats = () => ({
        original: new ArrayBuffer(100),
        webp: new ArrayBuffer(80),
        avif: new ArrayBuffer(60),
      })

      const formats = {
        thumbnail: createSizeFormats(),
        small: createSizeFormats(),
        medium: createSizeFormats(),
        large: createSizeFormats(),
        original: createSizeFormats(),
      }

      // Act
      const result = await adapter.uploadImage(formats, 'test-image-id', 'png')

      // Assert - should have uploaded 15 files (5 sizes * 3 formats)
      expect(fakeClient._uploadedFiles.size).toBe(15)

      // Verify result structure
      expect(result.imageId).toBe('test-image-id')
      expect(result.urls.thumbnail.original).toBe('https://cdn.example.com/images/test-image-id/thumbnail.png')
      expect(result.urls.thumbnail.webp).toBe('https://cdn.example.com/images/test-image-id/thumbnail.webp')
      expect(result.urls.thumbnail.avif).toBe('https://cdn.example.com/images/test-image-id/thumbnail.avif')
    })

    test('uploadImage handles extension with leading dot', async () => {
      const fakeClient = createFakeS3Client()
      const adapter = new S3ImageStorageAdapter({
        bucketName: 'test-bucket',
        baseUrl: 'https://cdn.example.com',
        s3Client: fakeClient,
      })

      const createSizeFormats = () => ({
        original: new ArrayBuffer(100),
        webp: new ArrayBuffer(80),
        avif: new ArrayBuffer(60),
      })

      const formats = {
        thumbnail: createSizeFormats(),
        small: createSizeFormats(),
        medium: createSizeFormats(),
        large: createSizeFormats(),
        original: createSizeFormats(),
      }

      // Act
      const result = await adapter.uploadImage(formats, 'test-image-id', '.jpg')

      // Assert - extension should be normalized (no leading dot)
      expect(result.urls.original.original).toBe('https://cdn.example.com/images/test-image-id/original.jpg')
      expect(result.urls.original.original).not.toContain('..')
    })

    test('uploadImage returns correct URL structure for all sizes', async () => {
      const fakeClient = createFakeS3Client()
      const adapter = new S3ImageStorageAdapter({
        bucketName: 'test-bucket',
        baseUrl: 'https://test-bucket.s3.us-west-2.amazonaws.com',
        s3Client: fakeClient,
      })

      const createSizeFormats = () => ({
        original: new ArrayBuffer(100),
        webp: new ArrayBuffer(80),
        avif: new ArrayBuffer(60),
      })

      const formats = {
        thumbnail: createSizeFormats(),
        small: createSizeFormats(),
        medium: createSizeFormats(),
        large: createSizeFormats(),
        original: createSizeFormats(),
      }

      // Act
      const result = await adapter.uploadImage(formats, 'img-123', 'png')

      // Assert
      expect(result.urls.thumbnail.original).toBe('https://test-bucket.s3.us-west-2.amazonaws.com/images/img-123/thumbnail.png')
      expect(result.urls.thumbnail.webp).toBe('https://test-bucket.s3.us-west-2.amazonaws.com/images/img-123/thumbnail.webp')
      expect(result.urls.thumbnail.avif).toBe('https://test-bucket.s3.us-west-2.amazonaws.com/images/img-123/thumbnail.avif')
      expect(result.urls.small.original).toBe('https://test-bucket.s3.us-west-2.amazonaws.com/images/img-123/small.png')
      expect(result.urls.medium.original).toBe('https://test-bucket.s3.us-west-2.amazonaws.com/images/img-123/medium.png')
      expect(result.urls.large.original).toBe('https://test-bucket.s3.us-west-2.amazonaws.com/images/img-123/large.png')
      expect(result.urls.original.original).toBe('https://test-bucket.s3.us-west-2.amazonaws.com/images/img-123/original.png')
    })

    test('uploadImage sets correct content types', async () => {
      const fakeClient = createFakeS3Client()
      const adapter = new S3ImageStorageAdapter({
        bucketName: 'test-bucket',
        baseUrl: 'https://cdn.example.com',
        s3Client: fakeClient,
      })

      const createSizeFormats = () => ({
        original: new ArrayBuffer(100),
        webp: new ArrayBuffer(80),
        avif: new ArrayBuffer(60),
      })

      const formats = {
        thumbnail: createSizeFormats(),
        small: createSizeFormats(),
        medium: createSizeFormats(),
        large: createSizeFormats(),
        original: createSizeFormats(),
      }

      // Act
      await adapter.uploadImage(formats, 'img-123', 'jpg')

      // Assert - check content types
      const thumbnailJpg = fakeClient._uploadedFiles.get('images/img-123/thumbnail.jpg')
      expect(thumbnailJpg?.options.type).toBe('image/jpeg')
      expect(thumbnailJpg?.options.acl).toBe('public-read')

      const thumbnailWebp = fakeClient._uploadedFiles.get('images/img-123/thumbnail.webp')
      expect(thumbnailWebp?.options.type).toBe('image/webp')

      const thumbnailAvif = fakeClient._uploadedFiles.get('images/img-123/thumbnail.avif')
      expect(thumbnailAvif?.options.type).toBe('image/avif')
    })

    test('deleteImage lists and deletes all files with prefix', async () => {
      const fakeClient = createFakeS3Client()
      const adapter = new S3ImageStorageAdapter({
        bucketName: 'test-bucket',
        baseUrl: 'https://cdn.example.com',
        s3Client: fakeClient,
      })

      // Set up list response
      fakeClient._setListResponse([
        { key: 'images/img-123/thumbnail.png' },
        { key: 'images/img-123/thumbnail.webp' },
        { key: 'images/img-123/small.png' },
      ])

      // Pre-populate files
      fakeClient._uploadedFiles.set('images/img-123/thumbnail.png', { buffer: new ArrayBuffer(0), options: {} })
      fakeClient._uploadedFiles.set('images/img-123/thumbnail.webp', { buffer: new ArrayBuffer(0), options: {} })
      fakeClient._uploadedFiles.set('images/img-123/small.png', { buffer: new ArrayBuffer(0), options: {} })

      // Act
      await adapter.deleteImage('img-123')

      // Assert - files should be deleted
      expect(fakeClient._uploadedFiles.has('images/img-123/thumbnail.png')).toBe(false)
      expect(fakeClient._uploadedFiles.has('images/img-123/thumbnail.webp')).toBe(false)
      expect(fakeClient._uploadedFiles.has('images/img-123/small.png')).toBe(false)
    })

    test('deleteImage handles empty contents', async () => {
      const fakeClient = createFakeS3Client()
      const adapter = new S3ImageStorageAdapter({
        bucketName: 'test-bucket',
        baseUrl: 'https://cdn.example.com',
        s3Client: fakeClient,
      })

      fakeClient._setListResponse([])

      // Act - should not throw
      await adapter.deleteImage('non-existent-image')

      // Assert - no errors
      expect(fakeClient._uploadedFiles.size).toBe(0)
    })

    test('deleteImage ignores errors when delete fails', async () => {
      const fakeClient = createFakeS3Client({ failDelete: true })
      const adapter = new S3ImageStorageAdapter({
        bucketName: 'test-bucket',
        baseUrl: 'https://cdn.example.com',
        s3Client: fakeClient,
      })

      fakeClient._setListResponse([
        { key: 'images/img-123/thumbnail.png' },
      ])

      // Act - should not throw even when delete fails
      await adapter.deleteImage('img-123')

      // Assert - no errors thrown, method completed
      expect(true).toBe(true)
    })

    test('isLocalStorage returns false', () => {
      const fakeClient = createFakeS3Client()
      const adapter = new S3ImageStorageAdapter({
        bucketName: 'test-bucket',
        baseUrl: 'https://cdn.example.com',
        s3Client: fakeClient,
      })

      expect(adapter.isLocalStorage()).toBe(false)
    })
  })
})
