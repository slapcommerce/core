import type { DomainEvent } from "../../domain/_base/domainEvent"
import type { UnitOfWorkRepositories } from "../../infrastructure/unitOfWork"
import { CollectionMetadataUpdatedEvent } from "../../domain/collection/events"
import type { CollectionEvent } from "../../domain/collection/events";
import { assertNever } from "../../lib/assertNever";

export class CollectionSlugRedirectProjection {
  constructor(private repositories: UnitOfWorkRepositories) { }

  async execute(
    event: CollectionEvent
  ): Promise<void> {
    const { slugRedirectRepository } = this.repositories;
    switch (event.eventName) {
      case "collection.metadata_updated": {
        const collectionMetadataUpdatedEvent = event as CollectionMetadataUpdatedEvent;
        const oldSlug = collectionMetadataUpdatedEvent.payload.priorState.slug;
        const newSlug = collectionMetadataUpdatedEvent.payload.newState.slug;
        const collectionId = collectionMetadataUpdatedEvent.aggregateId;
        const collectionStatus = collectionMetadataUpdatedEvent.payload.newState.status;

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
            created_at: collectionMetadataUpdatedEvent.occurredAt,
          });
        }
        break;
      }
      case "collection.created":
      case "collection.archived":
      case "collection.published":
      case "collection.seo_metadata_updated":
      case "collection.unpublished":
      case "collection.images_updated":
        // These events don't affect slug redirects
        break;
      default:
        assertNever(event);
    }
  }
}
