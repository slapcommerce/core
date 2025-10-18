// db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./orm";
import { SQL } from "bun";

const pool = new SQL({
  url: process.env.DATABASE_URL!,
  max: 20, // Maximum 20 concurrent connections
  idleTimeout: 30, // Close idle connections after 30s
  maxLifetime: 3600, // Max connection lifetime 1 hour
  connectionTimeout: 10, // Connection timeout 10s
});
export const db = drizzle(pool, { schema });

export type DB = typeof db;
export type TX = Parameters<Parameters<DB["transaction"]>[0]>[0];
