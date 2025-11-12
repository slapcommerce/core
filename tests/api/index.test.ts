import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { schemas } from '../../src/infrastructure/schemas'
import { Slap } from '../../src/index'

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
  if (!sessionMatch) {
    throw new Error('Failed to extract session token')
  }

  return sessionMatch[1]
}

describe('Slap API Routes', () => {
  let db: Database
  let server: ReturnType<typeof Bun.serve> | null = null
  let baseUrl: string

  beforeEach(() => {
    // Use in-memory database for testing
    db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    
    // Start server on a random port (0 = random available port)
    server = Slap.init({ db, port: 0 })
    baseUrl = `http://localhost:${server.port}`
  })

  afterEach(() => {
    if (server) {
      server.stop()
      server = null
    }
    db.close()
  })

  test('admin commands route should return 405 for non-POST methods', async () => {
    // Arrange
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
  })

  test('admin commands route should return 401 when Authorization header is missing', async () => {
    // Arrange
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
  })

  test('admin commands route should return 401 when Authorization header is invalid', async () => {
    // Arrange
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
  })

  test('admin commands route should return 401 when credentials are incorrect', async () => {
    // Arrange
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
  })

  test('admin commands route should return 400 when JSON is invalid', async () => {
    // Arrange
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
  })

  test('admin commands route should return 400 when type is missing', async () => {
    // Arrange
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
  })

  test('admin commands route should return 400 when payload is missing', async () => {
    // Arrange
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
  })

  test('admin commands route should succeed with valid auth and command', async () => {
    // Arrange
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
      vendor: 'Test Vendor',
      variantOptions: [{ name: 'Size', values: ['S', 'M', 'L'] }],
      metaTitle: 'Test Product Meta Title',
      metaDescription: 'Test Product Meta Description',
      tags: ['test', 'product'],
      requiresShipping: true,
      taxable: true,
      pageLayoutId: null,
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
  })

  test('CORS preflight OPTIONS request should return appropriate headers', async () => {
    // Arrange
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
  })

  test('unknown route should return 404', async () => {
    // Arrange
    const url = `${baseUrl}/unknown/route`

    // Act
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    // Assert
    expect(response.status).toBe(404)
    expect(await response.text()).toBe('Not found')
  })

  test('public queries route should not require auth', async () => {
    // Arrange
    const url = `${baseUrl}/api/queries`

    // Act
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'productListView', params: {} })
    })

    // Assert
    // Public route should not require auth, so it should process the request
    // (may return 400 if query type is invalid, but not 401)
    expect(response.status).not.toBe(401)
  })

  test('public commands route should return 405 for non-POST methods', async () => {
    // Arrange
    const url = `${baseUrl}/api/commands`

    // Act
    const response = await fetch(url, {
      method: 'GET'
    })

    // Assert
    expect(response.status).toBe(405)
  })

  test('admin queries route should require auth', async () => {
    // Arrange
    const url = `${baseUrl}/admin/api/queries`

    // Act
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'productListView', params: {} })
    })

    // Assert
    expect(response.status).toBe(401)
  })

  test('admin queries route should succeed with valid auth', async () => {
    // Arrange
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
  })
})
