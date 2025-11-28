import type { ProductEvent } from "../../../domain/product/events";
import type { ProductPositionsWithinCollectionEvent } from "../../../domain/productPositionsWithinCollection/events";
import { Projector, type ProjectorHandlers } from "../_base/projector";
import type { UnitOfWorkRepositories } from "../../unitOfWork";

type CollectionProductsEvent = ProductEvent | ProductPositionsWithinCollectionEvent;

export class CollectionProductsProjector extends Projector<CollectionProductsEvent> {
  protected handlers: ProjectorHandlers<CollectionProductsEvent["eventName"]>;

  constructor(repositories: UnitOfWorkRepositories) {
    super(repositories);
    this.handlers = {
      // Product events
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
      "product.default_variant_set": this.handleProductChange.bind(this),
      // ProductPositionsWithinCollection events - update positions
      "productPositionsWithinCollection.created": this.handlePositionsChange.bind(this),
      "productPositionsWithinCollection.reordered": this.handlePositionsChange.bind(this),
      "productPositionsWithinCollection.product_added": this.handlePositionsChange.bind(this),
      "productPositionsWithinCollection.product_removed": this.handlePositionsChange.bind(this),
      "productPositionsWithinCollection.archived": this.handlePositionsChange.bind(this),
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
    // collections is now string[] (just IDs)
    const priorCollections = new Set(
      event.payload.priorState.collections ?? [],
    );
    const newCollections = new Set(event.payload.newState.collections);

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

  private handlePositionsChange(event: ProductPositionsWithinCollectionEvent): void {
    const state = event.payload.newState;
    const positions = state.productIds.map((productId, index) => ({
      productId,
      position: index,
    }));

    // Bulk update positions using CASE statement (O(1) SQL)
    this.repositories.collectionProductsReadModelRepository.updatePositions(
      state.collectionId,
      positions,
    );
  }
}
