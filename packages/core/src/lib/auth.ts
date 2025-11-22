import { betterAuth } from "better-auth";
import type { Database } from "bun:sqlite";

export function createAuth(db: Database) {
  const baseURL = process.env.BETTER_AUTH_URL || "http://localhost:3000";
  
  // Better Auth automatically reads BETTER_AUTH_SECRET from environment variables
  // If not set, it will throw an error in production
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("BETTER_AUTH_SECRET environment variable is required in production");
  }

  // Configure trusted origins for CSRF protection
  // Supports wildcard patterns (e.g., "https://*.example.com")
  const trustedOrigins: string[] = [];
  if (process.env.BETTER_AUTH_TRUSTED_ORIGINS) {
    trustedOrigins.push(...process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",").map(s => s.trim()));
  } else {
    // Default to baseURL origin if no trusted origins specified
    try {
      const url = new URL(baseURL);
      trustedOrigins.push(url.origin);
    } catch {
      // If baseURL is invalid, Better Auth will handle it
    }
  }

  return betterAuth({
    database: db,
    secret: secret, // Explicitly set secret (Better Auth also reads from env automatically)
    emailAndPassword: {
      enabled: true,
    },
    basePath: "/api/auth",
    baseURL,
    trustedOrigins: trustedOrigins.length > 0 ? trustedOrigins : undefined,
    // CSRF protection is enabled by default in Better Auth
    // Advanced IP address configuration for proxy/load balancer scenarios
    advanced: process.env.BETTER_AUTH_IP_HEADER ? {
      ipAddress: {
        ipAddressHeaders: [process.env.BETTER_AUTH_IP_HEADER],
      },
    } : undefined,
  });
}


