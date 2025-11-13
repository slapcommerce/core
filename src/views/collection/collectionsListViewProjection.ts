import type { DomainEvent } from "../../domain/_base/domainEvent"
import type { ProjectionHandler, UnitOfWorkRepositories } from "../../infrastructure/projectionService"
import { CollectionCreatedEvent } from "../../domain/collection/events"
import { CollectionArchivedEvent } from "../../domain/collection/events"
import { CollectionMetadataUpdatedEvent } from "../../domain/collection/events"
import { CollectionPublishedEvent } from "../../domain/collection/events"
import type { CollectionsListViewData } from "../../infrastructure/repositories/collectionsListViewRepository"
import type { CollectionState } from "../../domain/collection/events"

function createCollectionsListViewData(
  aggregateId: string,
  correlationId: string,
  version: number,
  state: CollectionState,
  updatedAt: Date
): CollectionsListViewData {
  return {
    aggregate_id: aggregateId,
    name: state.name,
    slug: state.slug,
    description: state.description,
    status: state.status,
    correlation_id: correlationId,
    version: version,
    created_at: state.createdAt,
    updated_at: updatedAt,
  }
}

export const collectionsListViewProjection: ProjectionHandler = async (
  event: DomainEvent<string, Record<string, unknown>>,
  repositories: UnitOfWorkRepositories
): Promise<void> => {
  const { collectionsListViewRepository } = repositories
  switch (event.eventName) {
    case "collection.created": {
      const collectionCreatedEvent = event as CollectionCreatedEvent
      const state = collectionCreatedEvent.payload.newState

      // Create collections list view data
      const collectionData = createCollectionsListViewData(
        collectionCreatedEvent.aggregateId,
        collectionCreatedEvent.correlationId,
        collectionCreatedEvent.version,
        state,
        collectionCreatedEvent.occurredAt
      )

      // Save to collections_list_view table
      collectionsListViewRepository.save(collectionData)
      break
    }
    case "collection.archived": {
      const collectionArchivedEvent = event as CollectionArchivedEvent
      const state = collectionArchivedEvent.payload.newState

      // Update status to archived in collections_list_view
      const collectionData = createCollectionsListViewData(
        collectionArchivedEvent.aggregateId,
        collectionArchivedEvent.correlationId,
        collectionArchivedEvent.version,
        state,
        collectionArchivedEvent.occurredAt
      )

      collectionsListViewRepository.save(collectionData)
      break
    }
    case "collection.metadata_updated": {
      const collectionMetadataUpdatedEvent = event as CollectionMetadataUpdatedEvent
      const state = collectionMetadataUpdatedEvent.payload.newState

      // Update name, slug, description, updated_at in collections_list_view
      const collectionData = createCollectionsListViewData(
        collectionMetadataUpdatedEvent.aggregateId,
        collectionMetadataUpdatedEvent.correlationId,
        collectionMetadataUpdatedEvent.version,
        state,
        collectionMetadataUpdatedEvent.occurredAt
      )

      collectionsListViewRepository.save(collectionData)
      break
    }
    case "collection.published": {
      const collectionPublishedEvent = event as CollectionPublishedEvent
      const state = collectionPublishedEvent.payload.newState

      // Update status to active in collections_list_view
      const collectionData = createCollectionsListViewData(
        collectionPublishedEvent.aggregateId,
        collectionPublishedEvent.correlationId,
        collectionPublishedEvent.version,
        state,
        collectionPublishedEvent.occurredAt
      )

      collectionsListViewRepository.save(collectionData)
      break
    }
  }
}

