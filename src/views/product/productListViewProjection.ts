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

      repository.saveProjection({
        id: randomUUIDv7(),
        projection_type: 'product_list_view',
        aggregate_id: productCreatedEvent.aggregateId,
        correlation_id: productCreatedEvent.correlationId,
        version: productCreatedEvent.version,
        payload: JSON.stringify({
          id: productCreatedEvent.aggregateId,
          title: productCreatedEvent.payload.title,
          slug: productCreatedEvent.payload.slug,
          vendor: productCreatedEvent.payload.vendor,
          productType: productCreatedEvent.payload.productType,
          shortDescription: productCreatedEvent.payload.shortDescription,
          tags: productCreatedEvent.payload.tags,
          createdAt: productCreatedEvent.payload.createdAt.toISOString(),
          status: productCreatedEvent.payload.status,
        }),
        created_at: productCreatedEvent.occurredAt.getTime()
      })
      break
    }
    case "product.archived": {
      const productArchivedEvent = event as ProductArchivedEvent

      repository.saveProjection({
        id: randomUUIDv7(),
        projection_type: 'product_list_view',
        aggregate_id: productArchivedEvent.aggregateId,
        correlation_id: productArchivedEvent.correlationId,
        version: productArchivedEvent.version,
        payload: JSON.stringify({
          id: productArchivedEvent.aggregateId,
          title: productArchivedEvent.payload.title,
          slug: productArchivedEvent.payload.slug,
          vendor: productArchivedEvent.payload.vendor,
          productType: productArchivedEvent.payload.productType,
          shortDescription: productArchivedEvent.payload.shortDescription,
          tags: productArchivedEvent.payload.tags,
          createdAt: productArchivedEvent.payload.createdAt.toISOString(),
          status: productArchivedEvent.payload.status,
        }),
        created_at: productArchivedEvent.occurredAt.getTime()
      })
      break
    }
    case "product.published": {
      const productPublishedEvent = event as ProductPublishedEvent

      repository.saveProjection({
        id: randomUUIDv7(),
        projection_type: 'product_list_view',
        aggregate_id: productPublishedEvent.aggregateId,
        correlation_id: productPublishedEvent.correlationId,
        version: productPublishedEvent.version,
        payload: JSON.stringify({
          id: productPublishedEvent.aggregateId,
          title: productPublishedEvent.payload.title,
          slug: productPublishedEvent.payload.slug,
          vendor: productPublishedEvent.payload.vendor,
          productType: productPublishedEvent.payload.productType,
          shortDescription: productPublishedEvent.payload.shortDescription,
          tags: productPublishedEvent.payload.tags,
          createdAt: productPublishedEvent.payload.createdAt.toISOString(),
          status: productPublishedEvent.payload.status,
        }),
        created_at: productPublishedEvent.occurredAt.getTime()
      })
      break
    }
  }
}

