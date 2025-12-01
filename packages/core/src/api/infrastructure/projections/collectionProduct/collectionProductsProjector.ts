import type { DropshipProductEvent } from "../../../domain/dropshipProduct/events";
import type { DigitalDownloadableProductEvent } from "../../../domain/digitalDownloadableProduct/events";
import type { ProductPositionsWithinCollectionEvent } from "../../../domain/productPositionsWithinCollection/events";
import { Projector, type ProjectorHandlers } from "../_base/projector";
import type { UnitOfWorkRepositories } from "../../unitOfWork";

type AllProductEvent = DropshipProductEvent | DigitalDownloadableProductEvent;
type CollectionProductsEvent = AllProductEvent | ProductPositionsWithinCollectionEvent;

export class CollectionProductsProjector extends Projector<CollectionProductsEvent> {
  protected handlers: ProjectorHandlers<CollectionProductsEvent["eventName"]>;

  constructor(repositories: UnitOfWorkRepositories) {
    super(repositories);
    this.handlers = {
      // Dropship product events (15)
      "dropship_product.created": this.handleProductChange.bind(this),
      "dropship_product.archived": this.handleProductChange.bind(this),
      "dropship_product.published": this.handleProductChange.bind(this),
      "dropship_product.unpublished": this.handleProductChange.bind(this),
      "dropship_product.slug_changed": this.handleProductChange.bind(this),
      "dropship_product.details_updated": this.handleProductChange.bind(this),
      "dropship_product.metadata_updated": this.handleProductChange.bind(this),
      "dropship_product.classification_updated": this.handleProductChange.bind(this),
      "dropship_product.tags_updated": this.handleProductChange.bind(this),
      "dropship_product.collections_updated": this.handleCollectionsUpdated.bind(this),
      "dropship_product.variant_options_updated": this.handleProductChange.bind(this),
      "dropship_product.tax_details_updated": this.handleProductChange.bind(this),
      "dropship_product.default_variant_set": this.handleProductChange.bind(this),
      "dropship_product.safety_buffer_updated": this.handleProductChange.bind(this),
      "dropship_product.fulfillment_settings_updated": this.handleProductChange.bind(this),

      // Digital downloadable product events (14)
      "digital_downloadable_product.created": this.handleProductChange.bind(this),
      "digital_downloadable_product.archived": this.handleProductChange.bind(this),
      "digital_downloadable_product.published": this.handleProductChange.bind(this),
      "digital_downloadable_product.unpublished": this.handleProductChange.bind(this),
      "digital_downloadable_product.slug_changed": this.handleProductChange.bind(this),
      "digital_downloadable_product.details_updated": this.handleProductChange.bind(this),
      "digital_downloadable_product.metadata_updated": this.handleProductChange.bind(this),
      "digital_downloadable_product.classification_updated": this.handleProductChange.bind(this),
      "digital_downloadable_product.tags_updated": this.handleProductChange.bind(this),
      "digital_downloadable_product.collections_updated": this.handleCollectionsUpdated.bind(this),
      "digital_downloadable_product.variant_options_updated": this.handleProductChange.bind(this),
      "digital_downloadable_product.tax_details_updated": this.handleProductChange.bind(this),
      "digital_downloadable_product.default_variant_set": this.handleProductChange.bind(this),
      "digital_downloadable_product.download_settings_updated": this.handleProductChange.bind(this),

      // ProductPositionsWithinCollection events (5)
      "productPositionsWithinCollection.created": this.handlePositionsChange.bind(this),
      "productPositionsWithinCollection.reordered": this.handlePositionsChange.bind(this),
      "productPositionsWithinCollection.product_added": this.handlePositionsChange.bind(this),
      "productPositionsWithinCollection.product_removed": this.handlePositionsChange.bind(this),
      "productPositionsWithinCollection.archived": this.handlePositionsChange.bind(this),
    };
  }

  private handleProductChange(event: AllProductEvent): void {
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

  private handleCollectionsUpdated(event: AllProductEvent): void {
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
