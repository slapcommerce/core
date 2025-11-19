import type { DomainEvent } from "../../domain/_base/domainEvent"
import type { ProjectionHandler, UnitOfWorkRepositories } from "../../infrastructure/projectionService"
import { VariantCreatedEvent } from "../../domain/variant/events"
import { VariantArchivedEvent } from "../../domain/variant/events"
import { VariantDetailsUpdatedEvent } from "../../domain/variant/events"
import { VariantPriceUpdatedEvent } from "../../domain/variant/events"
import { VariantInventoryUpdatedEvent } from "../../domain/variant/events"
import { VariantSkuUpdatedEvent } from "../../domain/variant/events"
import { VariantPublishedEvent } from "../../domain/variant/events"
import { VariantImagesUpdatedEvent } from "../../domain/variant/events"
import type { VariantDetailsViewData } from "../../infrastructure/repositories/variantDetailsViewRepository"
import type { VariantState } from "../../domain/variant/events"

function createVariantDetailsViewData(
  aggregateId: string,
  correlationId: string,
  version: number,
  state: VariantState,
  updatedAt: Date
): VariantDetailsViewData {
  return {
    aggregate_id: aggregateId,
    product_id: state.productId,
    sku: state.sku,
    title: state.title,
    price: state.price,
    inventory: state.inventory,
    options: JSON.stringify(state.options),
    barcode: state.barcode,
    status: state.status,
    correlation_id: correlationId,
    version: version,
    created_at: state.createdAt,
    updated_at: updatedAt,
    images: state.images ? JSON.stringify(state.images.toJSON()) : null,
  }
}

export const variantDetailsViewProjection: ProjectionHandler = async (
  event: DomainEvent<string, Record<string, unknown>>,
  repositories: UnitOfWorkRepositories
): Promise<void> => {
  const { variantDetailsViewRepository } = repositories
  switch (event.eventName) {
    case "variant.created": {
      const variantCreatedEvent = event as VariantCreatedEvent
      const state = variantCreatedEvent.payload.newState

      // Create variant details view data
      const variantData = createVariantDetailsViewData(
        variantCreatedEvent.aggregateId,
        variantCreatedEvent.correlationId,
        variantCreatedEvent.version,
        state,
        variantCreatedEvent.occurredAt
      )

      // Save to variant_details_view table
      variantDetailsViewRepository.save(variantData)
      break
    }
    case "variant.archived": {
      const variantArchivedEvent = event as VariantArchivedEvent

      // Delete from variant_details_view
      variantDetailsViewRepository.deleteByVariant(variantArchivedEvent.aggregateId)
      break
    }
    case "variant.details_updated": {
      const variantDetailsUpdatedEvent = event as VariantDetailsUpdatedEvent
      const state = variantDetailsUpdatedEvent.payload.newState

      // Update variant details in variant_details_view
      const variantData = createVariantDetailsViewData(
        variantDetailsUpdatedEvent.aggregateId,
        variantDetailsUpdatedEvent.correlationId,
        variantDetailsUpdatedEvent.version,
        state,
        variantDetailsUpdatedEvent.occurredAt
      )

      variantDetailsViewRepository.save(variantData)
      break
    }
    case "variant.price_updated": {
      const variantPriceUpdatedEvent = event as VariantPriceUpdatedEvent
      const state = variantPriceUpdatedEvent.payload.newState

      // Update price in variant_details_view
      const variantData = createVariantDetailsViewData(
        variantPriceUpdatedEvent.aggregateId,
        variantPriceUpdatedEvent.correlationId,
        variantPriceUpdatedEvent.version,
        state,
        variantPriceUpdatedEvent.occurredAt
      )

      variantDetailsViewRepository.save(variantData)
      break
    }
    case "variant.inventory_updated": {
      const variantInventoryUpdatedEvent = event as VariantInventoryUpdatedEvent
      const state = variantInventoryUpdatedEvent.payload.newState

      // Update inventory in variant_details_view
      const variantData = createVariantDetailsViewData(
        variantInventoryUpdatedEvent.aggregateId,
        variantInventoryUpdatedEvent.correlationId,
        variantInventoryUpdatedEvent.version,
        state,
        variantInventoryUpdatedEvent.occurredAt
      )

      variantDetailsViewRepository.save(variantData)
      break
    }
    case "variant.sku_updated": {
      const variantSkuUpdatedEvent = event as VariantSkuUpdatedEvent
      const state = variantSkuUpdatedEvent.payload.newState

      // Update SKU in variant_details_view
      const variantData = createVariantDetailsViewData(
        variantSkuUpdatedEvent.aggregateId,
        variantSkuUpdatedEvent.correlationId,
        variantSkuUpdatedEvent.version,
        state,
        variantSkuUpdatedEvent.occurredAt
      )

      variantDetailsViewRepository.save(variantData)
      break
    }
    case "variant.published": {
      const variantPublishedEvent = event as VariantPublishedEvent
      const state = variantPublishedEvent.payload.newState

      // Update status to active in variant_details_view
      const variantData = createVariantDetailsViewData(
        variantPublishedEvent.aggregateId,
        variantPublishedEvent.correlationId,
        variantPublishedEvent.version,
        state,
        variantPublishedEvent.occurredAt
      )

      variantDetailsViewRepository.save(variantData)
      break
    }
    case "variant.images_updated": {
      const variantImagesUpdatedEvent = event as VariantImagesUpdatedEvent
      const state = variantImagesUpdatedEvent.payload.newState

      // Update images in variant_details_view
      const variantData = createVariantDetailsViewData(
        variantImagesUpdatedEvent.aggregateId,
        variantImagesUpdatedEvent.correlationId,
        variantImagesUpdatedEvent.version,
        state,
        variantImagesUpdatedEvent.occurredAt
      )

      variantDetailsViewRepository.save(variantData)
      break
    }
  }
}
