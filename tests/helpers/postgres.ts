import { drizzle } from "drizzle-orm/bun-sql";
import * as schema from "../../src/infrastructure/orm";
import { SQL } from "bun";

const pool = new SQL({
  url: process.env.DATABASE_URL!,
  max: 20,
  idleTimeout: 30,
  maxLifetime: 3600,
  connectionTimeout: 10,
});
export const db = drizzle(pool, { schema });
