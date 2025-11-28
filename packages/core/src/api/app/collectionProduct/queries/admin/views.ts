export class CollectionProductReadModel {
  collectionId!: string;
  productId!: string;
  position!: number;
  name!: string;
  slug!: string;
  vendor!: string;
  description!: string;
  tags!: string;
  status!: "draft" | "active" | "archived";
  taxable!: number;
  taxId!: string;
  fulfillmentType!: "digital" | "dropship";
  dropshipSafetyBuffer!: number | null;
  variantOptions!: string;
  metaTitle!: string;
  metaDescription!: string;
  richDescriptionUrl!: string;
  variantIds!: string;
  productCreatedAt!: string;
  productUpdatedAt!: string;
  publishedAt!: string | null;
  correlationId!: string;
  productVersion!: number;

  constructor() {}
}

export type CollectionProductView = CollectionProductReadModel | null;

export type CollectionProductsView = CollectionProductReadModel[];
