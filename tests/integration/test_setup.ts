import { redis } from "../helpers/redis";

// Set up encryption key for tests if not already set
if (!process.env.ENCRYPTION_KEY) {
  process.env.ENCRYPTION_KEY = Buffer.from(
    new Uint8Array(32).fill(42)
  ).toString("base64");
}

// clean up redis and postgres
export async function setup() {
  await redis.flushall();
}

await setup();
