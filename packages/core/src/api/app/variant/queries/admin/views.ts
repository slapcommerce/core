export class VariantReadModel {
  aggregateId!: string;
  productId!: string;
  sku!: string;
  listPrice!: number;
  saleType!: "fixed" | "percent" | "amount" | null;
  saleValue!: number | null;
  activePrice!: number;
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

// Digital asset type
export type DigitalAsset = {
  name: string;
  fileKey: string;
  mimeType: string;
  size: number;
}

// Parsed view types (JSON fields are parsed from strings to their actual types)
export type VariantView = {
  aggregateId: string;
  productId: string;
  sku: string;
  listPrice: number;
  saleType: "fixed" | "percent" | "amount" | null;
  saleValue: number | null;
  activePrice: number;
  inventory: number;
  options: Record<string, string>;
  status: "draft" | "active" | "archived";
  correlationId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  images: unknown[];
  digitalAsset: DigitalAsset | null;
} | null

export type VariantsView = NonNullable<VariantView>[]
