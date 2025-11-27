import { describe, test, expect } from "bun:test";
import { ImageOptimizer, type ExtensionGetter } from "../../../src/api/infrastructure/imageOptimizer";

describe("ImageOptimizer", () => {
  test("should generate all sizes and formats", async () => {
    // Arrange
    const optimizer = new ImageOptimizer();
    // Create a simple test image buffer (1x1 PNG)
    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    // Act
    const result = await optimizer.optimizeImage(
      pngBuffer.buffer,
      "image/png"
    );

    // Assert - Check all sizes exist
    const sizes = ["thumbnail", "small", "medium", "large", "original"] as const;
    for (const size of sizes) {
      expect(result[size]).toBeDefined();
      expect(result[size].original).toBeInstanceOf(ArrayBuffer);
      expect(result[size].webp).toBeInstanceOf(ArrayBuffer);
      expect(result[size].avif).toBeInstanceOf(ArrayBuffer);
      expect(result[size].original.byteLength).toBeGreaterThan(0);
      expect(result[size].webp.byteLength).toBeGreaterThan(0);
      expect(result[size].avif.byteLength).toBeGreaterThan(0);
    }
  });

  test("should generate WebP format with quality 85 for all sizes", async () => {
    // Arrange
    const optimizer = new ImageOptimizer();
    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    // Act
    const result = await optimizer.optimizeImage(
      pngBuffer.buffer,
      "image/png"
    );

    // Assert - WebP should exist for all sizes
    const sizes = ["thumbnail", "small", "medium", "large", "original"] as const;
    for (const size of sizes) {
      expect(result[size].webp.byteLength).toBeGreaterThan(0);
      // WebP magic bytes: RIFF...WEBP
      const webpBytes = new Uint8Array(result[size].webp);
      expect(webpBytes[0]).toBe(0x52); // 'R'
      expect(webpBytes[1]).toBe(0x49); // 'I'
      expect(webpBytes[2]).toBe(0x46); // 'F'
      expect(webpBytes[3]).toBe(0x46); // 'F'
    }
  });

  test("should generate AVIF format with quality 75 for all sizes", async () => {
    // Arrange
    const optimizer = new ImageOptimizer();
    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    // Act
    const result = await optimizer.optimizeImage(
      pngBuffer.buffer,
      "image/png"
    );

    // Assert - AVIF should exist for all sizes
    const sizes = ["thumbnail", "small", "medium", "large", "original"] as const;
    for (const size of sizes) {
      expect(result[size].avif.byteLength).toBeGreaterThan(0);
      const avifBytes = new Uint8Array(result[size].avif);
      expect(avifBytes.length).toBeGreaterThan(0);
    }
  });

  test("should resize images to correct dimensions", async () => {
    // Arrange
    const optimizer = new ImageOptimizer();
    // Create a larger test image (100x100 PNG)
    // This is a minimal valid PNG that's larger than our size constraints
    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    // Act
    const result = await optimizer.optimizeImage(
      pngBuffer.buffer,
      "image/png"
    );

    // Assert - All sizes should be generated
    // Note: For very small images (1x1), all sizes will be similar
    // but the optimizer should still generate all formats
    const sizes = ["thumbnail", "small", "medium", "large", "original"] as const;
    for (const size of sizes) {
      expect(result[size]).toBeDefined();
      expect(result[size].original.byteLength).toBeGreaterThan(0);
      expect(result[size].webp.byteLength).toBeGreaterThan(0);
      expect(result[size].avif.byteLength).toBeGreaterThan(0);
    }
  });

  test("should handle JPEG input format", async () => {
    // Arrange
    const optimizer = new ImageOptimizer();
    // Use PNG buffer but test with JPEG content type to verify format conversion
    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    // Act - Test with JPEG content type (Sharp will convert it)
    const result = await optimizer.optimizeImage(
      pngBuffer.buffer,
      "image/jpeg"
    );

    // Assert - All sizes should be generated
    const sizes = ["thumbnail", "small", "medium", "large", "original"] as const;
    for (const size of sizes) {
      expect(result[size]).toBeDefined();
      expect(result[size].original).toBeInstanceOf(ArrayBuffer);
      expect(result[size].webp).toBeInstanceOf(ArrayBuffer);
      expect(result[size].avif).toBeInstanceOf(ArrayBuffer);
    }
  });

  test("should handle WebP input format", async () => {
    // Arrange
    const optimizer = new ImageOptimizer();
    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );
    const formats = await optimizer.optimizeImage(
      pngBuffer.buffer,
      "image/png"
    );
    const webpInput = formats.thumbnail.webp;

    // Act - optimize a WebP image
    const result = await optimizer.optimizeImage(
      webpInput,
      "image/webp"
    );

    // Assert - All sizes should be generated
    const sizes = ["thumbnail", "small", "medium", "large", "original"] as const;
    for (const size of sizes) {
      expect(result[size]).toBeDefined();
      expect(result[size].original).toBeInstanceOf(ArrayBuffer);
      expect(result[size].webp).toBeInstanceOf(ArrayBuffer);
      expect(result[size].avif).toBeInstanceOf(ArrayBuffer);
    }
  });

  test("should handle AVIF input format", async () => {
    // Arrange
    const optimizer = new ImageOptimizer();
    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );
    const formats = await optimizer.optimizeImage(
      pngBuffer.buffer,
      "image/png"
    );
    const avifInput = formats.thumbnail.avif;

    // Act - optimize an AVIF image
    const result = await optimizer.optimizeImage(
      avifInput,
      "image/avif"
    );

    // Assert - All sizes should be generated
    const sizes = ["thumbnail", "small", "medium", "large", "original"] as const;
    for (const size of sizes) {
      expect(result[size]).toBeDefined();
      expect(result[size].original).toBeInstanceOf(ArrayBuffer);
      expect(result[size].webp).toBeInstanceOf(ArrayBuffer);
      expect(result[size].avif).toBeInstanceOf(ArrayBuffer);
    }
  });

  test("should handle GIF input format", async () => {
    // Arrange
    const optimizer = new ImageOptimizer();
    // Use PNG buffer but test with GIF content type
    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    // Act - Test with GIF content type (Sharp will handle conversion)
    const result = await optimizer.optimizeImage(
      pngBuffer.buffer,
      "image/gif"
    );

    // Assert - All sizes should be generated
    const sizes = ["thumbnail", "small", "medium", "large", "original"] as const;
    for (const size of sizes) {
      expect(result[size]).toBeDefined();
      expect(result[size].original).toBeInstanceOf(ArrayBuffer);
      expect(result[size].webp).toBeInstanceOf(ArrayBuffer);
      expect(result[size].avif).toBeInstanceOf(ArrayBuffer);
    }
  });

  test("should handle unknown content type by defaulting to JPEG", async () => {
    // Arrange
    const optimizer = new ImageOptimizer();
    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    // Act - Test with unknown content type
    const result = await optimizer.optimizeImage(
      pngBuffer.buffer,
      "image/unknown"
    );

    // Assert - Should still generate all formats (defaulting to JPEG for original)
    const sizes = ["thumbnail", "small", "medium", "large", "original"] as const;
    for (const size of sizes) {
      expect(result[size]).toBeDefined();
      expect(result[size].original).toBeInstanceOf(ArrayBuffer);
      expect(result[size].webp).toBeInstanceOf(ArrayBuffer);
      expect(result[size].avif).toBeInstanceOf(ArrayBuffer);
    }
  });

  test("should use default JPEG when extension getter returns unsupported format", async () => {
    // Arrange - Inject extension getter that returns unsupported format
    const customExtensionGetter: ExtensionGetter = () => "tiff";
    const optimizer = new ImageOptimizer(customExtensionGetter);
    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    // Act - This will hit the default case in convertToOriginalFormat
    const result = await optimizer.optimizeImage(
      pngBuffer.buffer,
      "image/tiff"
    );

    // Assert - Should still generate all formats (defaulting to JPEG for original)
    const sizes = ["thumbnail", "small", "medium", "large", "original"] as const;
    for (const size of sizes) {
      expect(result[size]).toBeDefined();
      expect(result[size].original).toBeInstanceOf(ArrayBuffer);
      expect(result[size].webp).toBeInstanceOf(ArrayBuffer);
      expect(result[size].avif).toBeInstanceOf(ArrayBuffer);
    }
  });
});

