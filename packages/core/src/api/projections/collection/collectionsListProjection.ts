import type { CollectionsListViewData } from "../../infrastructure/repositories/collectionsListViewRepository"
import type { CollectionState } from "../../domain/collection/events"
import type { CollectionEvent } from "../../domain/collection/events";
import { Projection } from "../_base/projection";

export class CollectionsListViewProjection extends Projection<CollectionEvent> {
  protected handlers = {
    'collection.created': this.updateView.bind(this),
    'collection.archived': this.updateView.bind(this),
    'collection.metadata_updated': this.updateView.bind(this),
    'collection.published': this.updateView.bind(this),
    'collection.seo_metadata_updated': this.updateView.bind(this),
    'collection.unpublished': this.updateView.bind(this),
    'collection.images_updated': this.updateView.bind(this),
  };

  private async updateView(event: CollectionEvent): Promise<void> {
    const state = event.payload.newState;
    const viewData = this.toViewData(
      event.aggregateId,
      event.correlationId,
      event.version,
      state,
      event.occurredAt
    );
    this.repositories.collectionsListViewRepository.save(viewData);
  }

  private toViewData(
    aggregateId: string,
    correlationId: string,
    version: number,
    state: CollectionState,
    updatedAt: Date
  ): CollectionsListViewData {
    return {
      aggregate_id: aggregateId,
      name: state.name,
      slug: state.slug,
      description: state.description,
      status: state.status,
      correlation_id: correlationId,
      version: version,
      created_at: state.createdAt,
      updated_at: updatedAt,
      meta_title: state.metaTitle,
      meta_description: state.metaDescription,
      published_at: state.publishedAt,
      images: state.images ? JSON.stringify(state.images.toJSON()) : null,
    }
  }
}
