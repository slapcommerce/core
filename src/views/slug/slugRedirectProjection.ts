import type { DomainEvent } from "../../domain/_base/domainEvent"
import type { ProjectionRepository } from "../../infrastructure/repository"
import type { ProjectionHandler } from "../../infrastructure/projectionService"
import { ProductSlugChangedEvent } from "../../domain/product/events"
import { randomUUIDv7 } from "bun"

type RedirectEntry = {
  oldSlug: string
  newSlug: string
  productId: string
}

export const slugRedirectProjection: ProjectionHandler = async (
  event: DomainEvent<string, Record<string, unknown>>,
  repository: ProjectionRepository
): Promise<void> => {
  switch (event.eventName) {
    case "product.slug_changed": {
      const productSlugChangedEvent = event as ProductSlugChangedEvent
      const aggregateId = "slug-redirects"
      const projectionType = "slug_redirect"

      // Load existing redirect projection
      const existingProjection = repository.getProjection(aggregateId, projectionType)
      
      let redirects: RedirectEntry[] = []
      if (existingProjection) {
        const payload = JSON.parse(existingProjection.payload)
        redirects = payload.redirects || []
      }

      const oldSlug = productSlugChangedEvent.payload.priorState.slug
      const newSlug = productSlugChangedEvent.payload.newState.slug
      const productId = productSlugChangedEvent.aggregateId

      // Add new redirect entry: oldSlug -> newSlug
      redirects.push({
        oldSlug,
        newSlug,
        productId,
      })

      // Chain redirects: find all redirects where newSlug === oldSlug and update them
      // For example, if we have A->B and now B->C, update A->B to A->C
      redirects = redirects.map(redirect => {
        if (redirect.newSlug === oldSlug) {
          return {
            ...redirect,
            newSlug: newSlug,
          }
        }
        return redirect
      })

      // Save updated projection
      repository.saveProjection({
        id: existingProjection?.id || randomUUIDv7(),
        projection_type: projectionType,
        aggregate_id: aggregateId,
        correlation_id: productSlugChangedEvent.correlationId,
        version: productSlugChangedEvent.version,
        payload: JSON.stringify({
          redirects,
        }),
        created_at: productSlugChangedEvent.occurredAt.getTime()
      })
      break
    }
  }
}

