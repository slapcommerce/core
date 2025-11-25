import type { ImageItem } from "../../domain/_base/imageCollection"

export class CollectionReadModel {
  declare aggregateId: string;
  declare collectionId: string;
  declare title: string;
  declare slug: string;
  declare vendor: string;
  declare productType: string;
  declare shortDescription: string;
  declare tags: string[];
  declare createdAt: string;
  declare status: "draft" | "active" | "archived";
  declare correlationId: string;
  declare version: number;
  declare updatedAt: string;
  declare metaTitle: string;
  declare metaDescription: string;
  declare publishedAt: string | null;
  declare images: ImageItem[];
}

export type CollectionView = CollectionReadModel | null

export type CollectionsView = CollectionView[]