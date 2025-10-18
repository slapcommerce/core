import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../src/infrastructure/orm";
import { sql } from "drizzle-orm";
import type { DB } from "../../src/infrastructure/postgres";
import { Pool } from "pg";
import { getTestRedis, cleanRedisStreams } from "./testRedis";

let testDb: DB | undefined = undefined;
let testPool: Pool | undefined = undefined;

export async function getTestDb(): Promise<DB> {
  const DATABASE_URL = process.env.DATABASE_URL!;
  testDb = drizzle(DATABASE_URL, { schema });
  return testDb;
}

export async function cleanDatabase(db: DB) {
  // Truncate all tables in the correct order to respect foreign keys
  await db.execute(sql`TRUNCATE TABLE unprocessable_messages_dlq CASCADE`);
  await db.execute(sql`TRUNCATE TABLE undeliverable_messages_dlq CASCADE`);
  await db.execute(sql`TRUNCATE TABLE outbox CASCADE`);
  await db.execute(sql`TRUNCATE TABLE inbox CASCADE`);
  await db.execute(sql`TRUNCATE TABLE events CASCADE`);
  await db.execute(sql`TRUNCATE TABLE collection_detail_view CASCADE`);
  await db.execute(sql`TRUNCATE TABLE collection_list_view CASCADE`);
  await db.execute(sql`TRUNCATE TABLE product_detail_view CASCADE`);
  await db.execute(sql`TRUNCATE TABLE product_list_view CASCADE`);

  // Clean Redis streams
  const redis = getTestRedis();
  await cleanRedisStreams(redis);
}

export async function closeDatabase() {
  if (testPool) {
    await testPool.end();
    testPool = undefined;
  }
  testDb = undefined;
}
