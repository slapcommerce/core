import type { DomainEvent } from "../../domain/_base/domainEvent"
import type { ProductListViewRepository } from "../../infrastructure/productListViewRepository"
import type { ProjectionHandler } from "../../infrastructure/projectionService"
import { ProductCreatedEvent } from "../../domain/product/events"
import { ProductArchivedEvent } from "../../domain/product/events"

export const productListViewProjection: ProjectionHandler = async (
  event: DomainEvent<string, Record<string, unknown>>,
  repository: ProductListViewRepository
): Promise<void> => {
  switch (event.eventName) {
    case "product.created": {
      const productCreatedEvent = event as ProductCreatedEvent

      repository.save({
        aggregate_id: productCreatedEvent.aggregateId,
        title: productCreatedEvent.payload.title,
        slug: productCreatedEvent.payload.slug,
        vendor: productCreatedEvent.payload.vendor,
        product_type: productCreatedEvent.payload.productType,
        short_description: productCreatedEvent.payload.shortDescription,
        tags: productCreatedEvent.payload.tags,
        created_at: productCreatedEvent.payload.createdAt,
        status: productCreatedEvent.payload.status,
        correlation_id: productCreatedEvent.correlationId,
        version: productCreatedEvent.version,
        updated_at: productCreatedEvent.occurredAt.toISOString(),
      })
      break
    }
    case "product.archived": {
      const productArchivedEvent = event as ProductArchivedEvent

      repository.save({
        aggregate_id: productArchivedEvent.aggregateId,
        title: productArchivedEvent.payload.title,
        slug: productArchivedEvent.payload.slug,
        vendor: productArchivedEvent.payload.vendor,
        product_type: productArchivedEvent.payload.productType,
        short_description: productArchivedEvent.payload.shortDescription,
        tags: productArchivedEvent.payload.tags,
        created_at: productArchivedEvent.payload.createdAt,
        status: productArchivedEvent.payload.status,
        correlation_id: productArchivedEvent.correlationId,
        version: productArchivedEvent.version,
        updated_at: productArchivedEvent.occurredAt.toISOString(),
      })
      break
    }
  }
}

