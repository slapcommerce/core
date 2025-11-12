export function requireBasicAuth(request: Request): Response | null {
  const authHeader = request.headers.get('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return new Response('Unauthorized', { 
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Admin API"',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }

  const encoded = authHeader.substring(6)
  const decoded = Buffer.from(encoded, 'base64').toString('utf-8')
  const [username, password] = decoded.split(':')

  const expectedUsername = process.env.ADMIN_USERNAME || 'admin'
  const expectedPassword = process.env.ADMIN_PASSWORD || 'admin'

  if (username !== expectedUsername || password !== expectedPassword) {
    return new Response('Unauthorized', { 
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Admin API"',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }

  return null
}

