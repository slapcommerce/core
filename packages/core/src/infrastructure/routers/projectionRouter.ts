import type { DomainEventUnion } from "../../domain/_base/domainEvent";
import type { UnitOfWorkRepositories } from "../unitOfWork";
import { ProductListViewProjection } from "../../projections/product/productListViewProjection";
import { ProductVariantProjection } from "../../projections/product/productVariantProjection";
import { SlugRedirectProjection } from "../../projections/slug/slugRedirectProjection";
import { VariantDetailsViewProjection } from "../../projections/variant/variantDetailsViewProjection";
import { CollectionsListViewProjection } from "../../projections/collection/collectionsListViewProjection";
import { CollectionSlugRedirectProjection } from "../../projections/collection/collectionSlugRedirectProjection";
import { ScheduleViewProjection } from "../../projections/schedule/scheduleViewProjection";
import { assertNever } from "../../lib/assertNever";

/**
 * ProjectionRouter routes domain events to appropriate projection handlers.
 * Each router instance is created per-transaction with its own projection instances.
 */
export class ProjectionRouter {
    private readonly productListView: ProductListViewProjection;
    private readonly productVariant: ProductVariantProjection;
    private readonly slugRedirect: SlugRedirectProjection;
    private readonly variantDetailsView: VariantDetailsViewProjection;
    private readonly collectionsListView: CollectionsListViewProjection;
    private readonly collectionSlugRedirect: CollectionSlugRedirectProjection;
    private readonly scheduleView: ScheduleViewProjection;

    /**
     * Private constructor - use ProjectionRouter.create() instead
     */
    private constructor(repositories: UnitOfWorkRepositories) {
        // Instantiate all projection classes with repositories
        this.productListView = new ProductListViewProjection(repositories);
        this.productVariant = new ProductVariantProjection(repositories);
        this.slugRedirect = new SlugRedirectProjection(repositories);
        this.variantDetailsView = new VariantDetailsViewProjection(repositories);
        this.collectionsListView = new CollectionsListViewProjection(repositories);
        this.collectionSlugRedirect = new CollectionSlugRedirectProjection(repositories);
        this.scheduleView = new ScheduleViewProjection(repositories);
    }

    /**
     * Creates a new ProjectionRouter instance with wired-up projection handlers
     *
     * @param repositories - The repositories to inject into projection classes
     * @returns A new ProjectionRouter instance
     */
    static create(repositories: UnitOfWorkRepositories): ProjectionRouter {
        return new ProjectionRouter(repositories);
    }

    /**
     * Routes a domain event to the appropriate projection handlers
     *
     * @param event - The domain event to route
     */
    async route(event: DomainEventUnion): Promise<void> {
        switch (event.eventName) {
            // Product events - trigger multiple projections
            case "product.created":
            case "product.archived":
            case "product.published":
            case "product.unpublished":
            case "product.details_updated":
            case "product.metadata_updated":
            case "product.classification_updated":
            case "product.tags_updated":
            case "product.collections_updated":
            case "product.variant_options_updated":
            case "product.fulfillment_type_updated":
                await this.productListView.execute(event);
                await this.productVariant.execute(event);
                break;

            case "product.slug_changed":
                await this.productListView.execute(event);
                await this.productVariant.execute(event);
                await this.slugRedirect.execute(event);
                break;

            // Variant events
            case "variant.created":
            case "variant.archived":
            case "variant.details_updated":
            case "variant.price_updated":
            case "variant.inventory_updated":
            case "variant.sku_updated":
            case "variant.published":
                await this.productVariant.execute(event);
                await this.variantDetailsView.execute(event);
                break;

            case "variant.images_updated":
            case "variant.digital_asset_attached":
            case "variant.digital_asset_detached":
                await this.variantDetailsView.execute(event);
                break;

            // Collection events
            case "collection.created":
                await this.collectionsListView.execute(event);
                await this.productListView.execute(event); // Update product-collection relationships
                break;

            case "collection.archived":
                await this.collectionsListView.execute(event);
                await this.productListView.execute(event); // Update product-collection relationships
                break;

            case "collection.metadata_updated":
                await this.collectionsListView.execute(event);
                await this.collectionSlugRedirect.execute(event);
                await this.productListView.execute(event); // Update product-collection relationships
                break;

            case "collection.published":
            case "collection.seo_metadata_updated":
            case "collection.unpublished":
            case "collection.images_updated":
                await this.collectionsListView.execute(event);
                break;

            // Schedule events
            case "schedule.created":
            case "schedule.updated":
            case "schedule.executed":
            case "schedule.failed":
            case "schedule.cancelled":
                await this.scheduleView.execute(event);
                break;

            // Sku events - not currently handled by any projections
            case "sku.reserved":
            case "sku.released":
                // No projections need these events yet
                break;

            // Slug events - not currently handled by any projections
            case "slug.reserved":
            case "slug.released":
            case "slug.redirected":
                // No projections need these events yet
                break;

            default:
                assertNever(event);
        }
    }
}
