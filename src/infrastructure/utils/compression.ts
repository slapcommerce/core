// Zstd magic bytes: 0x28 0xB5 0x2F 0xFD
export const ZSTD_MAGIC_BYTES = new Uint8Array([0x28, 0xb5, 0x2f, 0xfd]);
export const COMPRESSION_THRESHOLD = 4096; // 4KB

export function hasZstdMagicBytes(data: Uint8Array): boolean {
  if (data.length < 4) return false;
  return (
    data[0] === ZSTD_MAGIC_BYTES[0] &&
    data[1] === ZSTD_MAGIC_BYTES[1] &&
    data[2] === ZSTD_MAGIC_BYTES[2] &&
    data[3] === ZSTD_MAGIC_BYTES[3]
  );
}
