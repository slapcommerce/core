import { describe, test, expect } from 'bun:test';
import { createTestServer, cleanupTestServer, checkSecurityHeaders, createTestUser } from './helpers';

describe('Better Auth Endpoints Security', () => {
  describe('Security Headers on Auth Endpoints', () => {
    test('should include security headers on sign-up endpoint', async () => {
      // Arrange
      const testServer = createTestServer({ 
        betterAuthSecret: 'test-secret-key-for-testing-only',
      });
      try {
        const url = `${testServer.baseUrl}/api/auth/sign-up/email`;

        // Act
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': testServer.baseUrl,
          },
          body: JSON.stringify({
            email: `test-${Date.now()}@example.com`,
            password: 'password123',
            name: 'Test User',
          }),
        });

        // Assert
        const securityCheck = checkSecurityHeaders(response, false);
        expect(securityCheck.hasAllHeaders).toBe(true);
        expect(securityCheck.missingHeaders).toEqual([]);
      } finally {
        cleanupTestServer(testServer);
      }
    });

    test('should include security headers on sign-in endpoint', async () => {
      // Arrange
      const testServer = createTestServer({ 
        betterAuthSecret: 'test-secret-key-for-testing-only',
      });
      try {
        const email = `test-${Date.now()}@example.com`;
        const password = 'password123';

        // Create user first
        await fetch(`${testServer.baseUrl}/api/auth/sign-up/email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': testServer.baseUrl,
          },
          body: JSON.stringify({ email, password, name: 'Test User' }),
        });

        const url = `${testServer.baseUrl}/api/auth/sign-in/email`;

        // Act
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': testServer.baseUrl,
          },
          body: JSON.stringify({
            email,
            password,
          }),
        });

        // Assert
        const securityCheck = checkSecurityHeaders(response, false);
        expect(securityCheck.hasAllHeaders).toBe(true);
      } finally {
        cleanupTestServer(testServer);
      }
    });

    test('should include security headers on sign-out endpoint', async () => {
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
        expect(userResult.success).toBe(true);

        const url = `${testServer.baseUrl}/api/auth/sign-out`;

        // Act
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `better-auth.session_token=${userResult.session}`,
            'Origin': testServer.baseUrl,
          },
        });

        // Assert
        const securityCheck = checkSecurityHeaders(response, false);
        expect(securityCheck.hasAllHeaders).toBe(true);
      } finally {
        cleanupTestServer(testServer);
      }
    });

    test('should include security headers on session endpoint', async () => {
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
        expect(userResult.success).toBe(true);

        const url = `${testServer.baseUrl}/api/auth/session`;

        // Act
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Cookie': `better-auth.session_token=${userResult.session}`,
            'Origin': testServer.baseUrl,
          },
        });

        // Assert
        const securityCheck = checkSecurityHeaders(response, false);
        expect(securityCheck.hasAllHeaders).toBe(true);
      } finally {
        cleanupTestServer(testServer);
      }
    });

    test('should include security headers on all /api/auth/* endpoints', async () => {
      // Arrange
      const testServer = createTestServer({ 
        betterAuthSecret: 'test-secret-key-for-testing-only',
      });
      try {
        const endpoints = [
          '/api/auth/sign-up/email',
          '/api/auth/sign-in/email',
        ];

        for (const endpoint of endpoints) {
          // Act
          const response = await fetch(`${testServer.baseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Origin': testServer.baseUrl,
            },
            body: JSON.stringify({
              email: `test-${Date.now()}@example.com`,
              password: 'password123',
              name: 'Test User',
            }),
          });

          // Assert
          const securityCheck = checkSecurityHeaders(response, false);
          expect(securityCheck.hasAllHeaders).toBe(true);
        }
      } finally {
        cleanupTestServer(testServer);
      }
    });
  });

  describe('CSP Header on Auth Endpoints', () => {
    test('should include Content-Security-Policy on sign-up', async () => {
      // Arrange
      const testServer = createTestServer({ 
        betterAuthSecret: 'test-secret-key-for-testing-only',
      });
      try {
        const url = `${testServer.baseUrl}/api/auth/sign-up/email`;

        // Act
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': testServer.baseUrl,
          },
          body: JSON.stringify({
            email: `test-${Date.now()}@example.com`,
            password: 'password123',
            name: 'Test User',
          }),
        });

        // Assert
        const csp = response.headers.get('Content-Security-Policy');
        expect(csp).toBeDefined();
        expect(csp).toContain("default-src 'self'");
      } finally {
        cleanupTestServer(testServer);
      }
    });
  });

  describe('X-Frame-Options on Auth Endpoints', () => {
    test('should set X-Frame-Options to DENY on sign-in', async () => {
      // Arrange
      const testServer = createTestServer({ 
        betterAuthSecret: 'test-secret-key-for-testing-only',
      });
      try {
        const email = `test-${Date.now()}@example.com`;
        const password = 'password123';

        // Create user first
        await fetch(`${testServer.baseUrl}/api/auth/sign-up/email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': testServer.baseUrl,
          },
          body: JSON.stringify({ email, password, name: 'Test User' }),
        });

        const url = `${testServer.baseUrl}/api/auth/sign-in/email`;

        // Act
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': testServer.baseUrl,
          },
          body: JSON.stringify({ email, password }),
        });

        // Assert
        expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      } finally {
        cleanupTestServer(testServer);
      }
    });
  });
});

