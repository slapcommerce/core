import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";

export type FulfillmentType = "digital" | "dropship";

function getProductCommandType(baseCommand: string, fulfillmentType: FulfillmentType): string {
  const prefix = fulfillmentType === "digital" ? "DigitalDownloadable" : "Dropship";
  return baseCommand.replace("Product", `${prefix}Product`);
}

export type GetProductListQuery = {
  status?: "draft" | "active" | "archived";
  collectionId?: string;
  limit?: number;
  offset?: number;
};

export type Product = {
  aggregateId: string;
  name: string;
  slug: string;
  vendor: string;
  description: string;
  tags: string[];
  createdAt: string;
  status: "draft" | "active" | "archived";
  correlationId: string;
  version: number;
  updatedAt: string;
  publishedAt: string | null;
  collections: Array<{ collectionId: string; position: number }>;
  metaTitle: string;
  metaDescription: string;
  richDescriptionUrl: string | null;
  productType: "digital" | "dropship";
  dropshipSafetyBuffer: number | null;
  fulfillmentProviderId: string | null;
  supplierCost: number | null;
  supplierSku: string | null;
  maxDownloads: number | null;
  accessDurationDays: number | null;
  defaultVariantId: string | null;
  variantOptions: Array<{
    name: string;
    values: string[];
  }>;
  taxable: number;
  taxId: string | null;
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
  params?: GetProductListQuery
): Promise<Product[]> {
  const response = await fetch("/admin/api/queries", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "getProducts",
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

export function productsQueryOptions(params?: GetProductListQuery) {
  // Normalize params to ensure stable query key
  const normalizedParams = params
    ? {
      status: params.status,
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

export function useProducts(params?: GetProductListQuery) {
  return useQuery(productsQueryOptions(params));
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      correlationId: string;
      userId: string;
      name: string;
      description: string;
      slug: string;
      collections: string[];
      richDescriptionUrl: string;
      vendor: string;
      variantOptions: Array<{
        name: string;
        values: string[];
      }>;
      metaTitle: string;
      metaDescription: string;
      tags: string[];
      taxable: boolean;
      taxId?: string;
      fulfillmentType: FulfillmentType;
      dropshipSafetyBuffer?: number;
    }) => {
      const commandType = getProductCommandType("createProduct", payload.fulfillmentType);
      const result = await sendCommand(commandType, payload);
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
      fulfillmentType: FulfillmentType;
    }) => {
      const commandType = getProductCommandType("archiveProduct", payload.fulfillmentType);
      const result = await sendCommand(commandType, payload);
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
      fulfillmentType: FulfillmentType;
    }) => {
      const commandType = getProductCommandType("publishProduct", payload.fulfillmentType);
      const result = await sendCommand(commandType, payload);
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
      fulfillmentType: FulfillmentType;
    }) => {
      const commandType = getProductCommandType("unpublishProduct", payload.fulfillmentType);
      const result = await sendCommand(commandType, payload);
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
      fulfillmentType: FulfillmentType;
    }) => {
      const commandType = getProductCommandType("changeProductSlug", payload.fulfillmentType);
      const result = await sendCommand(commandType, payload);
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
      name: string;
      description: string;
      richDescriptionUrl: string;
      expectedVersion: number;
      fulfillmentType: FulfillmentType;
    }) => {
      const commandType = getProductCommandType("updateProductDetails", payload.fulfillmentType);
      const result = await sendCommand(commandType, payload);
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
      fulfillmentType: FulfillmentType;
    }) => {
      const commandType = getProductCommandType("updateProductMetadata", payload.fulfillmentType);
      const result = await sendCommand(commandType, payload);
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
      vendor: string;
      expectedVersion: number;
      fulfillmentType: FulfillmentType;
    }) => {
      const commandType = getProductCommandType("updateProductClassification", payload.fulfillmentType);
      const result = await sendCommand(commandType, payload);
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
      fulfillmentType: FulfillmentType;
    }) => {
      const commandType = getProductCommandType("updateProductTags", payload.fulfillmentType);
      const result = await sendCommand(commandType, payload);
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
      collections: string[];
      expectedVersion: number;
      fulfillmentType: FulfillmentType;
    }) => {
      const commandType = getProductCommandType("updateProductCollections", payload.fulfillmentType);
      const result = await sendCommand(commandType, payload);
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
      fulfillmentType: FulfillmentType;
    }) => {
      const commandType = getProductCommandType("updateProductOptions", payload.fulfillmentType);
      const result = await sendCommand(commandType, payload);
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

export function useUpdateProductDownloadSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      maxDownloads: number | null;
      accessDurationDays: number | null;
      expectedVersion: number;
    }) => {
      const result = await sendCommand("updateDigitalDownloadableProductDownloadSettings", payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update download settings");
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

export function useUpdateDropshipProductSafetyBuffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      safetyBuffer: number;
      expectedVersion: number;
    }) => {
      const result = await sendCommand("updateDropshipProductSafetyBuffer", payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update safety buffer");
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
