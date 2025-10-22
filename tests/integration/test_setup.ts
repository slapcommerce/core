import { redis } from "../helpers/redis";

// clean up redis and postgres
export async function setup() {
  await redis.flushall();
}

await setup();
