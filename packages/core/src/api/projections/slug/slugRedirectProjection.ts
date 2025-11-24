import type { DomainEvent } from "../../domain/_base/domainEvent"
import type { UnitOfWorkRepositories } from "../../infrastructure/unitOfWork"
import { ProductSlugChangedEvent } from "../../domain/product/events"
import type { ProductEvent } from "../../domain/product/events";
import { assertNever } from "../../lib/assertNever";

export class SlugRedirectProjection {
  constructor(private repositories: UnitOfWorkRepositories) { }

  async execute(
    event: ProductEvent
  ): Promise<void> {
    const { slugRedirectRepository } = this.repositories;
    switch (event.eventName) {
      case "product.slug_changed": {
        const productSlugChangedEvent = event as ProductSlugChangedEvent;
        const oldSlug = productSlugChangedEvent.payload.priorState.slug;
        const newSlug = productSlugChangedEvent.payload.newState.slug;
        const productId = productSlugChangedEvent.aggregateId;

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
          entity_id: productId,
          entity_type: 'product',
          product_id: productId,
          created_at: productSlugChangedEvent.occurredAt,
        });
        break;
      }
      case "product.created":
      case "product.archived":
      case "product.published":
      case "product.unpublished":
      case "product.details_updated":
      case "product.metadata_updated":
      case "product.classification_updated":
      case "product.tags_updated":
      case "product.collections_updated":
      case "product.fulfillment_type_updated":
      case "product.variant_options_updated":
      case "product.update_product_tax_details":
        // These events don't affect slug redirects
        break;
      default:
        assertNever(event);
    }
  }
}
