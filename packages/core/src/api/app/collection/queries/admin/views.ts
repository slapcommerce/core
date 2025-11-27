import type { ImageItem } from "../../../../domain/_base/imageCollection"

export class CollectionReadModel {
  aggregateId!: string;
  name!: string;
  description!: string | null;
  slug!: string;
  status!: "draft" | "active" | "archived";
  correlationId!: string;
  version!: number;
  createdAt!: string;
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