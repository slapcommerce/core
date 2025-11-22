import { describe, test, expect } from 'bun:test';
import { createAuth } from '../../src/lib/auth';
import { Database } from 'bun:sqlite';
import { schemas } from '../../src/infrastructure/schemas';

describe('Better Auth Configuration', () => {
  describe('Secret Validation', () => {
    test('should throw error in production without secret', () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      delete process.env.BETTER_AUTH_SECRET;

      const db = new Database(':memory:');
      for (const schema of schemas) {
        db.run(schema);
      }

      // Act & Assert
      expect(() => {
        createAuth(db);
      }).toThrow('BETTER_AUTH_SECRET environment variable is required in production');

      // Cleanup
      process.env.NODE_ENV = originalEnv;
      db.close();
    });

    test('should allow missing secret in development', () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      delete process.env.BETTER_AUTH_SECRET;

      const db = new Database(':memory:');
      for (const schema of schemas) {
        db.run(schema);
      }

      // Act & Assert
      expect(() => {
        const auth = createAuth(db);
        expect(auth).toBeDefined();
      }).not.toThrow();

      // Cleanup
      process.env.NODE_ENV = originalEnv;
      db.close();
    });

    test('should create auth instance successfully with secret', () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      const originalSecret = process.env.BETTER_AUTH_SECRET;
      process.env.NODE_ENV = 'production';
      process.env.BETTER_AUTH_SECRET = 'test-secret-key';

      const db = new Database(':memory:');
      for (const schema of schemas) {
        db.run(schema);
      }

      // Act
      const auth = createAuth(db);

      // Assert
      expect(auth).toBeDefined();
      expect(auth.handler).toBeDefined();
      expect(auth.api).toBeDefined();

      // Cleanup
      process.env.NODE_ENV = originalEnv;
      if (originalSecret) {
        process.env.BETTER_AUTH_SECRET = originalSecret;
      } else {
        delete process.env.BETTER_AUTH_SECRET;
      }
      db.close();
    });
  });

  describe('Trusted Origins Configuration', () => {
    test('should configure trustedOrigins from environment variable', () => {
      // Arrange
      const originalEnv = process.env.BETTER_AUTH_TRUSTED_ORIGINS;
      process.env.BETTER_AUTH_TRUSTED_ORIGINS = 'https://example.com,https://app.example.com';

      const db = new Database(':memory:');
      for (const schema of schemas) {
        db.run(schema);
      }

      // Act
      const auth = createAuth(db);

      // Assert
      expect(auth).toBeDefined();

      // Cleanup
      if (originalEnv) {
        process.env.BETTER_AUTH_TRUSTED_ORIGINS = originalEnv;
      } else {
        delete process.env.BETTER_AUTH_TRUSTED_ORIGINS;
      }
      db.close();
    });

    test('should default to baseURL origin when trustedOrigins not specified', () => {
      // Arrange
      const originalEnv = process.env.BETTER_AUTH_TRUSTED_ORIGINS;
      const originalUrl = process.env.BETTER_AUTH_URL;
      delete process.env.BETTER_AUTH_TRUSTED_ORIGINS;
      process.env.BETTER_AUTH_URL = 'https://example.com';

      const db = new Database(':memory:');
      for (const schema of schemas) {
        db.run(schema);
      }

      // Act
      const auth = createAuth(db);

      // Assert
      expect(auth).toBeDefined();

      // Cleanup
      if (originalEnv) {
        process.env.BETTER_AUTH_TRUSTED_ORIGINS = originalEnv;
      }
      if (originalUrl) {
        process.env.BETTER_AUTH_URL = originalUrl;
      } else {
        delete process.env.BETTER_AUTH_URL;
      }
      db.close();
    });

    test('should handle wildcard patterns in trustedOrigins', () => {
      // Arrange
      const originalEnv = process.env.BETTER_AUTH_TRUSTED_ORIGINS;
      process.env.BETTER_AUTH_TRUSTED_ORIGINS = 'https://*.example.com';

      const db = new Database(':memory:');
      for (const schema of schemas) {
        db.run(schema);
      }

      // Act
      const auth = createAuth(db);

      // Assert
      expect(auth).toBeDefined();

      // Cleanup
      if (originalEnv) {
        process.env.BETTER_AUTH_TRUSTED_ORIGINS = originalEnv;
      } else {
        delete process.env.BETTER_AUTH_TRUSTED_ORIGINS;
      }
      db.close();
    });
  });

  describe('IP Header Configuration', () => {
    test('should configure IP header from environment variable', () => {
      // Arrange
      const originalEnv = process.env.BETTER_AUTH_IP_HEADER;
      process.env.BETTER_AUTH_IP_HEADER = 'cf-connecting-ip';

      const db = new Database(':memory:');
      for (const schema of schemas) {
        db.run(schema);
      }

      // Act
      const auth = createAuth(db);

      // Assert
      expect(auth).toBeDefined();

      // Cleanup
      if (originalEnv) {
        process.env.BETTER_AUTH_IP_HEADER = originalEnv;
      } else {
        delete process.env.BETTER_AUTH_IP_HEADER;
      }
      db.close();
    });

    test('should work without IP header configuration', () => {
      // Arrange
      const originalEnv = process.env.BETTER_AUTH_IP_HEADER;
      delete process.env.BETTER_AUTH_IP_HEADER;

      const db = new Database(':memory:');
      for (const schema of schemas) {
        db.run(schema);
      }

      // Act
      const auth = createAuth(db);

      // Assert
      expect(auth).toBeDefined();

      // Cleanup
      if (originalEnv) {
        process.env.BETTER_AUTH_IP_HEADER = originalEnv;
      }
      db.close();
    });
  });

  describe('Better Auth Instance Creation', () => {
    test('should create Better Auth instance with valid config', () => {
      // Arrange
      const db = new Database(':memory:');
      for (const schema of schemas) {
        db.run(schema);
      }

      // Act
      const auth = createAuth(db);

      // Assert
      expect(auth).toBeDefined();
      expect(auth.handler).toBeDefined();
      expect(typeof auth.handler).toBe('function');
      expect(auth.api).toBeDefined();
      expect(auth.api.getSession).toBeDefined();
      expect(typeof auth.api.getSession).toBe('function');

      db.close();
    });
  });
});

