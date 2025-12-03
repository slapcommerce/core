export class ProductVariantReadModel {
  productId!: string;
  variantId!: string;
  position!: number;
  sku!: string;
  listPrice!: number;
  saleType!: string | null;
  saleValue!: number | null;
  activePrice!: number;
  inventory!: number;
  options!: string;
  variantStatus!: "draft" | "active" | "archived";
  images!: string;
  digitalAsset!: string | null;
  variantCreatedAt!: string;
  variantUpdatedAt!: string;
  variantPublishedAt!: string | null;
  productName!: string;
  productSlug!: string;
  productDescription!: string;
  productStatus!: "draft" | "active" | "archived";
  productVendor!: string;
  productType!: "digital" | "dropship";
  dropshipSafetyBuffer!: number | null;
  defaultVariantId!: string | null;
  variantOptions!: string;
  collections!: string;
  tags!: string;
  taxable!: number;
  taxId!: string;
  metaTitle!: string;
  metaDescription!: string;
  richDescriptionUrl!: string;
  productCreatedAt!: string;
  productUpdatedAt!: string;
  productPublishedAt!: string | null;
  variantCorrelationId!: string;
  variantVersion!: number;

  constructor() {}
}

export type ProductVariantsView = ProductVariantReadModel[];
