import { Database } from "bun:sqlite"
import { schemas } from "../infrastructure/schemas"
import { ProjectionService } from "../infrastructure/projectionService"
import { productListViewProjection } from "../views/product/productListViewProjection"
import { productVariantProjection } from "../views/product/productVariantProjection"
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
        
        Bun.serve({
            routes: {
                
            }
        })
    }
}