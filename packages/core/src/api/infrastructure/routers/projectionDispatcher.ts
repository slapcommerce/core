import type { DomainEventUnion } from "../../domain/_base/domainEvent";
import type { UnitOfWorkRepositories } from "../unitOfWork";
import { ProductListViewProjection } from "../../projections/product/productListViewProjection";
import { ProductVariantProjection } from "../../projections/product/productVariantProjection";
import { SlugRedirectProjection } from "../../projections/slug/slugRedirectProjection";
import { VariantDetailsViewProjection } from "../../projections/variant/variantDetailsViewProjection";
import { CollectionsListViewProjection } from "../../projections/collection/collectionsListProjection";
import { CollectionSlugRedirectProjection } from "../../projections/collection/collectionSlugRedirectProjection";
import { ScheduleViewProjection } from "../../projections/schedule/scheduleViewProjection";
import type { Projection } from "../../projections/_base/projection";

/**
 * ProjectionDispatcher dispatches domain events to all registered projections.
 * Each dispatcher instance is created per-transaction with its own projection instances.
 * Projections self-select which events they handle via their handlers map.
 */
export class ProjectionDispatcher {
    private readonly projections;

    /**
     * Private constructor - use ProjectionDispatcher.create() instead
     */
    private constructor(repositories: UnitOfWorkRepositories) {
        // Instantiate all projection classes with repositories
        // TypeScript infers the union type from array elements
        this.projections = [
            new ProductListViewProjection(repositories),
            new ProductVariantProjection(repositories),
            new SlugRedirectProjection(repositories),
            new VariantDetailsViewProjection(repositories),
            new CollectionsListViewProjection(repositories),
            new CollectionSlugRedirectProjection(repositories),
            new ScheduleViewProjection(repositories),
        ];
    }

    /**
     * Creates a new ProjectionDispatcher instance with wired-up projection handlers
     *
     * @param repositories - The repositories to inject into projection classes
     * @returns A new ProjectionDispatcher instance
     */
    static create(repositories: UnitOfWorkRepositories): ProjectionDispatcher {
        return new ProjectionDispatcher(repositories);
    }

    /**
     * Dispatches a domain event to all projections
     * Each projection will handle the event if it has a handler registered for it
     *
     * @param event - The domain event to dispatch
     */
    async dispatch(event: DomainEventUnion): Promise<void> {
        // Execute all projections in parallel - each projection self-selects events it cares about
        await Promise.all(this.projections.map(projection => projection.execute(event)));
    }
}
