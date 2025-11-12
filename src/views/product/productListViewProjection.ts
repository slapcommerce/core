import type { DomainEvent } from "../../domain/_base/domainEvent"
import type { ProjectionRepository } from "../../infrastructure/repository"
import type { ProjectionHandler } from "../../infrastructure/projectionService"
import { ProductCreatedEvent } from "../../domain/product/events"
import { ProductArchivedEvent } from "../../domain/product/events"
import { ProductPublishedEvent } from "../../domain/product/events"
import { randomUUIDv7 } from "bun"

export const productListViewProjection: ProjectionHandler = async (
  event: DomainEvent<string, Record<string, unknown>>,
  repository: ProjectionRepository
): Promise<void> => {
  switch (event.eventName) {
    case "product.created": {
      const productCreatedEvent = event as ProductCreatedEvent
      const state = productCreatedEvent.payload.newState

      repository.saveProjection({
        id: randomUUIDv7(),
        projection_type: 'product_list_view',
        aggregate_id: productCreatedEvent.aggregateId,
        correlation_id: productCreatedEvent.correlationId,
        version: productCreatedEvent.version,
        payload: JSON.stringify({
          id: productCreatedEvent.aggregateId,
          title: state.title,
          slug: state.slug,
          vendor: state.vendor,
          productType: state.productType,
          shortDescription: state.shortDescription,
          tags: state.tags,
          createdAt: state.createdAt.toISOString(),
          status: state.status,
        }),
        created_at: productCreatedEvent.occurredAt.getTime()
      })
      break
    }
    case "product.archived": {
      const productArchivedEvent = event as ProductArchivedEvent
      const state = productArchivedEvent.payload.newState

      repository.saveProjection({
        id: randomUUIDv7(),
        projection_type: 'product_list_view',
        aggregate_id: productArchivedEvent.aggregateId,
        correlation_id: productArchivedEvent.correlationId,
        version: productArchivedEvent.version,
        payload: JSON.stringify({
          id: productArchivedEvent.aggregateId,
          title: state.title,
          slug: state.slug,
          vendor: state.vendor,
          productType: state.productType,
          shortDescription: state.shortDescription,
          tags: state.tags,
          createdAt: state.createdAt.toISOString(),
          status: state.status,
        }),
        created_at: productArchivedEvent.occurredAt.getTime()
      })
      break
    }
    case "product.published": {
      const productPublishedEvent = event as ProductPublishedEvent
      const state = productPublishedEvent.payload.newState

      repository.saveProjection({
        id: randomUUIDv7(),
        projection_type: 'product_list_view',
        aggregate_id: productPublishedEvent.aggregateId,
        correlation_id: productPublishedEvent.correlationId,
        version: productPublishedEvent.version,
        payload: JSON.stringify({
          id: productPublishedEvent.aggregateId,
          title: state.title,
          slug: state.slug,
          vendor: state.vendor,
          productType: state.productType,
          shortDescription: state.shortDescription,
          tags: state.tags,
          createdAt: state.createdAt.toISOString(),
          status: state.status,
        }),
        created_at: productPublishedEvent.occurredAt.getTime()
      })
      break
    }
  }
}

