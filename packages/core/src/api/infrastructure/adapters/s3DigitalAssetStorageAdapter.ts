import type {
  DigitalAssetStorageAdapter,
  DigitalAssetUploadResult,
} from "./digitalAssetStorageAdapter"
import { S3Client } from "bun"

export class S3DigitalAssetStorageAdapter
  implements DigitalAssetStorageAdapter
{
  private readonly s3Client: S3Client
  private readonly bucketName: string
  private readonly region: string

  constructor() {
    const bucketName = process.env.AWS_S3_BUCKET_NAME
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
    const region = process.env.AWS_REGION || "us-east-1"

    if (!bucketName || !accessKeyId || !secretAccessKey) {
      throw new Error(
        "AWS_S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY must be set"
      )
    }

    this.bucketName = bucketName
    this.region = region

    this.s3Client = new S3Client({
      accessKeyId,
      secretAccessKey,
      bucket: bucketName,
      region,
    })
  }

  async uploadAsset(
    file: ArrayBuffer,
    assetId: string,
    filename: string,
    mimeType: string
  ): Promise<DigitalAssetUploadResult> {
    const key = `digital-assets/${assetId}/${filename}`

    // Upload to S3 - files are private by default with Bun S3Client
    await this.s3Client.file(key).write(file, {
      type: mimeType,
    })

    // Get file size
    const size = file.byteLength

    // Return the S3 key as the URL - will be resolved through API endpoint
    // The API will generate signed URLs on-demand for authenticated admins
    const url = `/api/digital-assets/${assetId}/download`

    return {
      assetId,
      url,
      filename,
      size,
    }
  }

  async deleteAsset(assetId: string, filename: string): Promise<void> {
    // List all files with the assetId prefix
    const prefix = `digital-assets/${assetId}/`
    const response = await this.s3Client.list({ prefix })

    // Delete all files found
    const deletePromises = (response.contents || []).map((obj) =>
      this.s3Client
        .file(obj.key)
        .delete()
        .catch(() => {
          // Ignore errors for files that don't exist or were already deleted
        })
    )

    await Promise.all(deletePromises)
  }

  async getAssetUrl(assetId: string, filename: string): Promise<string> {
    // Return API endpoint that will generate signed URL on-demand
    return `/api/digital-assets/${assetId}/download`
  }

  // Helper method to get the actual S3 file for generating signed URLs
  // This will be used by the API endpoint
  getS3File(assetId: string, filename: string) {
    const key = `digital-assets/${assetId}/${filename}`
    return this.s3Client.file(key)
  }

  getS3Key(assetId: string, filename: string): string {
    return `digital-assets/${assetId}/${filename}`
  }
}
