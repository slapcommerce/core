import type { ProductSlugChangedEvent } from "../../domain/product/events";
import { Projection } from "../_base/projection";

export class SlugRedirectProjection extends Projection<ProductSlugChangedEvent> {
  protected handlers = {
    'product.slug_changed': this.handleSlugChanged.bind(this),
  };

  private async handleSlugChanged(event: ProductSlugChangedEvent): Promise<void> {
    const { slugRedirectRepository } = this.repositories;
    const oldSlug = event.payload.priorState.slug;
    const newSlug = event.payload.newState.slug;
    const productId = event.aggregateId;

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
      created_at: event.occurredAt,
    });
  }
}
