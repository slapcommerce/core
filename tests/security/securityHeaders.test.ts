import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { randomUUIDv7 } from 'bun';
import { createTestServer, cleanupTestServer, checkSecurityHeaders, createTestUser, type TestServer } from './helpers';

describe('Security Headers', () => {
  let testServer: TestServer;

  afterEach(() => {
    if (testServer) {
      cleanupTestServer(testServer);
    }
  });

  describe('JSON API Responses', () => {
    beforeEach(() => {
      testServer = createTestServer();
    });

    test('should include all security headers on successful admin commands response', async () => {
      // Arrange
      const url = `${testServer.baseUrl}/admin/api/commands`;
      
      // First create a user and get session
      const userResult = await createTestUser(
        testServer.baseUrl,
        'test@example.com',
        'password123',
        'Test User'
      );
      expect(userResult.success).toBe(true);
      expect(userResult.session).toBeDefined();

      // Act
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `better-auth.session_token=${userResult.session}`,
          'Origin': testServer.baseUrl,
        },
        body: JSON.stringify({
          type: 'createProduct',
          payload: {
            id: randomUUIDv7(),
            correlationId: randomUUIDv7(),
            title: 'Test Product',
            shortDescription: 'A test product',
            slug: `test-product-${Date.now()}`,
            collectionIds: [randomUUIDv7()],
            variantIds: [randomUUIDv7()],
            richDescriptionUrl: '',
            productType: 'physical',
            vendor: 'Test Vendor',
            variantOptions: [],
            metaTitle: '',
            metaDescription: '',
            tags: [],
            requiresShipping: true,
            taxable: true,
            pageLayoutId: null,
          },
        }),
      });

      // Assert
      expect(response.status).toBe(200);
      const securityCheck = checkSecurityHeaders(response, false);
      expect(securityCheck.hasAllHeaders).toBe(true);
      expect(securityCheck.missingHeaders).toEqual([]);
    });

    test('should include all security headers on error responses', async () => {
      // Arrange
      const url = `${testServer.baseUrl}/admin/api/commands`;

      // Act - Request without authentication
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': testServer.baseUrl,
        },
        body: JSON.stringify({ type: 'createProduct', payload: {} }),
      });

      // Assert
      expect(response.status).toBe(401);
      const securityCheck = checkSecurityHeaders(response, false);
      expect(securityCheck.hasAllHeaders).toBe(true);
    });

    test('should include X-Frame-Options header set to DENY', async () => {
      // Arrange
      const url = `${testServer.baseUrl}/api/queries`;

      // Act
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': testServer.baseUrl,
        },
        body: JSON.stringify({ type: 'productListView', params: {} }),
      });

      // Assert
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    });

    test('should include X-Content-Type-Options header set to nosniff', async () => {
      // Arrange
      const url = `${testServer.baseUrl}/api/queries`;

      // Act
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': testServer.baseUrl,
        },
        body: JSON.stringify({ type: 'productListView', params: {} }),
      });

      // Assert
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    test('should include Referrer-Policy header', async () => {
      // Arrange
      const url = `${testServer.baseUrl}/api/queries`;

      // Act
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': testServer.baseUrl,
        },
        body: JSON.stringify({ type: 'productListView', params: {} }),
      });

      // Assert
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    });

    test('should include Permissions-Policy header', async () => {
      // Arrange
      const url = `${testServer.baseUrl}/api/queries`;

      // Act
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': testServer.baseUrl,
        },
        body: JSON.stringify({ type: 'productListView', params: {} }),
      });

      // Assert
      const permissionsPolicy = response.headers.get('Permissions-Policy');
      expect(permissionsPolicy).toBeDefined();
      expect(permissionsPolicy).toContain('geolocation=()');
    });

    test('should include Content-Security-Policy header', async () => {
      // Arrange
      const url = `${testServer.baseUrl}/api/queries`;

      // Act
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': testServer.baseUrl,
        },
        body: JSON.stringify({ type: 'productListView', params: {} }),
      });

      // Assert
      const csp = response.headers.get('Content-Security-Policy');
      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
    });
  });

  describe('CORS Preflight Responses', () => {
    beforeEach(() => {
      testServer = createTestServer();
    });

    test('should include security headers on CORS preflight OPTIONS request', async () => {
      // Arrange
      const url = `${testServer.baseUrl}/admin/api/commands`;

      // Act
      const response = await fetch(url, {
        method: 'OPTIONS',
      });

      // Assert
      expect(response.status).toBe(200);
      const securityCheck = checkSecurityHeaders(response, false);
      expect(securityCheck.hasAllHeaders).toBe(true);
    });
  });

  describe('404 Responses', () => {
    beforeEach(() => {
      testServer = createTestServer();
    });

    test('should include security headers on 404 responses', async () => {
      // Arrange
      const url = `${testServer.baseUrl}/unknown/route`;

      // Act
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Assert
      expect(response.status).toBe(404);
      const securityCheck = checkSecurityHeaders(response, false);
      expect(securityCheck.hasAllHeaders).toBe(true);
    });
  });

  describe('Better Auth Endpoints', () => {
    beforeEach(() => {
      testServer = createTestServer();
    });

    test('should include security headers on sign-up endpoint', async () => {
      // Arrange
      const url = `${testServer.baseUrl}/api/auth/sign-up/email`;

      // Act
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': testServer.baseUrl,
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        }),
      });

      // Assert
      const securityCheck = checkSecurityHeaders(response, false);
      expect(securityCheck.hasAllHeaders).toBe(true);
    });

    test('should include security headers on sign-in endpoint', async () => {
      // Arrange
      const url = `${testServer.baseUrl}/api/auth/sign-in/email`;
      
      // First create a user
      await createTestUser(
        testServer.baseUrl,
        'test@example.com',
        'password123',
        'Test User'
      );

      // Act
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': testServer.baseUrl,
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
        }),
      });

      // Assert
      const securityCheck = checkSecurityHeaders(response, false);
      expect(securityCheck.hasAllHeaders).toBe(true);
    });
  });

  describe('HSTS Header', () => {
    test('should include HSTS header in production mode', async () => {
      // Arrange
      testServer = createTestServer({ nodeEnv: 'production' });
      const url = `${testServer.baseUrl}/api/queries`;

      // Act
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': testServer.baseUrl,
        },
        body: JSON.stringify({ type: 'productListView', params: {} }),
      });

      // Assert
      const hsts = response.headers.get('Strict-Transport-Security');
      expect(hsts).toBeDefined();
      expect(hsts).toContain('max-age=31536000');
      expect(hsts).toContain('includeSubDomains');
    });

    test('should not include HSTS header in development mode', async () => {
      // Arrange
      testServer = createTestServer({ nodeEnv: 'development' });
      const url = `${testServer.baseUrl}/api/queries`;

      // Act
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': testServer.baseUrl,
        },
        body: JSON.stringify({ type: 'productListView', params: {} }),
      });

      // Assert
      const hsts = response.headers.get('Strict-Transport-Security');
      expect(hsts).toBeNull();
    });
  });
});

