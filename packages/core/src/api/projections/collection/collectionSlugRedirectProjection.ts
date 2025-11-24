import type { CollectionMetadataUpdatedEvent } from "../../domain/collection/events";
import { Projection } from "../_base/projection";

export class CollectionSlugRedirectProjection extends Projection<CollectionMetadataUpdatedEvent> {
  protected handlers = {
    'collection.metadata_updated': this.handleMetadataUpdated.bind(this),
  };

  private async handleMetadataUpdated(event: CollectionMetadataUpdatedEvent): Promise<void> {
    const { slugRedirectRepository } = this.repositories;
    const oldSlug = event.payload.priorState.slug;
    const newSlug = event.payload.newState.slug;
    const collectionId = event.aggregateId;
    const collectionStatus = event.payload.newState.status;

    // Only create redirect if slug actually changed AND collection is active
    // Draft collections should not create redirects - old slug is released instead
    if (oldSlug !== newSlug && collectionStatus === "active") {
      // Chain redirects: find all redirects where newSlug === oldSlug and update them
      // For example, if we have A->B and now B->C, update A->B to A->C
      const redirectsToChain = slugRedirectRepository.findByNewSlug(oldSlug);
      for (const redirect of redirectsToChain) {
        slugRedirectRepository.save({
          old_slug: redirect.old_slug,
          new_slug: newSlug,
          entity_id: redirect.entity_id,
          entity_type: redirect.entity_type,
          product_id: redirect.entity_type === 'product' ? redirect.entity_id : undefined,
          created_at: redirect.created_at,
        });
      }

      // Save new redirect entry: oldSlug -> newSlug
      slugRedirectRepository.save({
        old_slug: oldSlug,
        new_slug: newSlug,
        entity_id: collectionId,
        entity_type: 'collection',
        created_at: event.occurredAt,
      });
    }
  }
}
