import { describe, test, expect } from 'bun:test';
import { createTestServer, cleanupTestServer, checkSecurityHeaders, createTestUser } from './helpers';

describe('Security Integration Tests', () => {
  describe('Full Authentication Flow with Security Headers', () => {
    test('should maintain security headers throughout authentication flow', async () => {
      // Arrange
      const testServer = createTestServer({ 
        betterAuthSecret: 'test-secret-key-for-testing-only',
      });
      try {
        const email = `test-${Date.now()}@example.com`;
        const password = 'password123';
        const name = 'Test User';

        // Act - Sign up
        const signUpResponse = await fetch(`${testServer.baseUrl}/api/auth/sign-up/email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': testServer.baseUrl,
          },
          body: JSON.stringify({ email, password, name }),
        });

        // Assert - Sign up has security headers
        const signUpSecurity = checkSecurityHeaders(signUpResponse, false);
        expect(signUpSecurity.hasAllHeaders).toBe(true);

        // Act - Sign in
        const signInResponse = await fetch(`${testServer.baseUrl}/api/auth/sign-in/email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': testServer.baseUrl,
          },
          body: JSON.stringify({ email, password }),
        });

        // Assert - Sign in has security headers
        const signInSecurity = checkSecurityHeaders(signInResponse, false);
        expect(signInSecurity.hasAllHeaders).toBe(true);

        // Extract session
        const setCookieHeader = signInResponse.headers.get('set-cookie');
        const sessionMatch = setCookieHeader?.match(/better-auth\.session_token=([^;]+)/);
        const session = sessionMatch ? sessionMatch[1] : undefined;
        expect(session).toBeDefined();

        // Act - Use authenticated endpoint
        const protectedResponse = await fetch(`${testServer.baseUrl}/admin/api/queries`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `better-auth.session_token=${session}`,
            'Origin': testServer.baseUrl,
          },
          body: JSON.stringify({
            type: 'productListView',
            params: {},
          }),
        });

        // Assert - Protected endpoint has security headers
        const protectedSecurity = checkSecurityHeaders(protectedResponse, false);
        expect(protectedSecurity.hasAllHeaders).toBe(true);
        expect(protectedResponse.status).toBe(200);
      } finally {
        cleanupTestServer(testServer);
      }
    });
  });

  describe('Error Handling with Security Headers', () => {
    test('should include security headers on error responses', async () => {
      // Arrange
      const testServer = createTestServer({ 
        betterAuthSecret: 'test-secret-key-for-testing-only',
      });
      try {
        const url = `${testServer.baseUrl}/admin/api/commands`;

        // Act - Unauthorized request
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': testServer.baseUrl,
          },
          body: JSON.stringify({
            type: 'createProduct',
            payload: {},
          }),
        });

        // Assert
        expect(response.status).toBe(401);
        const securityCheck = checkSecurityHeaders(response, false);
        expect(securityCheck.hasAllHeaders).toBe(true);

        const json = await response.json() as { success: boolean; error: { message: string } };
        expect(json.success).toBe(false);
        expect(json.error.message).toBeDefined();
      } finally {
        cleanupTestServer(testServer);
      }
    });

    test('should include security headers on validation errors', async () => {
      // Arrange
      const testServer = createTestServer({ 
        betterAuthSecret: 'test-secret-key-for-testing-only',
      });
      try {
        const userResult = await createTestUser(
          testServer.baseUrl,
          `test-${Date.now()}@example.com`,
          'password123',
          'Test User'
        );

        const url = `${testServer.baseUrl}/admin/api/commands`;

        // Act - Missing payload
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `better-auth.session_token=${userResult.session}`,
            'Origin': testServer.baseUrl,
          },
          body: JSON.stringify({
            type: 'createProduct',
          }),
        });

        // Assert
        expect(response.status).toBe(400);
        const securityCheck = checkSecurityHeaders(response, false);
        expect(securityCheck.hasAllHeaders).toBe(true);
      } finally {
        cleanupTestServer(testServer);
      }
    });
  });

  describe('CORS with Security Headers', () => {
    test('should include security headers on CORS preflight', async () => {
      // Arrange
      const testServer = createTestServer({ 
        betterAuthSecret: 'test-secret-key-for-testing-only',
      });
      try {
        const url = `${testServer.baseUrl}/admin/api/commands`;

        // Act
        const response = await fetch(url, {
          method: 'OPTIONS',
        });

        // Assert
        expect(response.status).toBe(200);
        const securityCheck = checkSecurityHeaders(response, false);
        expect(securityCheck.hasAllHeaders).toBe(true);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      } finally {
        cleanupTestServer(testServer);
      }
    });

    test('should include security headers on CORS actual request', async () => {
      // Arrange
      const testServer = createTestServer({ 
        betterAuthSecret: 'test-secret-key-for-testing-only',
      });
      try {
        const url = `${testServer.baseUrl}/api/queries`;

        // Act
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'https://example.com',
          },
          body: JSON.stringify({
            type: 'productListView',
            params: {},
          }),
        });

        // Assert
        const securityCheck = checkSecurityHeaders(response, false);
        expect(securityCheck.hasAllHeaders).toBe(true);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      } finally {
        cleanupTestServer(testServer);
      }
    });
  });

  describe('All Security Features Together', () => {
    test('should have all security features working together', async () => {
      // Arrange
      const testServer = createTestServer({ 
        betterAuthSecret: 'test-secret-key-for-testing-only',
      });
      try {
        const email = `test-${Date.now()}@example.com`;
        const password = 'password123';

        // Act - Sign up with security headers
        const signUpResponse = await fetch(`${testServer.baseUrl}/api/auth/sign-up/email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': testServer.baseUrl,
          },
          body: JSON.stringify({
            email,
            password,
            name: 'Test User',
          }),
        });

        // Assert - Security headers present
        const signUpSecurity = checkSecurityHeaders(signUpResponse, false);
        expect(signUpSecurity.hasAllHeaders).toBe(true);
        expect(signUpResponse.ok).toBe(true);

        // Act - Sign in
        const signInResponse = await fetch(`${testServer.baseUrl}/api/auth/sign-in/email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': testServer.baseUrl,
          },
          body: JSON.stringify({ email, password }),
        });

        // Assert - Security headers and session
        const signInSecurity = checkSecurityHeaders(signInResponse, false);
        expect(signInSecurity.hasAllHeaders).toBe(true);
        expect(signInResponse.ok).toBe(true);

        const setCookieHeader = signInResponse.headers.get('set-cookie');
        const sessionMatch = setCookieHeader?.match(/better-auth\.session_token=([^;]+)/);
        const session = sessionMatch ? sessionMatch[1] : undefined;

        // Act - Access protected resource
        const protectedResponse = await fetch(`${testServer.baseUrl}/admin/api/queries`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `better-auth.session_token=${session}`,
            'Origin': testServer.baseUrl,
          },
          body: JSON.stringify({
            type: 'productListView',
            params: {},
          }),
        });

        // Assert - All security features working
        const protectedSecurity = checkSecurityHeaders(protectedResponse, false);
        expect(protectedSecurity.hasAllHeaders).toBe(true);
        expect(protectedResponse.status).toBe(200);

        const json = await protectedResponse.json() as { success: boolean };
        expect(json.success).toBe(true);
      } finally {
        cleanupTestServer(testServer);
      }
    });

    test('should handle errors with security headers and sanitization', async () => {
      // Arrange
      const testServer = createTestServer({ 
        nodeEnv: 'production',
        betterAuthSecret: 'test-secret-key-for-testing-only',
      });
      try {
        const url = `${testServer.baseUrl}/admin/api/commands`;

        // Act - Unauthorized request in production
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': testServer.baseUrl,
          },
          body: JSON.stringify({
            type: 'createProduct',
            payload: {},
          }),
        });

        // Assert - Security headers present, error sanitized
        const securityCheck = checkSecurityHeaders(response, true); // Production mode
        expect(securityCheck.hasAllHeaders).toBe(true);
        expect(response.headers.get('Strict-Transport-Security')).toBeDefined();

        const json = await response.json() as { success: boolean; error: { message: string } };
        expect(json.success).toBe(false);
        expect(json.error.message).toBe('Unauthorized');
        // Should not contain stack traces
        expect(JSON.stringify(json.error)).not.toContain('stack');
      } finally {
        cleanupTestServer(testServer);
      }
    });
  });
});

