export class ProductReadModel {
  aggregateId!: string;
  name!: string;
  slug!: string;
  vendor!: string;
  description!: string;
  tags!: string;
  createdAt!: string;
  status!: "draft" | "active" | "archived";
  correlationId!: string;
  taxable!: number;
  fulfillmentType!: "digital" | "dropship";
  dropshipSafetyBuffer!: number | null;
  variantOptions!: string;
  version!: number;
  updatedAt!: string;
  collectionIds!: string;
  metaTitle!: string;
  metaDescription!: string;

  constructor() {}
}

export type ProductView = ProductReadModel | null

export type ProductsView = ProductReadModel[]
