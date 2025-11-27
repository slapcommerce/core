import type { ImageItem } from "../../../../domain/_base/imageCollection"

export class CollectionReadModel {
  aggregateId!: string;
  collectionId!: string;
  title!: string;
  slug!: string;
  vendor!: string;
  productType!: string;
  shortDescription!: string;
  tags!: string[];
  createdAt!: string;
  status!: "draft" | "active" | "archived";
  correlationId!: string;
  version!: number;
  updatedAt!: string;
  metaTitle!: string;
  metaDescription!: string;
  publishedAt!: string | null;
  images!: ImageItem[];

  constructor() {}
}

export type CollectionView = CollectionReadModel | null

export type CollectionsView = CollectionView[]

export class SlugRedirectReadModel {
  oldSlug!: string;
  newSlug!: string;
  createdAt!: string;

  constructor() {}
}

export type SlugRedirectChainView = SlugRedirectReadModel[]