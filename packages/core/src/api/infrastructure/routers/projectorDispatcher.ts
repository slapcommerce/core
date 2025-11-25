import type { DomainEventUnion } from "../../domain/_base/domainEvent";
import type { UnitOfWorkRepositories } from "../unitOfWork";
import { SlugRedirectProjector } from "../../projections/slug/slugRedirectProjector";
import { CollectionsListProjector } from "../../projections/collection/collectionsProjector";
import { CollectionSlugRedirectProjector } from "../../projections/collection/collectionSlugRedirectProjector";

/**
 * ProjectorDispatcher dispatches domain events to all registered projectors.
 * Each dispatcher instance is created per-transaction with its own projector instances.
 * Projectors self-select which events they handle via their handlers map.
 */
export class ProjectorDispatcher {
    private readonly projectors;

    /**
     * Private constructor - use ProjectorDispatcher.create() instead
     */
    private constructor(repositories: UnitOfWorkRepositories) {
        // Instantiate all projector classes with repositories
        // TypeScript infers the union type from array elements
        this.projectors = [
            new SlugRedirectProjector(repositories),
            new CollectionsListProjector(repositories),
            new CollectionSlugRedirectProjector(repositories),
        ];
    }

    /**
     * Creates a new ProjectorDispatcher instance with wired-up projector handlers
     *
     * @param repositories - The repositories to inject into projector classes
     * @returns A new ProjectorDispatcher instance
     */
    static create(repositories: UnitOfWorkRepositories): ProjectorDispatcher {
        return new ProjectorDispatcher(repositories);
    }

    /**
     * Dispatches a domain event to all projectors
     * Each projector will handle the event if it has a handler registered for it
     *
     * @param event - The domain event to dispatch
     */
    async dispatch(event: DomainEventUnion): Promise<void> {
        // Execute all projectors in parallel - each projector self-selects events it cares about
        await Promise.all(this.projectors.map(projector => projector.execute(event)));
    }
}
