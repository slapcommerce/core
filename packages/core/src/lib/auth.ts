import { betterAuth } from "better-auth";
import type { Database } from "bun:sqlite";

export function createAuth(
  db: Database,
  options?: {
    secret?: string;
    baseURL?: string;
    trustedOrigins?: string;
    ipHeader?: string;
    nodeEnv?: string;
  }
) {
  // Use 'in' operator to check if properties were explicitly provided
  const nodeEnv = options && 'nodeEnv' in options ? options.nodeEnv : process.env.NODE_ENV;
  const baseURL = options && 'baseURL' in options ? options.baseURL : (process.env.BETTER_AUTH_URL ?? "http://localhost:3000");

  // Better Auth automatically reads BETTER_AUTH_SECRET from environment variables
  // If not set, it will throw an error in production
  const secret = options && 'secret' in options ? options.secret : process.env.BETTER_AUTH_SECRET;
  if (!secret && nodeEnv === "production") {
    throw new Error("BETTER_AUTH_SECRET environment variable is required in production");
  }

  // Configure trusted origins for CSRF protection
  // Supports wildcard patterns (e.g., "https://*.example.com")
  const trustedOrigins: string[] = [];
  const trustedOriginsStr = options && 'trustedOrigins' in options ? options.trustedOrigins : process.env.BETTER_AUTH_TRUSTED_ORIGINS;
  if (trustedOriginsStr) {
    trustedOrigins.push(...trustedOriginsStr.split(",").map(s => s.trim()));
  } else {
    // Default to baseURL origin if no trusted origins specified
    try {
      const url = new URL(baseURL ?? "http://localhost:3000");
      trustedOrigins.push(url.origin);
    } catch {
      // If baseURL is invalid, Better Auth will handle it
    }
  }

  const ipHeader = options && 'ipHeader' in options ? options.ipHeader : process.env.BETTER_AUTH_IP_HEADER;

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
    advanced: ipHeader ? {
      ipAddress: {
        ipAddressHeaders: [ipHeader],
      },
    } : undefined,
  });
}


