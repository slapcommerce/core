import type { ImageFormats, ImageStorageAdapter, ImageUploadResult } from "./imageStorageAdapter";
import { S3Client } from "bun";

export interface S3ImageStorageConfig {
  bucketName: string;
  baseUrl: string;
  s3Client: S3Client;
}

export interface S3ImageClientConfig {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region: string;
}

export type S3ImageClientFactory = (config: S3ImageClientConfig) => S3Client;

export class S3ImageStorageAdapter implements ImageStorageAdapter {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly baseUrl: string;

  constructor(
    config?: S3ImageStorageConfig,
    s3ClientFactory: S3ImageClientFactory = (cfg) => new S3Client(cfg)
  ) {
    if (config) {
      // Use injected config (for testing)
      this.bucketName = config.bucketName;
      this.s3Client = config.s3Client;
      this.baseUrl = config.baseUrl;
    } else {
      // Use environment variables (production)
      const bucketName = process.env.AWS_S3_BUCKET_NAME;
      const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
      const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
      const region = process.env.AWS_REGION || "us-east-1";
      const cloudFrontUrl = process.env.AWS_CLOUDFRONT_URL;

      if (!bucketName || !accessKeyId || !secretAccessKey) {
        throw new Error(
          "AWS_S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY must be set"
        );
      }

      this.bucketName = bucketName;
      this.s3Client = s3ClientFactory({
        accessKeyId,
        secretAccessKey,
        bucket: bucketName,
        region,
      });

      // Use CloudFront URL if provided, otherwise construct S3 public URL
      this.baseUrl = cloudFrontUrl || `https://${bucketName}.s3.${region}.amazonaws.com`;
    }
  }

  async uploadImage(
    formats: ImageFormats,
    imageId: string,
    originalExtension: string
  ): Promise<ImageUploadResult> {
    const ext = originalExtension.startsWith(".")
      ? originalExtension.slice(1)
      : originalExtension;

    // Upload all sizes and formats (5 sizes × 3 formats = 15 files)
    const uploadPromises: Promise<void>[] = [];
    const sizes = ["thumbnail", "small", "medium", "large", "original"] as const;

    for (const size of sizes) {
      const sizeFormats = formats[size];
      uploadPromises.push(
        this.uploadToS3(
          sizeFormats.original,
          `images/${imageId}/${size}.${ext}`,
          `image/${ext === "jpg" ? "jpeg" : ext}`
        ),
        this.uploadToS3(
          sizeFormats.webp,
          `images/${imageId}/${size}.webp`,
          "image/webp"
        ),
        this.uploadToS3(
          sizeFormats.avif,
          `images/${imageId}/${size}.avif`,
          "image/avif"
        )
      );
    }

    await Promise.all(uploadPromises);

    return {
      imageId,
      urls: {
        thumbnail: {
          original: `${this.baseUrl}/images/${imageId}/thumbnail.${ext}`,
          webp: `${this.baseUrl}/images/${imageId}/thumbnail.webp`,
          avif: `${this.baseUrl}/images/${imageId}/thumbnail.avif`,
        },
        small: {
          original: `${this.baseUrl}/images/${imageId}/small.${ext}`,
          webp: `${this.baseUrl}/images/${imageId}/small.webp`,
          avif: `${this.baseUrl}/images/${imageId}/small.avif`,
        },
        medium: {
          original: `${this.baseUrl}/images/${imageId}/medium.${ext}`,
          webp: `${this.baseUrl}/images/${imageId}/medium.webp`,
          avif: `${this.baseUrl}/images/${imageId}/medium.avif`,
        },
        large: {
          original: `${this.baseUrl}/images/${imageId}/large.${ext}`,
          webp: `${this.baseUrl}/images/${imageId}/large.webp`,
          avif: `${this.baseUrl}/images/${imageId}/large.avif`,
        },
        original: {
          original: `${this.baseUrl}/images/${imageId}/original.${ext}`,
          webp: `${this.baseUrl}/images/${imageId}/original.webp`,
          avif: `${this.baseUrl}/images/${imageId}/original.avif`,
        },
      },
    };
  }

  private async uploadToS3(
    buffer: ArrayBuffer,
    key: string,
    contentType: string
  ): Promise<void> {
    await this.s3Client.file(key).write(buffer, {
      type: contentType,
      acl: "public-read",
    });
  }

  async deleteImage(imageId: string): Promise<void> {
    // List all files with the imageId prefix
    const prefix = `images/${imageId}/`;
    const response = await this.s3Client.list({ prefix });

    // Delete all files found
    const deletePromises = (response.contents || []).map((obj) =>
      this.s3Client.file(obj.key).delete().catch(() => {
        // Ignore errors for files that don't exist or were already deleted
      })
    );

    await Promise.all(deletePromises);
  }
}

