import { Database } from "bun:sqlite"
import indexHtmlBundle from "./index.html"
import { schemas } from "./infrastructure/schemas"
import { ProjectionService } from "./infrastructure/projectionService"
import { productListViewProjection } from "./views/product/productListViewProjection"
import { productVariantProjection } from "./views/product/productVariantProjection"
import { slugRedirectProjection } from "./views/slug/slugRedirectProjection"
import { UnitOfWork } from "./infrastructure/unitOfWork"
import { TransactionBatcher } from "./infrastructure/transactionBatcher"
import { createAuth } from "./lib/auth"
import { createAdminCommandsRouter } from "./infrastructure/routers/adminCommandsRouter"
import { createPublicCommandsRouter } from "./infrastructure/routers/publicCommandsRouter"
import { createAdminQueriesRouter } from "./infrastructure/routers/adminQueriesRouter"
import { createPublicQueriesRouter } from "./infrastructure/routers/publicQueriesRouter"
import { getSecurityHeaders } from "./lib/securityHeaders"
import { sanitizeError } from "./lib/errorSanitizer"

export class Slap {
    static init(options?: { db?: Database; port?: number }): ReturnType<typeof Bun.serve> {
        const db = options?.db ?? Slap.initializeDatabase()
        const auth = createAuth(db)
        
        // Seed admin user in development
        if (process.env.NODE_ENV !== "production") {
            Slap.seedAdminUser(db, auth).catch(console.error)
        }
        
        // Seed admin user in production
        if (process.env.NODE_ENV === "production") {
            Slap.seedAdminUserProduction(db, auth).catch(console.error)
        }
        
        const projectionService = Slap.setupProjectionService()
        const { unitOfWork } = Slap.setupTransactionInfrastructure(db)
        const routers = Slap.createRouters(db, unitOfWork, projectionService)
        const jsonResponse = Slap.createJsonResponseHelper()
        const routeHandlers = Slap.createRouteHandlers(routers, jsonResponse, auth)
        return Slap.startServer(routeHandlers, auth, options?.port)
    }

    private static initializeDatabase(): Database {
        const db = new Database('slap.db')
        for (const schema of schemas) {
            db.run(schema)
        }
        return db
    }

    private static async seedAdminUser(db: Database, auth: ReturnType<typeof createAuth>) {
        try {
            // Check if any users exist
            const userCount = db.prepare('SELECT COUNT(*) as count FROM user').get() as { count: number }
            
            if (userCount.count === 0) {
                const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com'
                const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'
                const adminName = process.env.ADMIN_NAME || 'Admin User'
                
                // Create a mock request to use Better Auth's signUp API
                // Better Auth expects the path to match the basePath + /sign-up/email
                const baseURL = process.env.BETTER_AUTH_URL || 'http://localhost:3000'
                const signUpRequest = new Request(`${baseURL}/api/auth/sign-up/email`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: adminEmail,
                        password: adminPassword,
                        name: adminName,
                    }),
                })
                
                // Use Better Auth's handler to create the user
                const response = await auth.handler(signUpRequest)
                
