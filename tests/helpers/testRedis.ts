import Redis from "ioredis";
import { env } from "../../src/env";

/**
 * Get or create a Redis client for testing.
 * Uses TEST_REDIS_URL env var if available, otherwise falls back to REDIS_URL.
 */
export function getTestRedis(): Redis {
  const redisUrl = env.REDIS_URL;
  const testRedisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  testRedisClient.on("error", (err) => {
    console.error("Test Redis connection error:", err);
  });

  return testRedisClient;
}

/**
 * Clean all Redis streams used in tests.
 * Deletes the specified stream and any consumer groups.
 */
export async function cleanRedisStreams(
  redis: Redis,
  streamName: string = "events"
): Promise<void> {
  try {
    // Try to delete the specified stream
    await redis.del(streamName);

    // Also try to delete DLQ stream if it exists
    await redis.del(`${streamName}:dlq`);
  } catch (error) {
    // Ignore errors if streams don't exist
  }
}
