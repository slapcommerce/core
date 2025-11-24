import type { DomainEventUnion } from "../../domain/_base/domainEvent";
import type { UnitOfWorkRepositories } from "../../infrastructure/unitOfWork";

/**
 * Exhaustive event handler mapping - requires handlers for ALL specified events
 * Used internally by the generic Projection class
 */
export type ProjectionHandlers<T extends DomainEventUnion['eventName']> = {
  [K in T]: (event: Extract<DomainEventUnion, { eventName: K }>) => Promise<void> | void;
};

/**
 * Base class for all projections
 *
 * Generic parameter TEvent specifies which events this projection handles.
 * TypeScript will enforce that handlers are provided for ALL events in TEvent.
 *
 * Example:
 * ```typescript
 * class CollectionsListViewProjection extends Projection<CollectionEvent> {
 *   protected handlers = {
 *     'collection.created': ...,   // Required
 *     'collection.archived': ...,  // Required
 *     // TypeScript error if any CollectionEvent is missing!
 *   };
 * }
 * ```
 */
export abstract class Projection<TEvent extends DomainEventUnion = DomainEventUnion> {
  protected abstract handlers: ProjectionHandlers<TEvent['eventName']>;

  constructor(protected repositories: UnitOfWorkRepositories) {}

  async execute(event: DomainEventUnion): Promise<void> {
    const handler = (this.handlers as any)[event.eventName];
    if (handler) {
      await handler(event as any); // Type is guaranteed by ProjectionHandlers definition
    }
    // Silently ignore events with no handler
  }
}
