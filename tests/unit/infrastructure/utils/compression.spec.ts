import { describe, expect, test } from "bun:test";
import {
  hasZstdMagicBytes,
  ZSTD_MAGIC_BYTES,
  COMPRESSION_THRESHOLD,
} from "../../../../src/infrastructure/utils/compression";
import { encode } from "@msgpack/msgpack";

describe("compression utilities", () => {
  describe("constants", () => {
    test("ZSTD_MAGIC_BYTES should have correct values", () => {
      expect(ZSTD_MAGIC_BYTES).toBeInstanceOf(Uint8Array);
      expect(ZSTD_MAGIC_BYTES.length).toBe(4);
      expect(ZSTD_MAGIC_BYTES[0]).toBe(0x28);
      expect(ZSTD_MAGIC_BYTES[1]).toBe(0xb5);
      expect(ZSTD_MAGIC_BYTES[2]).toBe(0x2f);
      expect(ZSTD_MAGIC_BYTES[3]).toBe(0xfd);
    });

    test("COMPRESSION_THRESHOLD should be 4096 bytes", () => {
      expect(COMPRESSION_THRESHOLD).toBe(4096);
    });
  });

  describe("hasZstdMagicBytes", () => {
    test("should return true for data with zstd magic bytes", () => {
      // Arrange
      const data = new Uint8Array([0x28, 0xb5, 0x2f, 0xfd, 0x01, 0x02, 0x03]);

      // Act
      const result = hasZstdMagicBytes(data);

      // Assert
      expect(result).toBe(true);
    });

    test("should return true for data with only zstd magic bytes", () => {
      // Arrange
      const data = new Uint8Array([0x28, 0xb5, 0x2f, 0xfd]);

      // Act
      const result = hasZstdMagicBytes(data);

      // Assert
      expect(result).toBe(true);
    });

    test("should return false for data without zstd magic bytes", () => {
      // Arrange
      const data = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]);

      // Act
      const result = hasZstdMagicBytes(data);

      // Assert
      expect(result).toBe(false);
    });

    test("should return false for data with partial magic bytes at start", () => {
      // Arrange
      const data = new Uint8Array([0x28, 0xb5, 0x00, 0x00]);

      // Act
      const result = hasZstdMagicBytes(data);

      // Assert
      expect(result).toBe(false);
    });

    test("should return false for data shorter than 4 bytes", () => {
      // Arrange
      const data = new Uint8Array([0x28, 0xb5, 0x2f]);

      // Act
      const result = hasZstdMagicBytes(data);

      // Assert
      expect(result).toBe(false);
    });

    test("should return false for empty data", () => {
      // Arrange
      const data = new Uint8Array([]);

      // Act
      const result = hasZstdMagicBytes(data);

      // Assert
      expect(result).toBe(false);
    });

    test("should return false for data with magic bytes not at start", () => {
      // Arrange
      const data = new Uint8Array([0x00, 0x28, 0xb5, 0x2f, 0xfd]);

      // Act
      const result = hasZstdMagicBytes(data);

      // Assert
      expect(result).toBe(false);
    });

    test("should work with real zstd compressed data", () => {
      // Arrange
      const uncompressed = new Uint8Array([
        0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
      ]);
      const compressed = Bun.zstdCompressSync(uncompressed, { level: 1 });

      // Act
      const result = hasZstdMagicBytes(compressed);

      // Assert
      expect(result).toBe(true);
    });

    test("should return false for msgpack data", async () => {
      // Arrange
      const msgpackData = encode({ test: "data", value: 123 });

      // Act
      const result = hasZstdMagicBytes(msgpackData);

      // Assert
      expect(result).toBe(false);
    });

    test("should handle large arrays correctly", () => {
      // Arrange
      const largeArray = new Uint8Array(10000);
      largeArray[0] = 0x28;
      largeArray[1] = 0xb5;
      largeArray[2] = 0x2f;
      largeArray[3] = 0xfd;

      // Act
      const result = hasZstdMagicBytes(largeArray);

      // Assert
      expect(result).toBe(true);
    });

    test("should handle arrays at exact boundary (4 bytes)", () => {
      // Arrange
      const exactSize = new Uint8Array([0x28, 0xb5, 0x2f, 0xfd]);

      // Act
      const result = hasZstdMagicBytes(exactSize);

      // Assert
      expect(result).toBe(true);
    });

    test("should handle each byte check independently", () => {
      // Arrange & Act & Assert
      // First byte wrong
      expect(hasZstdMagicBytes(new Uint8Array([0x00, 0xb5, 0x2f, 0xfd]))).toBe(
        false
      );

      // Second byte wrong
      expect(hasZstdMagicBytes(new Uint8Array([0x28, 0x00, 0x2f, 0xfd]))).toBe(
        false
      );

      // Third byte wrong
      expect(hasZstdMagicBytes(new Uint8Array([0x28, 0xb5, 0x00, 0xfd]))).toBe(
        false
      );

      // Fourth byte wrong
      expect(hasZstdMagicBytes(new Uint8Array([0x28, 0xb5, 0x2f, 0x00]))).toBe(
        false
      );
    });
  });
});
