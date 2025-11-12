import { Database } from "bun:sqlite"
import { schemas } from "../infrastructure/schemas"
import { ProjectionService } from "../infrastructure/projectionService"
import { productListViewProjection } from "../views/product/productListViewProjection"
import { slugRedirectProjection } from "../views/slug/slugRedirectProjection"

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
        projectionService.registerHandler('product.slug_changed', slugRedirectProjection)
        
        Bun.serve({
            routes: {
                
            }
        })
    }
}