import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { randomUUIDv7 } from 'bun';
import { createTestServer, cleanupTestServer, createTestUser, type TestServer } from './helpers';

describe('Authorization', () => {
  let testServer: TestServer;

  beforeEach(() => {
    testServer = createTestServer({ 
      betterAuthSecret: 'test-secret-key-for-testing-only',
    });
  });

  afterEach(() => {
    if (testServer) {
      cleanupTestServer(testServer);
    }
  });

  describe('Admin Routes', () => {
    test('should require authentication for admin commands route', async () => {
      // Arrange
      const url = `${testServer.baseUrl}/admin/api/commands`;

      // Act
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': testServer.baseUrl,
        },
        body: JSON.stringify({
          type: 'createProduct',
          payload: {
            id: 'test-id',
            title: 'Test',
            slug: 'test',
          },
        }),
      });

      // Assert
      expect(response.status).toBe(401);
      const json = await response.json() as { success: boolean; error: { message: string } };
      expect(json.success).toBe(false);
      expect(json.error.message).toBe('Unauthorized');
    });

    test('should require authentication for admin queries route', async () => {
      // Arrange
      const url = `${testServer.baseUrl}/admin/api/queries`;

      // Act
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': testServer.baseUrl,
        },
        body: JSON.stringify({
          type: 'productListView',
          params: {},
        }),
      });

      // Assert
      expect(response.status).toBe(401);
      const json = await response.json() as { success: boolean; error: { message: string } };
      expect(json.success).toBe(false);
      expect(json.error.message).toBe('Unauthorized');
    });

    test('should allow access with valid session', async () => {
      // Arrange
      const userResult = await createTestUser(
        testServer.baseUrl,
        `test-${Date.now()}@example.com`,
        'password123',
        'Test User'
      );
      expect(userResult.success).toBe(true);

      const url = `${testServer.baseUrl}/admin/api/queries`;

      // Act
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `better-auth.session_token=${userResult.session}`,
          'Origin': testServer.baseUrl,
        },
        body: JSON.stringify({
          type: 'productListView',
          params: {},
        }),
      });

      // Assert
      expect(response.status).toBe(200);
      const json = await response.json() as { success: boolean };
      expect(json.success).toBe(true);
    });

    test('should reject invalid session token', async () => {
      // Arrange
      const url = `${testServer.baseUrl}/admin/api/queries`;

      // Act
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'better-auth.session_token=invalid-token-12345',
          'Origin': testServer.baseUrl,
        },
        body: JSON.stringify({
          type: 'productListView',
          params: {},
        }),
      });

      // Assert
      expect(response.status).toBe(401);
    });

    test('should reject missing session token', async () => {
      // Arrange
      const url = `${testServer.baseUrl}/admin/api/queries`;

      // Act
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': testServer.baseUrl,
        },
        body: JSON.stringify({
          type: 'productListView',
          params: {},
        }),
      });

      // Assert
      expect(response.status).toBe(401);
    });
  });

  describe('Public Routes', () => {
    test('should not require authentication for public commands route', async () => {
      // Arrange
      const url = `${testServer.baseUrl}/api/commands`;

      // Act
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': testServer.baseUrl,
        },
        body: JSON.stringify({
          type: 'somePublicCommand',
        }),
      });

      // Assert
      // Should not return 401 (may return 400 for invalid command, but not 401)
      expect(response.status).not.toBe(401);
    });

    test('should not require authentication for public queries route', async () => {
      // Arrange
      const url = `${testServer.baseUrl}/api/queries`;

      // Act
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': testServer.baseUrl,
        },
        body: JSON.stringify({
          type: 'productListView',
          params: {},
        }),
      });

      // Assert
      // Should not return 401 (may return 400 for invalid query, but not 401)
      expect(response.status).not.toBe(401);
    });
  });

  describe('Session Validation', () => {
    test('should validate session on all protected endpoints', async () => {
      // Arrange
      const userResult = await createTestUser(
        testServer.baseUrl,
        `test-${Date.now()}@example.com`,
        'password123',
        'Test User'
      );
      expect(userResult.success).toBe(true);

      // Act - Test admin commands endpoint
      // Use a minimal valid command payload for testing session validation
      const commandsResponse = await fetch(`${testServer.baseUrl}/admin/api/commands`, {
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
            slug: `test-${Date.now()}`,
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

      // Act - Test admin queries endpoint
      const queriesResponse = await fetch(`${testServer.baseUrl}/admin/api/queries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `better-auth.session_token=${userResult.session}`,
          'Origin': testServer.baseUrl,
        },
        body: JSON.stringify({
          type: 'productListView',
          params: {},
        }),
      });

      // Assert
      expect(commandsResponse.status).toBe(200);
      expect(queriesResponse.status).toBe(200);
    });

    test('should reject expired session', async () => {
      // Arrange
      // Note: Testing expired sessions requires manipulating session expiration
      // This is a simplified test that verifies invalid sessions are rejected
      const url = `${testServer.baseUrl}/admin/api/queries`;

      // Act - Use a clearly invalid/expired-looking token
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'better-auth.session_token=expired.invalid.token',
          'Origin': testServer.baseUrl,
        },
        body: JSON.stringify({
          type: 'productListView',
          params: {},
        }),
      });

      // Assert
      expect(response.status).toBe(401);
    });
  });
});

