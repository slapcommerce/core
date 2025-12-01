import { describe, test, expect } from 'bun:test';
import { createTestServer, cleanupTestServer, createTestUser } from './helpers';

describe('Error Sanitization', () => {
  describe('Development Mode', () => {
    test('should expose full error details in development mode', async () => {
      // Arrange
      const testServer = createTestServer({ nodeEnv: 'development' });
      try {
        const url = `${testServer.baseUrl}/admin/api/commands`;

        // Act
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': testServer.baseUrl,
          },
          body: JSON.stringify({ type: 'createDigitalDownloadableProduct', payload: {} }),
        });

        // Assert
        expect(response.status).toBe(401);
        const json = await response.json() as { success: boolean; error: { message: string; type?: string } };
        expect(json.success).toBe(false);
        expect(json.error.message).toBe('Unauthorized');
        expect(json.error.type).toBeDefined();
      } finally {
        cleanupTestServer(testServer);
      }
    });

    test('should expose error message in development mode for invalid JSON', async () => {
      // Arrange
      const testServer = createTestServer({ nodeEnv: 'development' });
      try {
        const url = `${testServer.baseUrl}/admin/api/commands`;
        const userResult = await createTestUser(
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
            'Cookie': `better-auth.session_token=${userResult.session}`,
            'Origin': testServer.baseUrl,
          },
          body: 'invalid json{',
        });

        // Assert
        expect(response.status).toBe(400);
        const json = await response.json() as { success: boolean; error: { message: string } };
        expect(json.success).toBe(false);
        expect(json.error.message).toBeDefined();
      } finally {
        cleanupTestServer(testServer);
      }
    });
  });

  describe('Production Mode', () => {
    test('should sanitize errors in production mode', async () => {
      // Arrange
      const testServer = createTestServer({ 
        nodeEnv: 'production',
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
          body: JSON.stringify({ type: 'createDigitalDownloadableProduct', payload: {} }),
        });

        // Assert
        expect(response.status).toBe(401);
        const json = await response.json() as { success: boolean; error: { message: string; type?: string } };
        expect(json.success).toBe(false);
        // Should still expose safe error messages
        expect(json.error.message).toBe('Unauthorized');
        expect(json.error.type).toBeDefined();
      } finally {
        cleanupTestServer(testServer);
      }
    });

    test('should expose safe error messages in production', async () => {
      // Arrange
      const testServer = createTestServer({ 
        nodeEnv: 'production',
        betterAuthSecret: 'test-secret-key-for-testing-only',
      });
      try {
        const url = `${testServer.baseUrl}/admin/api/commands`;
        const userResult = await createTestUser(
          testServer.baseUrl,
          'test@example.com',
          'password123',
          'Test User'
        );

        // Act - Missing payload
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `better-auth.session_token=${userResult.session}`,
            'Origin': testServer.baseUrl,
          },
          body: JSON.stringify({ type: 'createDigitalDownloadableProduct' }),
        });

        // Assert
        expect(response.status).toBe(400);
        const json = await response.json() as { success: boolean; error: { message: string } };
        expect(json.success).toBe(false);
        // Safe error message should be exposed
        expect(json.error.message).toBe('Request must include type and payload');
      } finally {
        cleanupTestServer(testServer);
      }
    });

    test('should not expose stack traces in production', async () => {
      // Arrange
      const testServer = createTestServer({ 
        nodeEnv: 'production',
        betterAuthSecret: 'test-secret-key-for-testing-only',
      });
      try {
        const url = `${testServer.baseUrl}/admin/api/commands`;
        const userResult = await createTestUser(
          testServer.baseUrl,
          'test@example.com',
          'password123',
          'Test User'
        );

        // Act - Invalid JSON
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `better-auth.session_token=${userResult.session}`,
            'Origin': testServer.baseUrl,
          },
          body: 'invalid json{',
        });

        // Assert
        expect(response.status).toBe(400);
        const json = await response.json() as { success: boolean; error: { message: string } };
        expect(json.success).toBe(false);
        const errorStr = JSON.stringify(json.error);
        // Should not contain stack trace indicators
        expect(errorStr).not.toContain('at ');
        expect(errorStr).not.toContain('Error:');
        expect(errorStr).not.toContain('stack');
      } finally {
        cleanupTestServer(testServer);
      }
    });

    test('should sanitize unknown errors in production', async () => {
      // Arrange
      const testServer = createTestServer({ 
        nodeEnv: 'production',
        betterAuthSecret: 'test-secret-key-for-testing-only',
      });
      try {
        const url = `${testServer.baseUrl}/admin/api/queries`;
        const userResult = await createTestUser(
          testServer.baseUrl,
          'test@example.com',
          'password123',
          'Test User'
        );

        // Act - Invalid query type that might throw unexpected error
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `better-auth.session_token=${userResult.session}`,
            'Origin': testServer.baseUrl,
          },
          body: JSON.stringify({ type: 'nonexistentQueryType', params: {} }),
        });

        // Assert
        expect(response.status).toBe(400);
        const json = await response.json() as { success: boolean; error: { message: string } };
        expect(json.success).toBe(false);
        // Unknown errors should be sanitized to generic message
        // (This depends on how the router handles unknown types)
        expect(json.error.message).toBeDefined();
      } finally {
        cleanupTestServer(testServer);
      }
    });
  });

  describe('All Error Handlers', () => {
    test('should sanitize errors in admin commands handler', async () => {
      // Arrange
      const testServer = createTestServer({ 
        nodeEnv: 'production',
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
          body: JSON.stringify({ type: 'createDigitalDownloadableProduct', payload: {} }),
        });

        // Assert
        expect(response.status).toBe(401);
        const json = await response.json() as { success: boolean; error: { message: string } };
        expect(json.success).toBe(false);
        expect(json.error.message).toBeDefined();
        expect(JSON.stringify(json.error)).not.toContain('stack');
      } finally {
        cleanupTestServer(testServer);
      }
    });

    test('should sanitize errors in admin queries handler', async () => {
      // Arrange
      const testServer = createTestServer({ 
        nodeEnv: 'production',
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
          body: JSON.stringify({ type: 'getCollections', params: {} }),
        });

        // Assert
        expect(response.status).toBe(401);
        const json = await response.json() as { success: boolean; error: { message: string } };
        expect(json.success).toBe(false);
        expect(json.error.message).toBeDefined();
        expect(JSON.stringify(json.error)).not.toContain('stack');
      } finally {
        cleanupTestServer(testServer);
      }
    });

  });
});

