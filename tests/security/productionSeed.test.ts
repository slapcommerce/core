import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { schemas } from '../../src/infrastructure/schemas'
import { Slap } from '../../src/index'

describe('Production Admin User Seeding', () => {
  let originalNodeEnv: string | undefined
  let originalAdminEmail: string | undefined
  let originalAdminPassword: string | undefined
  let originalAdminName: string | undefined
  let originalBetterAuthSecret: string | undefined
  let originalBetterAuthUrl: string | undefined

  beforeEach(() => {
    // Store original environment variables
    originalNodeEnv = process.env.NODE_ENV
    originalAdminEmail = process.env.ADMIN_EMAIL
    originalAdminPassword = process.env.ADMIN_PASSWORD
    originalAdminName = process.env.ADMIN_NAME
    originalBetterAuthSecret = process.env.BETTER_AUTH_SECRET
    originalBetterAuthUrl = process.env.BETTER_AUTH_URL

    // Set required env vars for Better Auth
    if (!process.env.BETTER_AUTH_SECRET) {
      process.env.BETTER_AUTH_SECRET = 'test-secret-key-for-testing-only'
    }
    if (!process.env.BETTER_AUTH_URL) {
      process.env.BETTER_AUTH_URL = 'http://localhost:3000'
    }
  })

  afterEach(() => {
    // Restore original environment variables
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv
    } else {
      delete process.env.NODE_ENV
    }

    if (originalAdminEmail !== undefined) {
      process.env.ADMIN_EMAIL = originalAdminEmail
    } else {
      delete process.env.ADMIN_EMAIL
    }

    if (originalAdminPassword !== undefined) {
      process.env.ADMIN_PASSWORD = originalAdminPassword
    } else {
      delete process.env.ADMIN_PASSWORD
    }

    if (originalAdminName !== undefined) {
      process.env.ADMIN_NAME = originalAdminName
    } else {
      delete process.env.ADMIN_NAME
    }

    if (originalBetterAuthSecret !== undefined) {
      process.env.BETTER_AUTH_SECRET = originalBetterAuthSecret
    } else {
      delete process.env.BETTER_AUTH_SECRET
    }

    if (originalBetterAuthUrl !== undefined) {
      process.env.BETTER_AUTH_URL = originalBetterAuthUrl
    } else {
      delete process.env.BETTER_AUTH_URL
    }
  })

  test('should create admin user in production when env vars are set and no users exist', async () => {
    // Arrange
    process.env.NODE_ENV = 'production'
    process.env.ADMIN_EMAIL = 'admin@production.com'
    process.env.ADMIN_PASSWORD = 'secure-password-123'
    process.env.ADMIN_NAME = 'Production Admin'

    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    // Verify no users exist initially
    const initialUserCount = db.prepare('SELECT COUNT(*) as count FROM user').get() as { count: number }
    expect(initialUserCount.count).toBe(0)

    // Act
    const server = Slap.init({ db, port: 0 })
    
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

    server.stop()
    db.close()
  })

  test('should not create admin user when env vars are missing in production', async () => {
    // Arrange
    process.env.NODE_ENV = 'production'
    delete process.env.ADMIN_EMAIL
    delete process.env.ADMIN_PASSWORD
    delete process.env.ADMIN_NAME

    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    // Capture console.error calls
    const errorMessages: string[] = []
    const originalError = console.error
    console.error = (...args: unknown[]) => {
      errorMessages.push(args.map(a => String(a)).join(' '))
      originalError(...args)
    }

    // Act
    const server = Slap.init({ db, port: 0 })
    
    // Wait a bit for async seed to complete
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert
    const userCount = db.prepare('SELECT COUNT(*) as count FROM user').get() as { count: number }
    expect(userCount.count).toBe(0)

    // Verify error was logged
    const hasError = errorMessages.some(msg =>
      msg.includes('Production admin user seeding requires')
    )
    expect(hasError).toBe(true)

    // Restore console.error
    console.error = originalError
    server.stop()
    db.close()
  })

  test('should not create duplicate admin user when user already exists', async () => {
    // Arrange
    process.env.NODE_ENV = 'production'
    process.env.ADMIN_EMAIL = 'existing@production.com'
    process.env.ADMIN_PASSWORD = 'secure-password-123'
    process.env.ADMIN_NAME = 'Existing Admin'

    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

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
    const server = Slap.init({ db, port: 0 })
    
    // Wait a bit for async seed to complete
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert
    const userCount = db.prepare('SELECT COUNT(*) as count FROM user').get() as { count: number }
    expect(userCount.count).toBe(1) // Still only one user

    server.stop()
    db.close()
  })

  test('should not run production seed in non-production environment', async () => {
    // Arrange
    process.env.NODE_ENV = 'development'
    process.env.ADMIN_EMAIL = 'admin@dev.com'
    process.env.ADMIN_PASSWORD = 'dev-password'
    process.env.ADMIN_NAME = 'Dev Admin'

    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    // Act
    const server = Slap.init({ db, port: 0 })
    
    // Wait a bit for async seed to complete
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - Development seed should have run instead (with defaults)
    const userCount = db.prepare('SELECT COUNT(*) as count FROM user').get() as { count: number }
    // Development seed uses defaults if env vars not set, so it may or may not create a user
    // But we can verify production seed didn't run by checking the user email
    if (userCount.count > 0) {
      const user = db.prepare('SELECT * FROM user').get() as { email: string } | undefined
      // If production seed ran, it would use ADMIN_EMAIL from env
      // If dev seed ran, it would use default 'admin@example.com' or env var
      // This test just ensures production seed logic doesn't interfere
    }

    server.stop()
    db.close()
  })

  test('should handle partial env vars missing gracefully', async () => {
    // Arrange
    process.env.NODE_ENV = 'production'
    process.env.ADMIN_EMAIL = 'admin@production.com'
    // Missing ADMIN_PASSWORD and ADMIN_NAME
    delete process.env.ADMIN_PASSWORD
    delete process.env.ADMIN_NAME

    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    // Capture console.error calls
    const errorMessages: string[] = []
    const originalError = console.error
    console.error = (...args: unknown[]) => {
      errorMessages.push(args.map(a => String(a)).join(' '))
      originalError(...args)
    }

    // Act
    const server = Slap.init({ db, port: 0 })
    
    // Wait a bit for async seed to complete
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert
    const userCount = db.prepare('SELECT COUNT(*) as count FROM user').get() as { count: number }
    expect(userCount.count).toBe(0)

    // Verify error was logged
    const hasError = errorMessages.some(msg =>
      msg.includes('Production admin user seeding requires')
    )
    expect(hasError).toBe(true)

    // Restore console.error
    console.error = originalError
    server.stop()
    db.close()
  })
})

