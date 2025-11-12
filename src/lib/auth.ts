import { betterAuth } from "better-auth";
import type { Database } from "bun:sqlite";

export function createAuth(db: Database) {
  return betterAuth({
    database: db,
    emailAndPassword: {
      enabled: true,
    },
    basePath: "/api/auth",
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  });
}


