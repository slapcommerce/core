import { describe, test, expect } from 'bun:test'
import { randomUUIDv7 } from 'bun'
import { Slap } from '../src/index'
import { createTestDatabase, closeTestDatabase } from './helpers/database'

// Helper to create test user and get session
async function createTestUser(baseUrl: string): Promise<string> {
  const email = `test-${Date.now()}@example.com`
  const password = 'password123'
  const name = 'Test User'

  // Sign up
  const signUpResponse = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': baseUrl,
    },
    body: JSON.stringify({ email, password, name }),
  })

  if (!signUpResponse.ok) {
    throw new Error('Failed to create test user')
  }

  // Sign in to get session
  const signInResponse = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': baseUrl,
    },
    body: JSON.stringify({ email, password }),
  })

  if (!signInResponse.ok) {
    throw new Error('Failed to sign in test user')
  }

  // Extract session cookie
  const setCookieHeader = signInResponse.headers.get('set-cookie')
  const sessionMatch = setCookieHeader?.match(/better-auth\.session_token=([^;]+)/)
  if (!sessionMatch || !sessionMatch[1]) {
    throw new Error('Failed to extract session token')
  }

  return sessionMatch[1]
}

describe('Slap API Routes', () => {

  test('admin commands route should return 405 for non-POST methods', async () => {
    // Arrange
    const db = createTestDatabase()
    const server = Slap.init({
      db,
      port: 0,
      seedConfig: { mode: 'development' },
      authConfig: { secret: 'test-secret-key' }
    })
    const baseUrl = `http://localhost:${server.port}`
    try {
      const url = `${baseUrl}/admin/api/commands`
      const session = await createTestUser(baseUrl)

      // Act
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Cookie': `better-auth.session_token=${session}` }
      })

      // Assert
      expect(response.status).toBe(405)
      const text = await response.text()
      expect(text).toContain('Method not allowed')
    } finally {
      server.stop()
      closeTestDatabase(db)
    }
  })

  test('admin commands route should return 401 when Authorization header is missing', async () => {
    // Arrange
    const db = createTestDatabase()
    const server = Slap.init({
      db,
      port: 0,
      seedConfig: { mode: 'development' },
      authConfig: { secret: 'test-secret-key' }
    })
    const baseUrl = `http://localhost:${server.port}`
    try {
      const url = `${baseUrl}/admin/api/commands`

      // Act
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'createProduct', payload: {} })
      })

      // Assert
      expect(response.status).toBe(401)
      expect(response.headers.get('WWW-Authenticate')).toBe('Basic realm="Admin API"')
    } finally {
      server.stop()
      closeTestDatabase(db)
    }
  })

  test('admin commands route should return 401 when Authorization header is invalid', async () => {
    // Arrange
    const db = createTestDatabase()
    const server = Slap.init({
      db,
      port: 0,
      seedConfig: { mode: 'development' },
      authConfig: { secret: 'test-secret-key' }
    })
    const baseUrl = `http://localhost:${server.port}`
    try {
      const url = `${baseUrl}/admin/api/commands`

      // Act
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Cookie': 'better-auth.session_token=invalid-token-12345',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type: 'createProduct', payload: {} })
      })

      // Assert
      expect(response.status).toBe(401)
    } finally {
      server.stop()
      closeTestDatabase(db)
    }
  })

  test('admin commands route should return 401 when credentials are incorrect', async () => {
    // Arrange
    const db = createTestDatabase()
    const server = Slap.init({
      db,
      port: 0,
      seedConfig: { mode: 'development' },
      authConfig: { secret: 'test-secret-key' }
    })
    const baseUrl = `http://localhost:${server.port}`
    try {
      const url = `${baseUrl}/admin/api/commands`

      // Act
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Cookie': 'better-auth.session_token=invalid.session.token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type: 'createProduct', payload: {} })
      })

      // Assert
      expect(response.status).toBe(401)
    } finally {
      server.stop()
      closeTestDatabase(db)
    }
  })

  test('admin commands route should return 400 when JSON is invalid', async () => {
    // Arrange
    const db = createTestDatabase()
    const server = Slap.init({
      db,
      port: 0,
      seedConfig: { mode: 'development' },
      authConfig: { secret: 'test-secret-key' }
    })
    const baseUrl = `http://localhost:${server.port}`
    try {
      const url = `${baseUrl}/admin/api/commands`
      const session = await createTestUser(baseUrl)

      // Act
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Cookie': `better-auth.session_token=${session}`,
          'Content-Type': 'application/json'
        },
        body: 'invalid json{'
      })

      // Assert
      expect(response.status).toBe(400)
      const json = await response.json() as { success: boolean }
      expect(json.success).toBe(false)
    } finally {
      server.stop()
      closeTestDatabase(db)
    }
  })

  test('admin commands route should return 400 when type is missing', async () => {
    // Arrange
    const db = createTestDatabase()
    const server = Slap.init({
      db,
      port: 0,
      seedConfig: { mode: 'development' },
      authConfig: { secret: 'test-secret-key' }
    })
    const baseUrl = `http://localhost:${server.port}`
    try {
      const url = `${baseUrl}/admin/api/commands`
      const session = await createTestUser(baseUrl)

      // Act
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Cookie': `better-auth.session_token=${session}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ payload: {} })
      })

      // Assert
      expect(response.status).toBe(400)
      const json = await response.json() as { success: boolean }
      expect(json.success).toBe(false)
    } finally {
      server.stop()
      closeTestDatabase(db)
    }
  })

  test('admin commands route should return 400 when payload is missing', async () => {
    // Arrange
    const db = createTestDatabase()
    const server = Slap.init({
      db,
      port: 0,
      seedConfig: { mode: 'development' },
      authConfig: { secret: 'test-secret-key' }
    })
    const baseUrl = `http://localhost:${server.port}`
    try {
      const url = `${baseUrl}/admin/api/commands`
      const session = await createTestUser(baseUrl)

      // Act
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Cookie': `better-auth.session_token=${session}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type: 'createProduct' })
      })

      // Assert
      expect(response.status).toBe(400)
      const json = await response.json() as { success: boolean }
      expect(json.success).toBe(false)
    } finally {
      server.stop()
      closeTestDatabase(db)
    }
  })

  test('admin commands route should succeed with valid auth and command', async () => {
    // Arrange
    const db = createTestDatabase()
    const server = Slap.init({
      db,
      port: 0,
      seedConfig: { mode: 'development' },
      authConfig: { secret: 'test-secret-key' }
    })
    const baseUrl = `http://localhost:${server.port}`
    try {
      const url = `${baseUrl}/admin/api/commands`
      const session = await createTestUser(baseUrl)
      const validCommand = {
        id: randomUUIDv7(),
        correlationId: randomUUIDv7(),
        title: 'Test Product',
        shortDescription: 'A test product',
        slug: 'test-product',
        collectionIds: [randomUUIDv7()],
        variantIds: [randomUUIDv7()],
        richDescriptionUrl: 'https://example.com/description',
        productType: 'physical',
        fulfillmentType: 'digital' as const,
        vendor: 'Test Vendor',
        variantOptions: [{ name: 'Size', values: ['S', 'M', 'L'] }],
        metaTitle: 'Test Product Meta Title',
        metaDescription: 'Test Product Meta Description',
        tags: ['test', 'product'],
        taxable: true,
        taxId: '',
        type: 'createProduct',
      }

      // Act
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Cookie': `better-auth.session_token=${session}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type: 'createProduct', payload: validCommand })
      })

      // Assert
      expect(response.status).toBe(200)
      const json = await response.json() as { success: boolean }
      expect(json.success).toBe(true)
    } finally {
      server.stop()
      closeTestDatabase(db)
    }
  })

  test('CORS preflight OPTIONS request should return appropriate headers', async () => {
    // Arrange
    const db = createTestDatabase()
    const server = Slap.init({
      db,
      port: 0,
      seedConfig: { mode: 'development' },
      authConfig: { secret: 'test-secret-key' }
    })
    const baseUrl = `http://localhost:${server.port}`
    try {
      const url = `${baseUrl}/admin/api/commands`

      // Act
      const response = await fetch(url, {
        method: 'OPTIONS'
      })

      // Assert
      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS')
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization')
    } finally {
      server.stop()
      closeTestDatabase(db)
    }
  })

  test('unknown route should return 404', async () => {
    // Arrange
    const db = createTestDatabase()
    const server = Slap.init({
      db,
      port: 0,
      seedConfig: { mode: 'development' },
      authConfig: { secret: 'test-secret-key' }
    })
    const baseUrl = `http://localhost:${server.port}`
    try {
      const url = `${baseUrl}/unknown/route`

      // Act
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      // Assert
      expect(response.status).toBe(404)
      expect(await response.text()).toBe('Not found')
    } finally {
      server.stop()
      closeTestDatabase(db)
    }
  })

  test('admin queries route should require auth', async () => {
    // Arrange
    const db = createTestDatabase()
    const server = Slap.init({
      db,
      port: 0,
      seedConfig: { mode: 'development' },
      authConfig: { secret: 'test-secret-key' }
    })
    const baseUrl = `http://localhost:${server.port}`
    try {
      const url = `${baseUrl}/admin/api/queries`

      // Act
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'productListView', params: {} })
      })

      // Assert
      expect(response.status).toBe(401)
    } finally {
      server.stop()
      closeTestDatabase(db)
    }
  })

  test('admin queries route should succeed with valid auth', async () => {
    // Arrange
    const db = createTestDatabase()
    const server = Slap.init({
      db,
      port: 0,
      seedConfig: { mode: 'development' },
      authConfig: { secret: 'test-secret-key' }
    })
    const baseUrl = `http://localhost:${server.port}`
    try {
      const url = `${baseUrl}/admin/api/queries`
      const session = await createTestUser(baseUrl)

      // Act
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Cookie': `better-auth.session_token=${session}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type: 'productListView', params: {} })
      })

      // Assert
      expect(response.status).toBe(200)
      const json = await response.json() as { success: boolean; data?: unknown }
      expect(json.success).toBe(true)
      expect(json.data).toBeDefined()
    } finally {
      server.stop()
      closeTestDatabase(db)
    }
  })
})
