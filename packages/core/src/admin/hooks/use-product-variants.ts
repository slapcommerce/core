import { useQuery, keepPreviousData } from "@tanstack/react-query";
import type { ImageItem } from "@/api/domain/_base/imageCollection";

export type GetProductVariantsQuery = {
  productId: string;
  status?: "draft" | "active" | "archived";
  limit?: number;
  offset?: number;
};

export type DigitalAsset = {
  name: string;
  fileKey: string;
  mimeType: string;
  size: number;
};

export type ProductVariant = {
  productId: string;
  variantId: string;
  position: number;
  sku: string;
  listPrice: number;
  saleType: "fixed" | "percent" | "amount" | null;
  saleValue: number | null;
  activePrice: number;
  inventory: number;
  options: Record<string, string>;
  variantStatus: "draft" | "active" | "archived";
  images: ImageItem[];
  digitalAsset: DigitalAsset | null;
  variantCreatedAt: string;
  variantUpdatedAt: string;
  variantPublishedAt: string | null;
  productName: string;
  productSlug: string;
  productDescription: string;
  productStatus: "draft" | "active" | "archived";
  productVendor: string;
  fulfillmentType: "digital" | "dropship";
  dropshipSafetyBuffer: number | null;
  defaultVariantId: string | null;
  variantOptions: Array<{ name: string; values: string[] }>;
  collections: string[];
  tags: string[];
  taxable: number;
  taxId: string;
  metaTitle: string;
  metaDescription: string;
  richDescriptionUrl: string;
  productCreatedAt: string;
  productUpdatedAt: string;
  productPublishedAt: string | null;
  variantCorrelationId: string;
  variantVersion: number;
};

type RawProductVariant = Omit<
  ProductVariant,
  "options" | "images" | "digitalAsset" | "variantOptions" | "collections" | "tags"
> & {
  options: string;
  images: string;
  digitalAsset: string | null;
  variantOptions: string;
  collections: string;
  tags: string;
};

type QueryResponse = {
  success: boolean;
  data?: RawProductVariant[];
  error?: {
    message: string;
  };
};

function parseProductVariant(raw: RawProductVariant): ProductVariant {
  return {
    ...raw,
    options: JSON.parse(raw.options),
    images: JSON.parse(raw.images),
    digitalAsset: raw.digitalAsset ? JSON.parse(raw.digitalAsset) : null,
    variantOptions: JSON.parse(raw.variantOptions),
    collections: JSON.parse(raw.collections),
    tags: JSON.parse(raw.tags),
  };
}

async function fetchProductVariants(
  params: GetProductVariantsQuery
): Promise<ProductVariant[]> {
  const response = await fetch("/admin/api/queries", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "getProductVariants",
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch product variants: ${response.statusText}`
    );
  }

  const result = (await response.json()) as QueryResponse;

  if (!result.success || !result.data) {
    throw new Error(
      result.error?.message || "Failed to fetch product variants"
    );
  }

  return result.data.map(parseProductVariant);
}

export function productVariantsQueryOptions(
  params: GetProductVariantsQuery
) {
  const normalizedParams = {
    productId: params.productId,
    status: params.status,
    limit: params.limit,
    offset: params.offset,
  };

  return {
    queryKey: ["productVariants", normalizedParams],
    queryFn: () => fetchProductVariants(params),
    staleTime: 0,
    gcTime: 1000 * 60,
    refetchOnMount: "always" as const,
    networkMode: "always" as const,
    placeholderData: keepPreviousData,
  };
}

export function useProductVariants(params: GetProductVariantsQuery) {
  return useQuery(productVariantsQueryOptions(params));
}
