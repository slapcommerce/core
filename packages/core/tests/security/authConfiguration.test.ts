import { describe, test, expect } from 'bun:test';
import { createAuth } from '../../src/lib/auth';
import { Database } from 'bun:sqlite';
import { schemas } from '../../src/infrastructure/schemas';

describe('Better Auth Configuration', () => {
  describe('Secret Validation', () => {
    test('should throw error in production without secret', () => {
      // Arrange
      const db = new Database(':memory:');
      for (const schema of schemas) {
        db.run(schema);
      }

      // Act & Assert
      expect(() => {
        createAuth(db, { nodeEnv: 'production', secret: undefined });
      }).toThrow('BETTER_AUTH_SECRET environment variable is required in production');

      // Cleanup
      db.close();
    });

    test('should allow missing secret in development', () => {
      // Arrange
      const db = new Database(':memory:');
      for (const schema of schemas) {
        db.run(schema);
      }

      // Act & Assert
      expect(() => {
        const auth = createAuth(db, { nodeEnv: 'development', secret: undefined });
        expect(auth).toBeDefined();
      }).not.toThrow();

      // Cleanup
      db.close();
    });

    test('should create auth instance successfully with secret', () => {
      // Arrange
      const db = new Database(':memory:');
      for (const schema of schemas) {
        db.run(schema);
      }

      // Act
      const auth = createAuth(db, { nodeEnv: 'production', secret: 'test-secret-key' });

      // Assert
      expect(auth).toBeDefined();
      expect(auth.handler).toBeDefined();
      expect(auth.api).toBeDefined();

      // Cleanup
      db.close();
    });
  });

  describe('Trusted Origins Configuration', () => {
    test('should configure trustedOrigins from configuration', () => {
      // Arrange
      const db = new Database(':memory:');
      for (const schema of schemas) {
        db.run(schema);
      }

      // Act
      const auth = createAuth(db, {
        trustedOrigins: 'https://example.com,https://app.example.com',
        secret: 'test-secret'
      });

      // Assert
      expect(auth).toBeDefined();

      // Cleanup
      db.close();
    });

    test('should default to baseURL origin when trustedOrigins not specified', () => {
      // Arrange
      const db = new Database(':memory:');
      for (const schema of schemas) {
        db.run(schema);
      }

      // Act
      const auth = createAuth(db, {
        baseURL: 'https://example.com',
        secret: 'test-secret'
      });

      // Assert
      expect(auth).toBeDefined();

      // Cleanup
      db.close();
    });

    test('should handle wildcard patterns in trustedOrigins', () => {
      // Arrange
      const db = new Database(':memory:');
      for (const schema of schemas) {
        db.run(schema);
      }

      // Act
      const auth = createAuth(db, {
        trustedOrigins: 'https://*.example.com',
        secret: 'test-secret'
      });

      // Assert
      expect(auth).toBeDefined();

      // Cleanup
      db.close();
    });
  });

  describe('IP Header Configuration', () => {
    test('should configure IP header from configuration', () => {
      // Arrange
      const db = new Database(':memory:');
      for (const schema of schemas) {
        db.run(schema);
      }

      // Act
      const auth = createAuth(db, {
        ipHeader: 'cf-connecting-ip',
        secret: 'test-secret'
      });

      // Assert
      expect(auth).toBeDefined();

      // Cleanup
      db.close();
    });

    test('should work without IP header configuration', () => {
      // Arrange
      const db = new Database(':memory:');
      for (const schema of schemas) {
        db.run(schema);
      }

      // Act
      const auth = createAuth(db, { secret: 'test-secret' });

      // Assert
      expect(auth).toBeDefined();

      // Cleanup
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
      const auth = createAuth(db, { secret: 'test-secret' });

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

