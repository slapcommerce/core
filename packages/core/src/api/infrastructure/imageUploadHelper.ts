import type { ImageStorageAdapter, ImageUploadResult } from "./adapters/imageStorageAdapter";
import type { ImageOptimizer } from "./imageOptimizer";
import { randomUUIDv7 } from "bun";
import path from "path";

const MAX_IMAGE_SIZE = parseInt(process.env.MAX_IMAGE_SIZE || "10485760", 10); // 10MB default

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
];

export class ImageUploadHelper {
  constructor(
    private imageStorageAdapter: ImageStorageAdapter,
    private imageOptimizer: ImageOptimizer
  ) {}

  async uploadImage(
    buffer: ArrayBuffer,
    filename: string,
    contentType: string
  ): Promise<ImageUploadResult> {
    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(contentType.toLowerCase())) {
      throw new Error(
        `Invalid file type: ${contentType}. Allowed types: ${ALLOWED_IMAGE_TYPES.join(", ")}`
      );
    }

    // Validate file size
    if (buffer.byteLength > MAX_IMAGE_SIZE) {
      throw new Error(
        `File size exceeds maximum allowed size of ${MAX_IMAGE_SIZE} bytes`
      );
    }

    // Generate unique image ID
    const imageId = randomUUIDv7();

    // Get original file extension from filename
    const originalExtension = path.extname(filename) || this.getExtensionFromContentType(contentType);

    // Optimize image into multiple formats
    const formats = await this.imageOptimizer.optimizeImage(buffer, contentType);

    // Upload all formats using the adapter
    const result = await this.imageStorageAdapter.uploadImage(
      formats,
      imageId,
      originalExtension
    );

    return result;
  }

  private getExtensionFromContentType(contentType: string): string {
    const mapping: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/avif": "avif",
      "image/gif": "gif",
    };

    return mapping[contentType.toLowerCase()] || "jpg";
  }
}

