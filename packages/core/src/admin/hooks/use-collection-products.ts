import { useQuery, keepPreviousData } from "@tanstack/react-query";

export type GetCollectionProductsQuery = {
  collectionId: string;
  status?: "draft" | "active" | "archived";
  limit?: number;
  offset?: number;
};

export type CollectionProduct = {
  collectionId: string;
  productId: string;
  position: number;
  name: string;
  slug: string;
  vendor: string;
  description: string;
  tags: string[];
  status: "draft" | "active" | "archived";
  taxable: number;
  taxId: string;
  fulfillmentType: "digital" | "dropship";
  dropshipSafetyBuffer: number | null;
  variantOptions: Array<{ name: string; values: string[] }>;
  metaTitle: string;
  metaDescription: string;
  richDescriptionUrl: string;
  variantIds: string[];
  productCreatedAt: string;
  productUpdatedAt: string;
  publishedAt: string | null;
  correlationId: string;
  productVersion: number;
};

type RawCollectionProduct = Omit<
  CollectionProduct,
  "tags" | "variantOptions" | "variantIds"
> & {
  tags: string;
  variantOptions: string;
  variantIds: string;
};

type QueryResponse = {
  success: boolean;
  data?: RawCollectionProduct[];
  error?: {
    message: string;
  };
};

function parseCollectionProduct(raw: RawCollectionProduct): CollectionProduct {
  return {
    ...raw,
    tags: JSON.parse(raw.tags),
    variantOptions: JSON.parse(raw.variantOptions),
    variantIds: JSON.parse(raw.variantIds),
  };
}

async function fetchCollectionProducts(
  params: GetCollectionProductsQuery
): Promise<CollectionProduct[]> {
  const response = await fetch("/admin/api/queries", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "getCollectionProducts",
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch collection products: ${response.statusText}`
    );
  }

  const result = (await response.json()) as QueryResponse;

  if (!result.success || !result.data) {
    throw new Error(
      result.error?.message || "Failed to fetch collection products"
    );
  }

  return result.data.map(parseCollectionProduct);
}

export function collectionProductsQueryOptions(
  params: GetCollectionProductsQuery
) {
  const normalizedParams = {
    collectionId: params.collectionId,
    status: params.status,
    limit: params.limit,
    offset: params.offset,
  };

  return {
    queryKey: ["collectionProducts", normalizedParams],
    queryFn: () => fetchCollectionProducts(params),
    staleTime: 0,
    gcTime: 1000 * 60,
    refetchOnMount: "always" as const,
    networkMode: "always" as const,
    placeholderData: keepPreviousData,
  };
}

export function useCollectionProducts(params: GetCollectionProductsQuery) {
  return useQuery(collectionProductsQueryOptions(params));
}
