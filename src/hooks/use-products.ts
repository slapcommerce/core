import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import type { ProductListViewParams } from "@/views/productListView";

export type Product = {
  aggregate_id: string;
  title: string;
  slug: string;
  vendor: string;
  product_type: string;
  short_description: string;
  tags: string[];
  created_at: string;
  status: "draft" | "active" | "archived";
  correlation_id: string;
  version: number;
  updated_at: string;
  collection_ids: string[];
  meta_title: string;
  meta_description: string;
  fulfillment_type: "physical" | "digital" | "dropship";
  digital_asset_url: string | null;
  max_licenses: number | null;
  dropship_safety_buffer: number | null;
  variant_options: Array<{
    name: string;
    values: string[];
  }>;
};

type QueryResponse = {
  success: boolean;
  data?: Product[];
  error?: {
    message: string;
  };
};

type CommandResponse = {
  success: boolean;
  data?: unknown;
  error?: {
    message: string;
  };
};

async function fetchProducts(
  params?: ProductListViewParams
): Promise<Product[]> {
  const response = await fetch("/admin/api/queries", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "productListView",
      params: params || {},
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch products: ${response.statusText}`);
  }

  const result = (await response.json()) as QueryResponse;

  if (!result.success || !result.data) {
    throw new Error(result.error?.message || "Failed to fetch products");
  }

  return result.data;
}

async function sendCommand(
  type: string,
  payload: unknown
): Promise<CommandResponse> {
  const response = await fetch("/admin/api/commands", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type,
      payload,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to execute command: ${response.statusText}`);
  }

  return (await response.json()) as CommandResponse;
}

export function productsQueryOptions(params?: ProductListViewParams) {
  // Normalize params to ensure stable query key
  const normalizedParams = params
    ? {
      status: params.status,
      vendor: params.vendor,
      productType: params.productType,
      collectionId: params.collectionId,
      limit: params.limit,
      offset: params.offset,
    }
    : undefined;

  return {
    queryKey: ["products", normalizedParams],
    queryFn: () => fetchProducts(params),
    staleTime: 0, // Always consider stale to ensure fresh data
    gcTime: 1000 * 60, // Keep in cache for 1 minute
    refetchOnMount: "always" as const, // Always refetch on mount
    networkMode: "always" as const, // Always use network, never serve stale cache
    placeholderData: keepPreviousData, // Show previous data during refetch
  };
}

export function useProducts(params?: ProductListViewParams) {
  return useQuery(productsQueryOptions(params));
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      correlationId: string;
      userId: string;
      title: string;
      shortDescription: string;
      slug: string;
      collectionIds: string[];
      variantIds: string[];
      richDescriptionUrl: string;
      productType: string;
      vendor: string;
      variantOptions: Array<{
        name: string;
        values: string[];
      }>;
      metaTitle: string;
      metaDescription: string;
      tags: string[];
      requiresShipping: boolean;
      taxable: boolean;
      pageLayoutId: string | null;
    }) => {
      const result = await sendCommand("createProduct", payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to create product");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["products"],
        refetchType: "all"
      });
    },
  });
}

export function useArchiveProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      expectedVersion: number;
    }) => {
      const result = await sendCommand("archiveProduct", payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to archive product");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["products"],
        refetchType: "all"
      });
    },
  });
}

export function usePublishProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      expectedVersion: number;
    }) => {
      const result = await sendCommand("publishProduct", payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to publish product");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["products"],
        refetchType: "all"
      });
    },
  });
}

export function useUnpublishProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      expectedVersion: number;
    }) => {
      const result = await sendCommand("unpublishProduct", payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to unpublish product");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["products"],
        refetchType: "all"
      });
    },
  });
}

export function useChangeProductSlug() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      newSlug: string;
      expectedVersion: number;
    }) => {
      const result = await sendCommand("changeSlug", payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to change product slug");
      }
      return result.data;
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["products"],
        refetchType: "all"
      });
      // Invalidate slug redirect chain query for this product
      await queryClient.invalidateQueries({
        queryKey: ["slugRedirectChain", variables.id, "product"],
        refetchType: "all"
      });
    },
  });
}

export function useUpdateProductDetails() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      title: string;
      shortDescription: string;
      richDescriptionUrl: string;
      expectedVersion: number;
    }) => {
      const result = await sendCommand("updateProductDetails", payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update product details");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["products"],
        refetchType: "all"
      });
    },
  });
}

export function useUpdateProductMetadata() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      metaTitle: string;
      metaDescription: string;
      expectedVersion: number;
    }) => {
      const result = await sendCommand("updateProductMetadata", payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update product metadata");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["products"],
        refetchType: "all"
      });
    },
  });
}

export function useUpdateProductClassification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      productType: string;
      vendor: string;
      expectedVersion: number;
    }) => {
      const result = await sendCommand("updateProductClassification", payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update product classification");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["products"],
        refetchType: "all"
      });
    },
  });
}

export function useUpdateProductTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      tags: string[];
      expectedVersion: number;
    }) => {
      const result = await sendCommand("updateProductTags", payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update product tags");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["products"],
        refetchType: "all"
      });
    },
  });
}

export function useUpdateProductCollections() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      collectionIds: string[];
      expectedVersion: number;
    }) => {
      const result = await sendCommand("updateProductCollections", payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update product collections");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["products"],
        refetchType: "all"
      });
    },
  });
}

export function useUpdateProductShippingSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      requiresShipping: boolean;
      taxable: boolean;
      expectedVersion: number;
    }) => {
      const result = await sendCommand("updateProductShippingSettings", payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update product shipping settings");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["products"],
        refetchType: "all"
      });
    },
  });
}

export function useUpdateProductPageLayout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      pageLayoutId: string | null;
      expectedVersion: number;
    }) => {
      const result = await sendCommand("updateProductPageLayout", payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update product page layout");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["products"],
        refetchType: "all"
      });
    },
  });
}

export function useUpdateProductOptions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      variantOptions: Array<{
        name: string;
        values: string[];
      }>;
      expectedVersion: number;
    }) => {
      const result = await sendCommand("updateProductOptions", payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update product options");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["products"],
        refetchType: "all"
      });
    },
  });
}

export function useUpdateProductFulfillmentType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      fulfillmentType: "digital" | "dropship";
      digitalAssetUrl?: string;
      maxLicenses?: number | null;
      dropshipSafetyBuffer?: number;
      expectedVersion: number;
    }) => {
      const result = await sendCommand("updateProductFulfillmentType", payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update product fulfillment type");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["products"],
        refetchType: "all"
      });
    },
  });
}
