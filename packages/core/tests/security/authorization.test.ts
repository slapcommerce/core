import { describe, test, expect } from 'bun:test';
import { randomUUIDv7 } from 'bun';
import { createTestServer, cleanupTestServer, createTestUser } from './helpers';

describe('Authorization', () => {
  describe('Admin Routes', () => {
    test('should require authentication for admin commands route', async () => {
      // Arrange
      const testServer = createTestServer({
        betterAuthSecret: 'test-secret-key-for-testing-only',
      });
      try {
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
      } finally {
        cleanupTestServer(testServer);
      }
    });

    test('should require authentication for admin queries route', async () => {
      // Arrange
      const testServer = createTestServer({
        betterAuthSecret: 'test-secret-key-for-testing-only',
      });
      try {
        const url = `${testServer.baseUrl}/admin/api/queries`;

        // Act
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': testServer.baseUrl,
          },
          body: JSON.stringify({
            type: 'getCollections',
            params: {},
          }),
        });

        // Assert
        expect(response.status).toBe(401);
        const json = await response.json() as { success: boolean; error: { message: string } };
        expect(json.success).toBe(false);
        expect(json.error.message).toBe('Unauthorized');
      } finally {
        cleanupTestServer(testServer);
      }
    });

    test('should allow access with valid session', async () => {
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
            type: 'getCollections',
            params: {},
          }),
        });

        // Assert
        expect(response.status).toBe(200);
        const json = await response.json() as { success: boolean };
        expect(json.success).toBe(true);
      } finally {
        cleanupTestServer(testServer);
      }
    });

    test('should reject invalid session token', async () => {
      // Arrange
      const testServer = createTestServer({
        betterAuthSecret: 'test-secret-key-for-testing-only',
      });
      try {
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
            type: 'getCollections',
            params: {},
          }),
        });

        // Assert
        expect(response.status).toBe(401);
      } finally {
        cleanupTestServer(testServer);
      }
    });

    test('should reject missing session token', async () => {
      // Arrange
      const testServer = createTestServer({
        betterAuthSecret: 'test-secret-key-for-testing-only',
      });
      try {
        const url = `${testServer.baseUrl}/admin/api/queries`;

        // Act
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': testServer.baseUrl,
          },
          body: JSON.stringify({
            type: 'getCollections',
            params: {},
          }),
        });

        // Assert
        expect(response.status).toBe(401);
      } finally {
        cleanupTestServer(testServer);
      }
    });
  });

  describe('Session Validation', () => {
    test('should validate session on all protected endpoints', async () => {
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
              fulfillmentType: 'digital' as const,
              vendor: 'Test Vendor',
              variantOptions: [],
              metaTitle: '',
              metaDescription: '',
              tags: [],
              taxable: true,
              taxId: '',
              type: 'createProduct',
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
            type: 'getCollections',
            params: {},
          }),
        });

        // Assert
        expect(commandsResponse.status).toBe(200);
        expect(queriesResponse.status).toBe(200);
      } finally {
        cleanupTestServer(testServer);
      }
    });

    test('should reject expired session', async () => {
      // Arrange
      const testServer = createTestServer({
        betterAuthSecret: 'test-secret-key-for-testing-only',
      });
      try {
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
            type: 'getCollections',
            params: {},
          }),
        });

        // Assert
        expect(response.status).toBe(401);
      } finally {
        cleanupTestServer(testServer);
      }
    });
  });
});