                if (response.ok) {
                    console.log(`✅ Seeded admin user: ${adminEmail} / ${adminPassword}`)
                } else {
                    const errorText = await response.text()
                    console.error(`Failed to seed admin user: ${response.status} - ${errorText}`)
                }
            }
        } catch (error) {
            console.error('Failed to seed admin user:', error)
        }
    }

    private static async seedAdminUserProduction(db: Database, auth: ReturnType<typeof createAuth>) {
        try {
            // Check if any users exist
            const userCount = db.prepare('SELECT COUNT(*) as count FROM user').get() as { count: number }
            
            if (userCount.count === 0) {
                // Require environment variables in production (no defaults)
                const adminEmail = process.env.ADMIN_EMAIL
                const adminPassword = process.env.ADMIN_PASSWORD
                const adminName = process.env.ADMIN_NAME
                
                if (!adminEmail || !adminPassword || !adminName) {
                    throw new Error(
                        'Production admin user seeding requires ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_NAME environment variables to be set'
                    )
                }
                
                // Create a mock request to use Better Auth's signUp API
                // Better Auth expects the path to match the basePath + /sign-up/email
                const baseURL = process.env.BETTER_AUTH_URL || 'http://localhost:3000'
                const signUpRequest = new Request(`${baseURL}/api/auth/sign-up/email`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: adminEmail,
                        password: adminPassword,
                        name: adminName,
                    }),
                })
                
                // Use Better Auth's handler to create the user
                const response = await auth.handler(signUpRequest)
                
                if (response.ok) {
                    console.log(`✅ Seeded production admin user: ${adminEmail}`)
                } else {
                    const errorText = await response.text()
                    console.error(`Failed to seed production admin user: ${response.status} - ${errorText}`)
                }
            }
        } catch (error) {
            console.error('Failed to seed production admin user:', error)
        }
    }

    private static setupProjectionService(): ProjectionService {
        const projectionService = new ProjectionService()
        
        // Register product list view projections
        const productListEvents = [
            'product.created',
            'product.archived',
            'product.published',
            'product.details_updated',
            'product.metadata_updated',
            'product.classification_updated',
            'product.tags_updated',
            'product.shipping_settings_updated',
            'product.page_layout_updated',
        ]
        for (const event of productListEvents) {
            projectionService.registerHandler(event, productListViewProjection)
        }

        // Register product variant projections
        const productVariantEvents = [
            ...productListEvents,
            'variant.created',
            'variant.archived',
            'variant.details_updated',
            'variant.price_updated',
            'variant.inventory_updated',
            'variant.published',
        ]
        for (const event of productVariantEvents) {
            projectionService.registerHandler(event, productVariantProjection)
        }

        // Register slug redirect projection
        projectionService.registerHandler('product.slug_changed', slugRedirectProjection)

        return projectionService
    }

    private static setupTransactionInfrastructure(db: Database) {
        const batcher = new TransactionBatcher(db)
        batcher.start()
        const unitOfWork = new UnitOfWork(db, batcher)
        return { batcher, unitOfWork }
    }

    private static createRouters(
        db: Database,
        unitOfWork: UnitOfWork,
        projectionService: ProjectionService
    ) {
        return {
            adminCommands: createAdminCommandsRouter(unitOfWork, projectionService),
            publicCommands: createPublicCommandsRouter(unitOfWork, projectionService),
            adminQueries: createAdminQueriesRouter(db),
            publicQueries: createPublicQueriesRouter(db),
        }
    }

    private static createJsonResponseHelper() {
        const securityHeaders = getSecurityHeaders();
        return (data: unknown, status = 200): Response => {
            return new Response(JSON.stringify(data), {
                status,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    ...securityHeaders,
                }
            })
        }
    }

    private static createRouteHandlers(
        routers: ReturnType<typeof Slap.createRouters>,
        jsonResponse: ReturnType<typeof Slap.createJsonResponseHelper>,
        auth: ReturnType<typeof createAuth>
    ) {
        return {
            adminCommands: Slap.createAdminCommandsHandler(routers.adminCommands, jsonResponse, auth),
            adminQueries: Slap.createAdminQueriesHandler(routers.adminQueries, jsonResponse, auth),
            publicCommands: Slap.createPublicCommandsHandler(routers.publicCommands, jsonResponse),
            publicQueries: Slap.createPublicQueriesHandler(routers.publicQueries, jsonResponse),
        }
    }

    private static createAdminCommandsHandler(
        router: ReturnType<typeof createAdminCommandsRouter>,
        jsonResponse: ReturnType<typeof Slap.createJsonResponseHelper>,
        auth: ReturnType<typeof createAuth>
    ) {
        return async (request: Request): Promise<Response> => {
            if (request.method !== 'POST') {
                return jsonResponse('Method not allowed', 405)
            }

            // Validate JSON and request format before checking auth
            let body: { type: string; payload: unknown }
            try {
                body = await request.json() as { type: string; payload: unknown }
            } catch (error) {
                const sanitized = sanitizeError(error instanceof Error ? error : new Error('Invalid JSON'))
                return jsonResponse({ success: false, error: sanitized }, 400)
            }

            const { type, payload } = body
            if (!type || !payload) {
                const sanitized = sanitizeError(new Error('Request must include type and payload'))
                return jsonResponse({ success: false, error: sanitized }, 400)
            }

            // Check authentication after validating request format
            const session = await auth.api.getSession({ headers: request.headers })
            if (!session) {
                const sanitized = sanitizeError(new Error('Unauthorized'))
                const response = jsonResponse({ success: false, error: sanitized }, 401)
                // Add WWW-Authenticate header for Basic Auth compatibility
                response.headers.set('WWW-Authenticate', 'Basic realm="Admin API"')
                return response
            }

            const result = await router(type, payload)

            if (result.success) {
                return jsonResponse({ success: true })
            } else {
                const sanitized = sanitizeError(result.error)
                return jsonResponse({ success: false, error: sanitized }, 400)
            }
        }
    }

    private static createAdminQueriesHandler(
        router: ReturnType<typeof createAdminQueriesRouter>,
        jsonResponse: ReturnType<typeof Slap.createJsonResponseHelper>,
        auth: ReturnType<typeof createAuth>
    ) {
        return async (request: Request): Promise<Response> => {
            if (request.method !== 'POST') {
                return jsonResponse('Method not allowed', 405)
            }

            // Validate JSON and request format before checking auth
            let body: { type: string; params?: unknown }
            try {
                body = await request.json() as { type: string; params?: unknown }
            } catch (error) {
                const sanitized = sanitizeError(error instanceof Error ? error : new Error('Invalid JSON'))
                return jsonResponse({ success: false, error: sanitized }, 400)
            }

            const { type, params } = body
            if (!type) {
                const sanitized = sanitizeError(new Error('Request must include type'))
                return jsonResponse({ success: false, error: sanitized }, 400)
            }

            // Check authentication after validating request format
            const session = await auth.api.getSession({ headers: request.headers })
            if (!session) {
                const sanitized = sanitizeError(new Error('Unauthorized'))
                const response = jsonResponse({ success: false, error: sanitized }, 401)
                // Add WWW-Authenticate header for Basic Auth compatibility
                response.headers.set('WWW-Authenticate', 'Basic realm="Admin API"')
                return response
            }

            const result = await router(type, params)

            if (result.success) {
                return jsonResponse({ success: true, data: result.data })
            } else {
                const sanitized = sanitizeError(result.error)
                return jsonResponse({ success: false, error: sanitized }, 400)
            }
        }
    }

    private static createPublicCommandsHandler(
        router: ReturnType<typeof createPublicCommandsRouter>,
        jsonResponse: ReturnType<typeof Slap.createJsonResponseHelper>
    ) {
        return async (request: Request): Promise<Response> => {
            if (request.method !== 'POST') {
                return jsonResponse('Method not allowed', 405)
            }

            try {
                const body = await request.json() as { type: string; payload?: unknown }
                const { type, payload } = body

                if (!type) {
                    const sanitized = sanitizeError(new Error('Request must include type'))
                    return jsonResponse({ success: false, error: sanitized }, 400)
                }

                const result = await router(type, payload)

                if (result.success) {
                    return jsonResponse({ success: true })
                } else {
                    const sanitized = sanitizeError(result.error)
                    return jsonResponse({ success: false, error: sanitized }, 400)
                }
            } catch (error) {
                const sanitized = sanitizeError(error instanceof Error ? error : new Error('Invalid JSON'))
                return jsonResponse({ success: false, error: sanitized }, 400)
            }
        }
    }

    private static createPublicQueriesHandler(
        router: ReturnType<typeof createPublicQueriesRouter>,
        jsonResponse: ReturnType<typeof Slap.createJsonResponseHelper>
    ) {
        return async (request: Request): Promise<Response> => {
            if (request.method !== 'POST') {
                return jsonResponse('Method not allowed', 405)
            }

            try {
                const body = await request.json() as { type: string; params?: unknown }
                const { type, params } = body

                if (!type) {
                    const sanitized = sanitizeError(new Error('Request must include type'))
                    return jsonResponse({ success: false, error: sanitized }, 400)
                }

                const result = await router(type, params)

                if (result.success) {
                    return jsonResponse({ success: true, data: result.data })
                } else {
                    const sanitized = sanitizeError(result.error)
                    return jsonResponse({ success: false, error: sanitized }, 400)
                }
            } catch (error) {
                const sanitized = sanitizeError(error instanceof Error ? error : new Error('Invalid JSON'))
                return jsonResponse({ success: false, error: sanitized }, 400)
            }
        }
    }

    private static startServer(routeHandlers: ReturnType<typeof Slap.createRouteHandlers>, auth: ReturnType<typeof createAuth>, port?: number): ReturnType<typeof Bun.serve> {
        const securityHeaders = getSecurityHeaders();
        const isProduction = process.env.NODE_ENV === "production";
        
        // Helper to wrap Better Auth responses with security headers
        const wrapAuthHandler = async (req: Request): Promise<Response> => {
            const response = await auth.handler(req);
            // Create new headers with security headers added
            const newHeaders = new Headers(response.headers);
            Object.entries(securityHeaders).forEach(([key, value]) => {
                newHeaders.set(key, value);
            });
            // Return new response with security headers
            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: newHeaders,
            });
        };

        // Create OPTIONS handler for CORS preflight
        const handleOptions = () => {
            return new Response(null, {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    ...securityHeaders,
                }
            })
        }

        // Create method not allowed handler
        const handleMethodNotAllowed = () => {
            return new Response(JSON.stringify('Method not allowed'), {
                status: 405,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    ...securityHeaders,
                }
            })
        }

        return Bun.serve({
            port,
            routes: {
                '/admin/api/commands': {
                    POST: routeHandlers.adminCommands,
                    OPTIONS: handleOptions,
                    GET: handleMethodNotAllowed,
                    PUT: handleMethodNotAllowed,
                    DELETE: handleMethodNotAllowed,
                    PATCH: handleMethodNotAllowed,
                },
                '/admin/api/queries': {
                    POST: routeHandlers.adminQueries,
                    OPTIONS: handleOptions,
                    GET: handleMethodNotAllowed,
                    PUT: handleMethodNotAllowed,
                    DELETE: handleMethodNotAllowed,
                    PATCH: handleMethodNotAllowed,
                },
                '/api/commands': {
                    POST: routeHandlers.publicCommands,
                    OPTIONS: handleOptions,
                    GET: handleMethodNotAllowed,
                    PUT: handleMethodNotAllowed,
                    DELETE: handleMethodNotAllowed,
                    PATCH: handleMethodNotAllowed,
                },
                '/api/queries': {
                    POST: routeHandlers.publicQueries,
                    OPTIONS: handleOptions,
                    GET: handleMethodNotAllowed,
                    PUT: handleMethodNotAllowed,
                    DELETE: handleMethodNotAllowed,
                    PATCH: handleMethodNotAllowed,
                },
                '/api/auth': {
                    GET: wrapAuthHandler,
                    POST: wrapAuthHandler,
                    OPTIONS: handleOptions,
                    PUT: handleMethodNotAllowed,
                    DELETE: handleMethodNotAllowed,
                    PATCH: handleMethodNotAllowed,
                },
                '/api/auth/*': {
                    GET: wrapAuthHandler,
                    POST: wrapAuthHandler,
                    OPTIONS: handleOptions,
                    PUT: handleMethodNotAllowed,
                    DELETE: handleMethodNotAllowed,
                    PATCH: handleMethodNotAllowed,
                },
                '/admin': indexHtmlBundle,
                '/admin/*': indexHtmlBundle,
            },
            development: !isProduction && {
                // Enable browser hot reloading in development
                hmr: true,
                // Echo console logs from the browser to the server
                console: true,
            },
            async fetch(request) {
                // HTTPS enforcement in production
                if (isProduction) {
                    const url = new URL(request.url);
                    if (url.protocol === 'http:') {
                        url.protocol = 'https:';
                        return Response.redirect(url.toString(), 301);
                    }
                }

                // Handle CORS preflight for unmatched routes
                if (request.method === 'OPTIONS') {
                    return handleOptions()
                }
                return new Response('Not found', { 
                    status: 404,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        ...securityHeaders,
                    }
                })
            }
        })
    }
}

// Only initialize server if running directly (not imported as a module)
if (import.meta.main) {
    const server = Slap.init()
    console.log(`🚀 Server running at ${server.url}`)
}
