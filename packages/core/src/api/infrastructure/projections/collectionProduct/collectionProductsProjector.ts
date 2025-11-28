import type { ProductEvent } from "../../../domain/product/events";
import { Projector, type ProjectorHandlers } from "../_base/projector";
import type { UnitOfWorkRepositories } from "../../unitOfWork";

export class CollectionProductsProjector extends Projector<ProductEvent> {
  protected handlers: ProjectorHandlers<ProductEvent["eventName"]>;

  constructor(repositories: UnitOfWorkRepositories) {
    super(repositories);
    this.handlers = {
      "product.created": this.handleProductChange.bind(this),
      "product.archived": this.handleProductChange.bind(this),
      "product.published": this.handleProductChange.bind(this),
      "product.unpublished": this.handleProductChange.bind(this),
      "product.slug_changed": this.handleProductChange.bind(this),
      "product.details_updated": this.handleProductChange.bind(this),
      "product.metadata_updated": this.handleProductChange.bind(this),
      "product.classification_updated": this.handleProductChange.bind(this),
      "product.tags_updated": this.handleProductChange.bind(this),
      "product.collections_updated": this.handleCollectionsUpdated.bind(this),
      "product.fulfillment_type_updated": this.handleProductChange.bind(this),
      "product.variant_options_updated": this.handleProductChange.bind(this),
      "product.update_product_tax_details": this.handleProductChange.bind(this),
      "product.collection_positions_updated":
        this.handlePositionsUpdated.bind(this),
    };
  }

  private handleProductChange(event: ProductEvent): void {
    const state = event.payload.newState;
    const productId = event.aggregateId;

    // Update all collection entries for this product
    this.repositories.collectionProductsReadModelRepository.saveFromProductState(
      productId,
      {
        ...state,
        correlationId: event.correlationId,
        version: event.version,
      },
    );
  }

  private handleCollectionsUpdated(event: ProductEvent): void {
    const priorCollections = new Set(
      event.payload.priorState.collections?.map((c) => c.collectionId) ?? [],
    );
    const newCollections = new Set(
      event.payload.newState.collections.map((c) => c.collectionId),
    );

    // Delete entries for collections that the product was removed from
    for (const collectionId of priorCollections) {
      if (!newCollections.has(collectionId)) {
        this.repositories.collectionProductsReadModelRepository.delete(
          collectionId,
          event.aggregateId,
        );
      }
    }

    // Add/update entries for current collections
    this.handleProductChange(event);
  }

  private handlePositionsUpdated(event: ProductEvent): void {
    // Just update all collection entries with new positions
    this.handleProductChange(event);
  }
}
