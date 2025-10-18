import Redis from "ioredis";
import { env } from "../env";

// Redis client singleton for outbox message streaming
//
// Configuration notes for production:
// - Set appendonly=yes in redis.conf for AOF persistence
// - Use appendfsync=everysec (accept ≤1s loss) or always (slower, no loss)
// - Avoid aggressive MAXLEN trimming on streams
// - Monitor stream length and PEL (pending entries list) size

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // Required for blocking commands like XREADGROUP
      enableReadyCheck: true,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redisClient.on("error", (err) => {
      console.error("Redis connection error:", err);
    });

    redisClient.on("connect", () => {
      console.log("Redis connected");
    });
  }

  return redisClient;
}

export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

export type RedisClient = Redis;
