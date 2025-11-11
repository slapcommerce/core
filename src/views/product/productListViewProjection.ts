import type { DomainEvent } from "../../domain/_base/domainEvent"
import type { ProjectionRepository } from "../../infrastructure/repository"
import type { ProjectionHandler } from "../../infrastructure/projectionService"
import { randomUUIDv7 } from "bun"
import { ProductCreatedEvent } from "../../domain/product/events"

export const productListViewProjection: ProjectionHandler = async (
  event: DomainEvent<string, Record<string, unknown>>,
  repository: ProjectionRepository
): Promise<void> => {
  // Only handle product.created events
  if (event.eventName !== "product.created") {
    return
  }

  const productCreatedEvent = event as ProductCreatedEvent

  // Extract relevant fields for list view
  const projectionPayload = {
    id: productCreatedEvent.aggregateId,
    title: productCreatedEvent.payload.title,
    slug: productCreatedEvent.payload.slug,
    vendor: productCreatedEvent.payload.vendor,
    productType: productCreatedEvent.payload.productType,
    shortDescription: productCreatedEvent.payload.shortDescription,
    tags: productCreatedEvent.payload.tags,
    createdAt: productCreatedEvent.occurredAt.toISOString(),
  }

  repository.saveProjection({
    id: randomUUIDv7(),
    projection_type: "product_list_view",
    aggregate_id: productCreatedEvent.aggregateId,
    correlation_id: productCreatedEvent.correlationId,
    version: productCreatedEvent.version,
    payload: JSON.stringify(projectionPayload),
    created_at: productCreatedEvent.occurredAt.getTime(),
  })
}

