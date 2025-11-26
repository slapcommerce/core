import { describe, test, expect } from 'bun:test'
import { createTestDatabase, closeTestDatabase } from '../helpers/database'
import { Slap } from '../../src/index'

describe('Production Admin User Seeding', () => {
  test('should create admin user in production when credentials provided and no users exist', async () => {
    // Arrange
    const db = createTestDatabase()
    let server: ReturnType<typeof Slap.init> | undefined

    try {
      // Verify no users exist initially
      const initialUserCount = db.prepare('SELECT COUNT(*) as count FROM user').get() as { count: number }
      expect(initialUserCount.count).toBe(0)

      // Act
      server = Slap.init({
        db,
        port: 0,
        seedConfig: {
          mode: 'production',
          adminEmail: 'admin@production.com',
          adminPassword: 'secure-password-123',
          adminName: 'Production Admin'
        },
        authConfig: {
          secret: 'test-secret-production-1',
          nodeEnv: 'production'
        }
      })

      // Wait a bit for async seed to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      // Assert
      const userCount = db.prepare('SELECT COUNT(*) as count FROM user').get() as { count: number }
      expect(userCount.count).toBe(1)

      const user = db.prepare('SELECT * FROM user WHERE email = ?').get('admin@production.com') as {
        email: string
        name: string
      } | undefined
      expect(user).toBeDefined()
      expect(user?.email).toBe('admin@production.com')
      expect(user?.name).toBe('Production Admin')
    } finally {
      if (server) {
        server.stop()
      }
      closeTestDatabase(db)
    }
  })

  test('should not create admin user when credentials are missing in production', async () => {
    // Arrange
    const db = createTestDatabase()
    let server: ReturnType<typeof Slap.init> | undefined

    try {
      // Act - production mode without credentials should error
      server = Slap.init({
        db,
        port: 0,
        seedConfig: {
          mode: 'production'
          // Missing adminEmail, adminPassword, adminName
        },
        authConfig: {
          secret: 'test-secret-production-2',
          nodeEnv: 'production'
        }
      })

      // Wait a bit for async seed to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      // Assert - no user should be created when credentials are missing
      const userCount = db.prepare('SELECT COUNT(*) as count FROM user').get() as { count: number }
      expect(userCount.count).toBe(0)
    } finally {
      if (server) {
        server.stop()
      }
      closeTestDatabase(db)
    }
  })

  test('should not create duplicate admin user when user already exists', async () => {
    // Arrange
    const db = createTestDatabase()
    let server: ReturnType<typeof Slap.init> | undefined

    try {
      // Create an existing user manually
      const existingUserId = crypto.randomUUID()
      db.prepare(`
        INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        existingUserId,
        'Existing User',
        'existing@production.com',
        1,
        new Date().toISOString(),
        new Date().toISOString()
      )

      const initialUserCount = db.prepare('SELECT COUNT(*) as count FROM user').get() as { count: number }
      expect(initialUserCount.count).toBe(1)

      // Act
      server = Slap.init({
        db,
        port: 0,
        seedConfig: {
          mode: 'production',
          adminEmail: 'existing@production.com',
          adminPassword: 'secure-password-123',
          adminName: 'Existing Admin'
        },
        authConfig: {
          secret: 'test-secret-production-3',
          nodeEnv: 'production'
        }
      })

      // Wait a bit for async seed to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      // Assert
      const userCount = db.prepare('SELECT COUNT(*) as count FROM user').get() as { count: number }
      expect(userCount.count).toBe(1) // Still only one user
    } finally {
      if (server) {
        server.stop()
      }
      closeTestDatabase(db)
    }
  })

  test('should not run production seed in development mode', async () => {
    // Arrange
    const db = createTestDatabase()
    let server: ReturnType<typeof Slap.init> | undefined

    try {
      // Act
      server = Slap.init({
        db,
        port: 0,
        seedConfig: {
          mode: 'development'
        },
        authConfig: {
          secret: 'test-secret-for-dev-mode',
          nodeEnv: 'development'
        }
      })

      // Wait a bit for async seed to complete
      await new Promise(resolve => setTimeout(resolve, 200))

      // Assert - Development seed should have run (with defaults)
      const userCount = db.prepare('SELECT COUNT(*) as count FROM user').get() as { count: number }
      // Development seed uses defaults, so it should create a user
      expect(userCount.count).toBe(1)

      const user = db.prepare('SELECT * FROM user').get() as { email: string } | undefined
      // Dev seed uses default email from seedAdminUser function
      // Note: If this fails intermittently in concurrent mode, it might indicate timing or isolation issues
      expect(user?.email).toBe('admin@example.com')
    } finally {
      if (server) {
        server.stop()
      }
      closeTestDatabase(db)
    }
  })

  test('should handle partial credentials missing gracefully', async () => {
    // Arrange
    const db = createTestDatabase()
    let server: ReturnType<typeof Slap.init> | undefined

    try {
      // Act - production mode with only email, missing password and name
      server = Slap.init({
        db,
        port: 0,
        seedConfig: {
          mode: 'production',
          adminEmail: 'admin@production.com'
          // Missing adminPassword and adminName
        },
        authConfig: {
          secret: 'test-secret-production-4',
          nodeEnv: 'production'
        }
      })

      // Wait a bit for async seed to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      // Assert - no user should be created when credentials are incomplete
      const userCount = db.prepare('SELECT COUNT(*) as count FROM user').get() as { count: number }
      expect(userCount.count).toBe(0)
    } finally {
      if (server) {
        server.stop()
      }
      closeTestDatabase(db)
    }
  })
})

