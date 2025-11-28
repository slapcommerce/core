export class VariantReadModel {
  aggregateId!: string;
  productId!: string;
  sku!: string;
  price!: number;
  inventory!: number;
  options!: string;
  status!: "draft" | "active" | "archived";
  correlationId!: string;
  version!: number;
  createdAt!: string;
  updatedAt!: string;
  publishedAt!: string | null;
  images!: string;
  digitalAsset!: string | null;

  constructor() {}
}

export type VariantView = VariantReadModel | null

export type VariantsView = VariantReadModel[]
