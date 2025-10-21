import { redis } from "../helpers/redis";
import { db } from "../helpers/postgres";
import * as schema from "../../src/infrastructure/orm";

// clean up redis and postgres
export async function setup() {
  const tables = Object.values(schema);
  for (const table of tables) {
    await db.delete(table).execute();
  }
  await redis.flushall();
}

await setup();
