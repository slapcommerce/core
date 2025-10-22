import type { DomainEvent } from "../../domain/_base/domainEvent";
const NONCE_LENGTH = 12;

const KEY_BYTES = new Uint8Array(
  Buffer.from(process.env.ENCRYPTION_KEY || "", "base64")
);

if (KEY_BYTES.length !== 32) {
  throw new Error(
    "ENCRYPTION_KEY must be a 32-byte (256-bit) key encoded in base64"
  );
}

let KEY: CryptoKey | null = null;

async function getKey(): Promise<CryptoKey> {
  if (!KEY) {
    KEY = await crypto.subtle.importKey(
      "raw",
      KEY_BYTES,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );
  }
  return KEY;
}

export function generateNonce(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(NONCE_LENGTH));
}

export async function encryptEvent(
  event: DomainEvent<string, Record<string, unknown>>
): Promise<Uint8Array> {
  const json = JSON.stringify(event);
  const data = new TextEncoder().encode(json);

  const compressed = Bun.zstdCompressSync(data, { level: 1 });

  const nonce = generateNonce();
  const key = await getKey();
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    key,
    compressed
  );

  const cipherBytes = new Uint8Array(cipher);
  const combined = new Uint8Array(NONCE_LENGTH + cipherBytes.byteLength);
  combined.set(nonce, 0);
  combined.set(cipherBytes, NONCE_LENGTH);
  return combined;
}

export async function decryptEvent(
  data: Uint8Array
): Promise<DomainEvent<string, Record<string, unknown>>> {
  const nonce = data.subarray(0, NONCE_LENGTH);
  const ciphertext = data.subarray(NONCE_LENGTH);

  const key = await getKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: nonce },
    key,
    ciphertext
  );

  const bytes = new Uint8Array(decrypted);
  const decompressed = Bun.zstdDecompressSync(bytes);

  const obj = JSON.parse(new TextDecoder().decode(decompressed));
  return obj as DomainEvent<string, Record<string, unknown>>;
}
