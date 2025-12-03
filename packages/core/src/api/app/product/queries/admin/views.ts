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
  taxId!: string | null;
  productType!: "digital" | "dropship";
  dropshipSafetyBuffer!: number | null;
  fulfillmentProviderId!: string | null;
  supplierCost!: number | null;
  supplierSku!: string | null;
  maxDownloads!: number | null;
  accessDurationDays!: number | null;
  variantOptions!: string;
  version!: number;
  updatedAt!: string;
  publishedAt!: string | null;
  collections!: string;
  metaTitle!: string;
  metaDescription!: string;
  richDescriptionUrl!: string | null;
  defaultVariantId!: string | null;

  constructor() {}
}

// Parsed view types (JSON fields are parsed from strings to their actual types)
export type ProductView = {
  aggregateId: string;
  name: string;
  slug: string;
  vendor: string;
  description: string;
  tags: string[];
  createdAt: string;
  status: "draft" | "active" | "archived";
  correlationId: string;
  taxable: number;
  taxId: string | null;
  productType: "digital" | "dropship";
  dropshipSafetyBuffer: number | null;
  fulfillmentProviderId: string | null;
  supplierCost: number | null;
  supplierSku: string | null;
  maxDownloads: number | null;
  accessDurationDays: number | null;
  variantOptions: Array<{ name: string; values: string[] }>;
  version: number;
  updatedAt: string;
  publishedAt: string | null;
  collections: Array<{ collectionId: string; position: number }>;
  metaTitle: string;
  metaDescription: string;
  richDescriptionUrl: string | null;
  defaultVariantId: string | null;
} | null

export type ProductsView = NonNullable<ProductView>[]
