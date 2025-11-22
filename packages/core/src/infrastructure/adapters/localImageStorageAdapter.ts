import type { ImageFormats, ImageStorageAdapter, ImageUploadResult } from "./imageStorageAdapter";
import { mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export class LocalImageStorageAdapter implements ImageStorageAdapter {
  private readonly storagePath: string;

  constructor(storagePath: string = "./storage/images") {
    this.storagePath = storagePath;
  }

  async uploadImage(
    formats: ImageFormats,
    imageId: string,
    originalExtension: string
  ): Promise<ImageUploadResult> {
    const imageDir = path.join(this.storagePath, imageId);

    // Create directory if it doesn't exist
    if (!existsSync(imageDir)) {
      await mkdir(imageDir, { recursive: true });
    }

    // Determine original file extension (remove leading dot if present)
    const ext = originalExtension.startsWith(".") 
      ? originalExtension.slice(1) 
      : originalExtension;

    // Upload all sizes and formats (5 sizes × 3 formats = 15 files)
    const uploadPromises: Promise<void>[] = [];
    const sizes = ["thumbnail", "small", "medium", "large", "original"] as const;

    for (const size of sizes) {
      const sizeFormats = formats[size];
      uploadPromises.push(
        Bun.write(path.join(imageDir, `${size}.${ext}`), sizeFormats.original).then(() => undefined),
        Bun.write(path.join(imageDir, `${size}.webp`), sizeFormats.webp).then(() => undefined),
        Bun.write(path.join(imageDir, `${size}.avif`), sizeFormats.avif).then(() => undefined)
      );
    }

    await Promise.all(uploadPromises);

    // Return URLs (relative paths that will be served by the static route)
    return {
      imageId,
      urls: {
        thumbnail: {
          original: `/storage/images/${imageId}/thumbnail.${ext}`,
          webp: `/storage/images/${imageId}/thumbnail.webp`,
          avif: `/storage/images/${imageId}/thumbnail.avif`,
        },
        small: {
          original: `/storage/images/${imageId}/small.${ext}`,
          webp: `/storage/images/${imageId}/small.webp`,
          avif: `/storage/images/${imageId}/small.avif`,
        },
        medium: {
          original: `/storage/images/${imageId}/medium.${ext}`,
          webp: `/storage/images/${imageId}/medium.webp`,
          avif: `/storage/images/${imageId}/medium.avif`,
        },
        large: {
          original: `/storage/images/${imageId}/large.${ext}`,
          webp: `/storage/images/${imageId}/large.webp`,
          avif: `/storage/images/${imageId}/large.avif`,
        },
        original: {
          original: `/storage/images/${imageId}/original.${ext}`,
          webp: `/storage/images/${imageId}/original.webp`,
          avif: `/storage/images/${imageId}/original.avif`,
        },
      },
    };
  }

  async deleteImage(imageId: string): Promise<void> {
    const imageDir = path.join(this.storagePath, imageId);
    if (existsSync(imageDir)) {
      const { rm } = await import("fs/promises");
      await rm(imageDir, { recursive: true, force: true });
    }
  }
}

