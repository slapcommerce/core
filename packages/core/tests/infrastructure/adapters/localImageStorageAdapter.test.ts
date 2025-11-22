import { describe, test, expect } from "bun:test";
import { LocalImageStorageAdapter } from "../../../src/infrastructure/adapters/localImageStorageAdapter";
import { existsSync } from "fs";
import { join } from "path";
import { rm } from "fs/promises";

describe("LocalImageStorageAdapter", () => {
  test("should upload image and create all size and format files", async () => {
    // Arrange
    const testStoragePath = "./test-storage/images";
    const adapter = new LocalImageStorageAdapter(testStoragePath);
    const imageId = crypto.randomUUID();
    const originalExtension = "png";

    const createSizeFormats = () => ({
      original: new ArrayBuffer(100),
      webp: new ArrayBuffer(80),
      avif: new ArrayBuffer(60),
    });

    const formats = {
      thumbnail: createSizeFormats(),
      small: createSizeFormats(),
      medium: createSizeFormats(),
      large: createSizeFormats(),
      original: createSizeFormats(),
    };

    try {
      // Act
      const result = await adapter.uploadImage(
        formats,
        imageId,
        originalExtension
      );

      // Assert
      expect(result.imageId).toBe(imageId);
      const sizes = ["thumbnail", "small", "medium", "large", "original"] as const;
      for (const size of sizes) {
        expect(result.urls[size].original).toBe(
          `/storage/images/${imageId}/${size}.png`
        );
        expect(result.urls[size].webp).toBe(
          `/storage/images/${imageId}/${size}.webp`
        );
        expect(result.urls[size].avif).toBe(
          `/storage/images/${imageId}/${size}.avif`
        );
      }

      // Verify files exist (5 sizes × 3 formats = 15 files)
      const imageDir = join(testStoragePath, imageId);
      for (const size of sizes) {
        expect(existsSync(join(imageDir, `${size}.png`))).toBe(true);
        expect(existsSync(join(imageDir, `${size}.webp`))).toBe(true);
        expect(existsSync(join(imageDir, `${size}.avif`))).toBe(true);
      }
    } finally {
      // Cleanup
      if (existsSync(testStoragePath)) {
        await rm(testStoragePath, { recursive: true, force: true });
      }
    }
  });

  test("should create directory structure if it doesn't exist", async () => {
    // Arrange
    const testStoragePath = "./test-storage-new/images";
    const adapter = new LocalImageStorageAdapter(testStoragePath);
    const imageId = crypto.randomUUID();
    const originalExtension = "jpg";

    const createSizeFormats = () => ({
      original: new ArrayBuffer(100),
      webp: new ArrayBuffer(80),
      avif: new ArrayBuffer(60),
    });

    const formats = {
      thumbnail: createSizeFormats(),
      small: createSizeFormats(),
      medium: createSizeFormats(),
      large: createSizeFormats(),
      original: createSizeFormats(),
    };

    try {
      // Act
      await adapter.uploadImage(formats, imageId, originalExtension);

      // Assert
      const imageDir = join(testStoragePath, imageId);
      expect(existsSync(imageDir)).toBe(true);
    } finally {
      // Cleanup
      if (existsSync("./test-storage-new")) {
        await rm("./test-storage-new", { recursive: true, force: true });
      }
    }
  });

  test("should return correct URLs for all sizes and formats", async () => {
    // Arrange
    const testStoragePath = "./test-storage-urls/images";
    const adapter = new LocalImageStorageAdapter(testStoragePath);
    const imageId = crypto.randomUUID();
    const originalExtension = "jpeg";

    const createSizeFormats = () => ({
      original: new ArrayBuffer(100),
      webp: new ArrayBuffer(80),
      avif: new ArrayBuffer(60),
    });

    const formats = {
      thumbnail: createSizeFormats(),
      small: createSizeFormats(),
      medium: createSizeFormats(),
      large: createSizeFormats(),
      original: createSizeFormats(),
    };

    try {
      // Act
      const result = await adapter.uploadImage(
        formats,
        imageId,
        originalExtension
      );

      // Assert
      const sizes = ["thumbnail", "small", "medium", "large", "original"] as const;
      for (const size of sizes) {
        expect(result.urls[size].original).toContain(imageId);
        expect(result.urls[size].original).toContain(`${size}.jpeg`);
        expect(result.urls[size].webp).toContain(imageId);
        expect(result.urls[size].webp).toContain(`${size}.webp`);
        expect(result.urls[size].avif).toContain(imageId);
        expect(result.urls[size].avif).toContain(`${size}.avif`);
      }
    } finally {
      // Cleanup
      if (existsSync("./test-storage-urls")) {
        await rm("./test-storage-urls", { recursive: true, force: true });
      }
    }
  });

  test("should handle extension with leading dot", async () => {
    // Arrange
    const testStoragePath = "./test-storage-dot/images";
    const adapter = new LocalImageStorageAdapter(testStoragePath);
    const imageId = crypto.randomUUID();
    const originalExtension = ".png";

    const createSizeFormats = () => ({
      original: new ArrayBuffer(100),
      webp: new ArrayBuffer(80),
      avif: new ArrayBuffer(60),
    });

    const formats = {
      thumbnail: createSizeFormats(),
      small: createSizeFormats(),
      medium: createSizeFormats(),
      large: createSizeFormats(),
      original: createSizeFormats(),
    };

    try {
      // Act
      const result = await adapter.uploadImage(
        formats,
        imageId,
        originalExtension
      );

      // Assert
      expect(result.urls.original.original).toContain("original.png");
      const imageDir = join(testStoragePath, imageId);
      expect(existsSync(join(imageDir, "original.png"))).toBe(true);
    } finally {
      // Cleanup
      if (existsSync("./test-storage-dot")) {
        await rm("./test-storage-dot", { recursive: true, force: true });
      }
    }
  });

  test("should delete image directory", async () => {
    // Arrange
    const testStoragePath = "./test-storage-delete/images";
    const adapter = new LocalImageStorageAdapter(testStoragePath);
    const imageId = crypto.randomUUID();
    const originalExtension = "png";

    const createSizeFormats = () => ({
      original: new ArrayBuffer(100),
      webp: new ArrayBuffer(80),
      avif: new ArrayBuffer(60),
    });

    const formats = {
      thumbnail: createSizeFormats(),
      small: createSizeFormats(),
      medium: createSizeFormats(),
      large: createSizeFormats(),
      original: createSizeFormats(),
    };

    try {
      // Upload first
      await adapter.uploadImage(formats, imageId, originalExtension);
      const imageDir = join(testStoragePath, imageId);
      expect(existsSync(imageDir)).toBe(true);

      // Act
      await adapter.deleteImage(imageId);

      // Assert
      expect(existsSync(imageDir)).toBe(false);
    } finally {
      // Cleanup
      if (existsSync("./test-storage-delete")) {
        await rm("./test-storage-delete", { recursive: true, force: true });
      }
    }
  });

  test("should never overwrite existing images (unique IDs)", async () => {
    // Arrange
    const testStoragePath = "./test-storage-unique/images";
    const adapter = new LocalImageStorageAdapter(testStoragePath);
    const imageId1 = crypto.randomUUID();
    const imageId2 = crypto.randomUUID();
    const originalExtension = "png";

    const createSizeFormats = (originalSize: number, webpSize: number, avifSize: number) => ({
      thumbnail: {
        original: new ArrayBuffer(originalSize),
        webp: new ArrayBuffer(webpSize),
        avif: new ArrayBuffer(avifSize),
      },
      small: {
        original: new ArrayBuffer(originalSize),
        webp: new ArrayBuffer(webpSize),
        avif: new ArrayBuffer(avifSize),
      },
      medium: {
        original: new ArrayBuffer(originalSize),
        webp: new ArrayBuffer(webpSize),
        avif: new ArrayBuffer(avifSize),
      },
      large: {
        original: new ArrayBuffer(originalSize),
        webp: new ArrayBuffer(webpSize),
        avif: new ArrayBuffer(avifSize),
      },
      original: {
        original: new ArrayBuffer(originalSize),
        webp: new ArrayBuffer(webpSize),
        avif: new ArrayBuffer(avifSize),
      },
    });

    const formats1 = createSizeFormats(100, 80, 60);
    const formats2 = createSizeFormats(200, 160, 120);

    try {
      // Act - Upload two different images with different IDs
      const result1 = await adapter.uploadImage(
        formats1,
        imageId1,
        originalExtension
      );
      const result2 = await adapter.uploadImage(
        formats2,
        imageId2,
        originalExtension
      );

      // Assert - Both should exist in separate directories
      expect(result1.imageId).toBe(imageId1);
      expect(result2.imageId).toBe(imageId2);
      expect(result1.imageId).not.toBe(result2.imageId);

      const imageDir1 = join(testStoragePath, imageId1);
      const imageDir2 = join(testStoragePath, imageId2);
      expect(existsSync(imageDir1)).toBe(true);
      expect(existsSync(imageDir2)).toBe(true);
    } finally {
      // Cleanup
      if (existsSync("./test-storage-unique")) {
        await rm("./test-storage-unique", { recursive: true, force: true });
      }
    }
  });
});

