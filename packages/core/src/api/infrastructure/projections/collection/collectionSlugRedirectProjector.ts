import type { CollectionMetadataUpdatedEvent } from "../../../domain/collection/events";
import { Projector } from "../_base/projector";

export class CollectionSlugRedirectProjector extends Projector<CollectionMetadataUpdatedEvent> {
  protected handlers = {
    'collection.metadata_updated': this.handleMetadataUpdated.bind(this),
  };

  private async handleMetadataUpdated(event: CollectionMetadataUpdatedEvent): Promise<void> {
    const { priorState, newState } = event.payload;

    // Stateless check: only create redirect if slug actually changed
    if (priorState.slug !== newState.slug) {
      this.repositories.SlugRedirectRepository.save({
        old_slug: priorState.slug,
        new_slug: newState.slug,
        entity_id: event.aggregateId,
        entity_type: 'collection',
        product_id: null,
        created_at: event.occurredAt,
      });
    }
  }
}
