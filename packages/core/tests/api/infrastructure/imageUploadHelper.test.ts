import { describe, test, expect } from "bun:test";
import { ImageUploadHelper } from "../../../src/api/infrastructure/imageUploadHelper";
import { LocalImageStorageAdapter } from "../../../src/api/infrastructure/adapters/localImageStorageAdapter";
import { ImageOptimizer } from "../../../src/api/infrastructure/imageOptimizer";
import { existsSync } from "fs";
import { join } from "path";
import { rm } from "fs/promises";

describe("ImageUploadHelper", () => {
  test("should successfully upload image with all formats", async () => {
    // Arrange
    const testStoragePath = "./test-storage-helper/images";
    const adapter = new LocalImageStorageAdapter(testStoragePath);
    const optimizer = new ImageOptimizer();
    const helper = new ImageUploadHelper(adapter, optimizer);

    // Create a simple test image buffer (1x1 PNG)
    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    try {
      // Act
      const result = await helper.uploadImage(
        pngBuffer.buffer,
        "test.png",
        "image/png"
      );

      // Assert
      expect(result.imageId).toBeDefined();
      const sizes = ["thumbnail", "small", "medium", "large", "original"] as const;
      for (const size of sizes) {
        expect(result.urls[size]).toBeDefined();
        expect(result.urls[size].original).toBeDefined();
        expect(result.urls[size].webp).toBeDefined();
        expect(result.urls[size].avif).toBeDefined();
        expect(result.urls[size].original).toContain(result.imageId);
        expect(result.urls[size].webp).toContain(result.imageId);
        expect(result.urls[size].avif).toContain(result.imageId);
      }
    } finally {
      // Cleanup
      if (existsSync("./test-storage-helper")) {
        await rm("./test-storage-helper", { recursive: true, force: true });
      }
    }
  });

  test("should validate file type and reject non-image types", async () => {
    // Arrange
    const adapter = new LocalImageStorageAdapter("./test-storage");
    const optimizer = new ImageOptimizer();
    const helper = new ImageUploadHelper(adapter, optimizer);

    const textBuffer = new TextEncoder().encode("This is not an image");

    // Act & Assert
    await expect(
      helper.uploadImage(textBuffer.buffer, "test.txt", "text/plain")
    ).rejects.toThrow("Invalid file type");
  });

  test("should validate file size and reject oversized files", async () => {
    // Arrange
    const adapter = new LocalImageStorageAdapter("./test-storage");
    const optimizer = new ImageOptimizer();
    const helper = new ImageUploadHelper(adapter, optimizer);

    // Create a buffer larger than 10MB (default max)
    const largeBuffer = new ArrayBuffer(11 * 1024 * 1024); // 11MB

    // Act & Assert
    await expect(
      helper.uploadImage(largeBuffer, "large.png", "image/png")
    ).rejects.toThrow("File size exceeds maximum");
  });

  test("should generate unique IDs for each upload", async () => {
    // Arrange
    const testStoragePath = "./test-storage-unique-ids-helper/images";
    const adapter = new LocalImageStorageAdapter(testStoragePath);
    const optimizer = new ImageOptimizer();
    const helper = new ImageUploadHelper(adapter, optimizer);

    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    try {
      // Act - Upload same image twice
      const result1 = await helper.uploadImage(
        pngBuffer.buffer,
        "test1.png",
        "image/png"
      );
      const result2 = await helper.uploadImage(
        pngBuffer.buffer,
        "test2.png",
        "image/png"
      );

      // Assert - Should have different IDs
      expect(result1.imageId).not.toBe(result2.imageId);
    } finally {
      // Cleanup
      if (existsSync("./test-storage-unique-ids-helper")) {
        await rm("./test-storage-unique-ids-helper", { recursive: true, force: true });
      }
    }
  });

  test("should handle JPEG input format", async () => {
    // Arrange
    const testStoragePath = "./test-storage-jpeg-helper/images";
    const adapter = new LocalImageStorageAdapter(testStoragePath);
    const optimizer = new ImageOptimizer();
    const helper = new ImageUploadHelper(adapter, optimizer);

    // Use PNG buffer but test with JPEG content type to verify contentType handling
    // (Sharp will convert it, which is fine for testing the helper)
    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    try {
      // Act - Use JPEG content type
      const result = await helper.uploadImage(
        pngBuffer.buffer,
        "test.jpg",
        "image/jpeg"
      );

      // Assert
      expect(result.imageId).toBeDefined();
      expect(result.urls.original.original).toContain(".jpg");
    } finally {
      // Cleanup
      if (existsSync("./test-storage-jpeg-helper")) {
        await rm("./test-storage-jpeg-helper", { recursive: true, force: true });
      }
    }
  });

  test("should extract extension from filename", async () => {
    // Arrange
    const testStoragePath = "./test-storage-ext-helper/images";
    const adapter = new LocalImageStorageAdapter(testStoragePath);
    const optimizer = new ImageOptimizer();
    const helper = new ImageUploadHelper(adapter, optimizer);

    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    try {
      // Act
      const result = await helper.uploadImage(
        pngBuffer.buffer,
        "image.png",
        "image/png"
      );

      // Assert
      expect(result.urls.original.original).toContain(".png");
    } finally {
      // Cleanup
      if (existsSync("./test-storage-ext-helper")) {
        await rm("./test-storage-ext-helper", { recursive: true, force: true });
      }
    }
  });

  test("should handle filename without extension", async () => {
    // Arrange
    const testStoragePath = "./test-storage-no-ext-helper/images";
    const adapter = new LocalImageStorageAdapter(testStoragePath);
    const optimizer = new ImageOptimizer();
    const helper = new ImageUploadHelper(adapter, optimizer);

    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    try {
      // Act
      const result = await helper.uploadImage(
        pngBuffer.buffer,
        "image",
        "image/png"
      );

      // Assert - Should use extension from content type
      expect(result.urls.original.original).toBeDefined();
    } finally {
      // Cleanup
      if (existsSync("./test-storage-no-ext-helper")) {
        await rm("./test-storage-no-ext-helper", { recursive: true, force: true });
      }
    }
  });
});

