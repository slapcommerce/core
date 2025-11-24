/**
 * Shared test helpers for security tests
 */

import { Database } from "bun:sqlite";
import { Slap } from "../../src/index";
import { createTestDatabase } from "../api/helpers/database";

export interface TestServer {
  server: ReturnType<typeof Bun.serve>;
  baseUrl: string;
  db: Database;
}

/**
 * Create a test server with in-memory database
 *
 * IMPORTANT: This function passes configuration directly to Slap.init() instead of
 * modifying process.env, ensuring proper test isolation when running concurrently.
 */
export function createTestServer(options?: {
  port?: number;
  nodeEnv?: string;
  betterAuthSecret?: string;
  betterAuthUrl?: string;
  trustedOrigins?: string;
}): TestServer {
  const db = createTestDatabase();

  // Pass configuration directly to Slap.init instead of modifying process.env
  // This ensures tests can run concurrently without interfering with each other
  const server = Slap.init({
    db,
    port: options?.port ?? 0,
    authConfig: {
      secret: options?.betterAuthSecret ?? "test-secret-key-for-testing-only",
      baseURL: options?.betterAuthUrl,
      trustedOrigins: options?.trustedOrigins,
      nodeEnv: options?.nodeEnv ?? "development",
    },
    seedConfig: {
      mode: options?.nodeEnv === 'production' ? 'production' : 'development',
      adminEmail: options?.nodeEnv === 'production' ? "admin@production.com" : undefined,
      adminPassword: options?.nodeEnv === 'production' ? "production-test-password" : undefined,
      adminName: options?.nodeEnv === 'production' ? "Production Admin" : undefined,
    },
  });

  const baseUrl = `http://localhost:${server.port}`;

  return { server, baseUrl, db };
}

/**
 * Clean up test server
 */
export function cleanupTestServer(testServer: TestServer): void {
  if (testServer.server) {
    testServer.server.stop();
  }
  testServer.db.close();
}

/**
 * Check if security headers are present on a response
 */
export function checkSecurityHeaders(
  response: Response,
  isProduction = false,
): {
  hasAllHeaders: boolean;
  missingHeaders: string[];
  headers: Record<string, string>;
} {
  const requiredHeaders = [
    "X-Frame-Options",
    "X-Content-Type-Options",
    "Referrer-Policy",
    "Permissions-Policy",
    "Content-Security-Policy",
  ];

  if (isProduction) {
    requiredHeaders.push("Strict-Transport-Security");
  }

  const headers: Record<string, string> = {};
  const missingHeaders: string[] = [];

  for (const headerName of requiredHeaders) {
    const value = response.headers.get(headerName);
    if (value) {
      headers[headerName] = value;
    } else {
      missingHeaders.push(headerName);
    }
  }

  return {
    hasAllHeaders: missingHeaders.length === 0,
    missingHeaders,
    headers,
  };
}

/**
 * Create a Better Auth test user
 */
export async function createTestUser(
  baseUrl: string,
  email: string,
  password: string,
  name: string,
): Promise<{ success: boolean; session?: string }> {
  // Sign up
  const signUpResponse = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: baseUrl,
    },
    body: JSON.stringify({
      email,
      password,
      name,
    }),
  });

  if (!signUpResponse.ok) {
    return { success: false };
  }

  // Sign in to get session
  const signInResponse = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: baseUrl,
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  if (!signInResponse.ok) {
    return { success: false };
  }

  // Extract session cookie
  const setCookieHeader = signInResponse.headers.get("set-cookie");
  const sessionMatch = setCookieHeader?.match(
    /better-auth\.session_token=([^;]+)/,
  );
  const session = sessionMatch ? sessionMatch[1] : undefined;

  return { success: true, session };
}

/**
 * Create an authenticated request with session cookie
 */
export function createAuthenticatedRequest(
  url: string,
  options: RequestInit & { session?: string } = {},
): RequestInit {
  const { session, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers);

  if (session) {
    headers.set("Cookie", `better-auth.session_token=${session}`);
  }

  return {
    ...fetchOptions,
    headers,
  };
}

/**
 * Create a request with a specific origin
 */
export function createRequestWithOrigin(
  url: string,
  origin: string,
  options: RequestInit = {},
): RequestInit {
  const headers = new Headers(options.headers);
  headers.set("Origin", origin);

  return {
    ...options,
    headers,
  };
}
