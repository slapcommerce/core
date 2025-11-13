import type { DomainEvent } from "../../domain/_base/domainEvent"
import type { ProjectionHandler, UnitOfWorkRepositories } from "../../infrastructure/projectionService"
import { CollectionMetadataUpdatedEvent } from "../../domain/collection/events"

export const collectionSlugRedirectProjection: ProjectionHandler = async (
  event: DomainEvent<string, Record<string, unknown>>,
  repositories: UnitOfWorkRepositories
): Promise<void> => {
  const { slugRedirectRepository } = repositories
  switch (event.eventName) {
    case "collection.metadata_updated": {
      const collectionMetadataUpdatedEvent = event as CollectionMetadataUpdatedEvent
      const oldSlug = collectionMetadataUpdatedEvent.payload.priorState.slug
      const newSlug = collectionMetadataUpdatedEvent.payload.newState.slug
      const collectionId = collectionMetadataUpdatedEvent.aggregateId

      // Only create redirect if slug actually changed
      if (oldSlug !== newSlug) {
        // Chain redirects: find all redirects where newSlug === oldSlug and update them
        // For example, if we have A->B and now B->C, update A->B to A->C
        const redirectsToChain = slugRedirectRepository.findByNewSlug(oldSlug)
        for (const redirect of redirectsToChain) {
          slugRedirectRepository.save({
            old_slug: redirect.old_slug,
            new_slug: newSlug,
            entity_id: redirect.entity_id,
            entity_type: redirect.entity_type,
            product_id: redirect.entity_type === 'product' ? redirect.entity_id : undefined,
            created_at: redirect.created_at,
          })
        }

        // Save new redirect entry: oldSlug -> newSlug
        slugRedirectRepository.save({
          old_slug: oldSlug,
          new_slug: newSlug,
          entity_id: collectionId,
          entity_type: 'collection',
          created_at: collectionMetadataUpdatedEvent.occurredAt,
        })
      }
      break
    }
  }
}

