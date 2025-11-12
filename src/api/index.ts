import { Database } from "bun:sqlite"
import { schemas } from "../infrastructure/schemas"
import { ProjectionService } from "../infrastructure/projectionService"
import { productListViewProjection } from "../views/product/productListViewProjection"
import { productVariantProjection } from "../views/product/productVariantProjection"
import { slugRedirectProjection } from "../views/slug/slugRedirectProjection"
import { UnitOfWork } from "../infrastructure/unitOfWork"
import { TransactionBatcher } from "../infrastructure/transactionBatcher"
import { requireBasicAuth } from "./middleware/auth"
import { createAdminCommandsRouter } from "../infrastructure/routers/adminCommandsRouter"
import { createPublicCommandsRouter } from "../infrastructure/routers/publicCommandsRouter"
import { createAdminQueriesRouter } from "../infrastructure/routers/adminQueriesRouter"
import { createPublicQueriesRouter } from "../infrastructure/routers/publicQueriesRouter"

export class Slap {
    static init () {
        const db = new Database('slap.db')
        for (const schema of schemas) {
            db.run(schema)
        }

        // Initialize projection service and register handlers
        const projectionService = new ProjectionService()
        projectionService.registerHandler('product.created', productListViewProjection)
        projectionService.registerHandler('product.archived', productListViewProjection)
        projectionService.registerHandler('product.published', productListViewProjection)
        projectionService.registerHandler('product.details_updated', productListViewProjection)
        projectionService.registerHandler('product.metadata_updated', productListViewProjection)
        projectionService.registerHandler('product.classification_updated', productListViewProjection)
        projectionService.registerHandler('product.tags_updated', productListViewProjection)
        projectionService.registerHandler('product.shipping_settings_updated', productListViewProjection)
        projectionService.registerHandler('product.page_layout_updated', productListViewProjection)
        projectionService.registerHandler('product.created', productVariantProjection)
        projectionService.registerHandler('product.archived', productVariantProjection)
        projectionService.registerHandler('product.published', productVariantProjection)
        projectionService.registerHandler('product.details_updated', productVariantProjection)
        projectionService.registerHandler('product.metadata_updated', productVariantProjection)
        projectionService.registerHandler('product.classification_updated', productVariantProjection)
        projectionService.registerHandler('product.tags_updated', productVariantProjection)
        projectionService.registerHandler('product.shipping_settings_updated', productVariantProjection)
        projectionService.registerHandler('product.page_layout_updated', productVariantProjection)
        projectionService.registerHandler('variant.created', productVariantProjection)
        projectionService.registerHandler('variant.archived', productVariantProjection)
        projectionService.registerHandler('variant.details_updated', productVariantProjection)
        projectionService.registerHandler('variant.price_updated', productVariantProjection)
        projectionService.registerHandler('variant.inventory_updated', productVariantProjection)
        projectionService.registerHandler('variant.published', productVariantProjection)
        projectionService.registerHandler('product.slug_changed', slugRedirectProjection)

        // Initialize transaction batcher and unit of work
        const batcher = new TransactionBatcher(db)
        batcher.start()
        const unitOfWork = new UnitOfWork(db, batcher)

        // Create routers
        const adminCommandsRouter = createAdminCommandsRouter(unitOfWork, projectionService)
        const publicCommandsRouter = createPublicCommandsRouter(unitOfWork, projectionService)
        const adminQueriesRouter = createAdminQueriesRouter(db)
        const publicQueriesRouter = createPublicQueriesRouter(db)

        // Helper function to create JSON response
        const jsonResponse = (data: unknown, status = 200): Response => {
            return new Response(JSON.stringify(data), {
                status,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            })
        }

        // Create admin route handlers with auth middleware
        const adminCommandsRoute = async (request: Request): Promise<Response> => {
            // Check HTTP method
            if (request.method !== 'POST') {
                return jsonResponse('Method not allowed', 405)
            }

            // Auth check
            const authError = requireBasicAuth(request)
            if (authError) {
                return authError
            }

            // Parse request body
            try {
                const body = await request.json() as { type: string; payload: unknown }
                const { type, payload } = body

                if (!type || !payload) {
                    return jsonResponse({ success: false, error: new Error('Request must include type and payload') }, 400)
                }

                // Call router
                const result = await adminCommandsRouter(type, payload)

                // Convert Result to Response
                if (result.success) {
                    return jsonResponse({ success: true })
                } else {
                    return jsonResponse({ success: false, error: result.error }, 400)
                }
            } catch (error) {
                return jsonResponse({ success: false, error: error instanceof Error ? error : new Error('Invalid JSON') }, 400)
            }
        }

        const adminQueriesRoute = async (request: Request): Promise<Response> => {
            // Check HTTP method
            if (request.method !== 'POST') {
                return jsonResponse('Method not allowed', 405)
            }

            // Auth check
            const authError = requireBasicAuth(request)
            if (authError) {
                return authError
            }

            // Parse request body
            try {
                const body = await request.json() as { type: string; params?: unknown }
                const { type, params } = body

                if (!type) {
                    return jsonResponse({ success: false, error: new Error('Request must include type') }, 400)
                }

                // Call router
                const result = await adminQueriesRouter(type, params)

                // Convert Result to Response
                if (result.success) {
                    return jsonResponse({ success: true, data: result.data })
                } else {
                    return jsonResponse({ success: false, error: result.error }, 400)
                }
            } catch (error) {
                return jsonResponse({ success: false, error: error instanceof Error ? error : new Error('Invalid JSON') }, 400)
            }
        }

        const publicCommandsRoute = async (request: Request): Promise<Response> => {
            // Check HTTP method
            if (request.method !== 'POST') {
                return jsonResponse('Method not allowed', 405)
            }

            // Parse request body
            try {
                const body = await request.json() as { type: string; payload?: unknown }
                const { type, payload } = body

                if (!type) {
                    return jsonResponse({ success: false, error: new Error('Request must include type') }, 400)
                }

                // Call router
                const result = await publicCommandsRouter(type, payload)

                // Convert Result to Response
                if (result.success) {
                    return jsonResponse({ success: true })
                } else {
                    return jsonResponse({ success: false, error: result.error }, 400)
                }
            } catch (error) {
                return jsonResponse({ success: false, error: error instanceof Error ? error : new Error('Invalid JSON') }, 400)
            }
        }

        const publicQueriesRoute = async (request: Request): Promise<Response> => {
            // Check HTTP method
            if (request.method !== 'POST') {
                return jsonResponse('Method not allowed', 405)
            }

            // Parse request body
            try {
                const body = await request.json() as { type: string; params?: unknown }
                const { type, params } = body

                if (!type) {
                    return jsonResponse({ success: false, error: new Error('Request must include type') }, 400)
                }

                // Call router
                const result = await publicQueriesRouter(type, params)

                // Convert Result to Response
                if (result.success) {
                    return jsonResponse({ success: true, data: result.data })
                } else {
                    return jsonResponse({ success: false, error: result.error }, 400)
                }
            } catch (error) {
                return jsonResponse({ success: false, error: error instanceof Error ? error : new Error('Invalid JSON') }, 400)
            }
        }

        Bun.serve({
            routes: {
                '/admin/api/commands': {
                    POST: adminCommandsRoute,
                },
                '/admin/api/queries': {
                    POST: adminQueriesRoute,
                },
                '/api/commands': {
                    POST: publicCommandsRoute,
                },
                '/api/queries': {
                    POST: publicQueriesRoute,
                },
            },
            async fetch(request) {
                // Handle CORS preflight
                if (request.method === 'OPTIONS') {
                    return new Response(null, {
                        headers: {
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Methods': 'POST, OPTIONS',
                            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                        }
                    })
                }

                // Let Bun.serve handle routing via the routes object
                // If route doesn't match, return 404
                return new Response('Not found', { 
                    status: 404,
                    headers: {
                        'Access-Control-Allow-Origin': '*'
                    }
                })
            }
        })
    }
}