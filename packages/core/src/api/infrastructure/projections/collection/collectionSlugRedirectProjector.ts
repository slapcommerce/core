import type { CollectionMetadataUpdatedEvent } from "../../../domain/collection/events";
import { Projector, type ProjectorHandlers } from "../_base/projector";
import type { UnitOfWorkRepositories } from "../../unitOfWork";

export class CollectionSlugRedirectProjector extends Projector<CollectionMetadataUpdatedEvent> {
  protected handlers: ProjectorHandlers<CollectionMetadataUpdatedEvent['eventName']>;

  constructor(repositories: UnitOfWorkRepositories) {
    super(repositories);
    this.handlers = {
      'collection.metadata_updated': this.handleMetadataUpdated.bind(this),
    };
  }

  private async handleMetadataUpdated(event: CollectionMetadataUpdatedEvent): Promise<void> {
    const { priorState, newState } = event.payload;

    // Stateless check: only create redirect if slug actually changed
    if (priorState.slug !== newState.slug) {
      this.repositories.slugRedirectReadModelRepository.save({
        oldSlug: priorState.slug,
        newSlug: newState.slug,
        aggregateId: event.aggregateId,
        aggregateType: 'collection',
        createdAt: event.occurredAt,
      });
    }
  }
}
