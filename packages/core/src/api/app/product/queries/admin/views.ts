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
  productType!: "digital" | "dropship";
  dropshipSafetyBuffer!: number | null;
  variantOptions!: string;
  version!: number;
  updatedAt!: string;
  collections!: string;
  metaTitle!: string;
  metaDescription!: string;

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
  productType: "digital" | "dropship";
  dropshipSafetyBuffer: number | null;
  variantOptions: Array<{ name: string; values: string[] }>;
  version: number;
  updatedAt: string;
  collections: Array<{ collectionId: string; position: number }>;
  metaTitle: string;
  metaDescription: string;
} | null

export type ProductsView = NonNullable<ProductView>[]
