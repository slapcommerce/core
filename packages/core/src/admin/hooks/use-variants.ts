import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import type { ImageItem } from "@/api/domain/_base/imageCollection";

export type FulfillmentType = "digital" | "dropship";

function getVariantCommandType(baseCommand: string, fulfillmentType: FulfillmentType): string {
  const prefix = fulfillmentType === "digital" ? "DigitalDownloadable" : "Dropship";
  return baseCommand.replace("Variant", `${prefix}Variant`);
}

export type GetvariantssQuery = {
  productId?: string;
  variantId?: string;
  status?: "draft" | "active" | "archived";
  limit?: number;
  offset?: number;
};

export type GetVariantsQuery = {
  variantId?: string;
  productId?: string;
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

export type variants = {
  aggregateId: string;
  variant_id: string;
  title: string;
  slug: string;
  vendor: string;
  product_type: string;
  short_description: string;
  tags: string[];
  created_at: string;
  status: "draft" | "active" | "archived";
  correlationId: string;
  version: number;
  updated_at: string;
};

export type Variant = {
  aggregateId: string;
  variant_id: string;
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
  created_at: string;
  updated_at: string;
  images: ImageItem[];
  digital_asset: DigitalAsset | null;
};

type QueryResponse = {
  success: boolean;
  data?: variants[];
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

async function fetchvariantss(
  params?: GetvariantssQuery
): Promise<variants[]> {
  const response = await fetch("/admin/api/queries", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "getVariants",
      params: params || {},
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch product variants: ${ response.statusText } `);
  }

  const result = (await response.json()) as QueryResponse;

  if (!result.success || !result.data) {
    throw new Error(result.error?.message || "Failed to fetch product variants");
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
    throw new Error(`Failed to execute command: ${ response.statusText } `);
  }

  return (await response.json()) as CommandResponse;
}

export function usevariantss(params?: GetvariantssQuery) {
  // Normalize params to ensure stable query key
  const normalizedParams = params
    ? {
      productId: params.productId,
      variantId: params.variantId,
      status: params.status,
      limit: params.limit,
      offset: params.offset,
    }
    : undefined;

  return useQuery({
    queryKey: ["productVariants", normalizedParams],
    queryFn: () => fetchvariantss(params),
    enabled: !!params?.productId, // Only run query if productId is provided
    staleTime: 0, // Always consider stale to ensure fresh data
    gcTime: 1000 * 60, // Keep in cache for 1 minute
    refetchOnMount: "always", // Always refetch on mount
    networkMode: "always", // Always use network, never serve stale cache
    placeholderData: keepPreviousData, // Show previous data during refetch
  });
}

async function fetchVariants(
  params?: GetVariantsQuery
): Promise<Variant[]> {
  const response = await fetch("/admin/api/queries", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "getVariants",
      params: params || {},
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch variants: ${ response.statusText } `);
  }

  const result = (await response.json()) as { success: boolean; data?: Variant[]; error?: { message: string } };

  if (!result.success || !result.data) {
    throw new Error(result.error?.message || "Failed to fetch variants");
  }

  return result.data;
}

export function variantsQueryOptions(params?: GetVariantsQuery) {
  // Normalize params to ensure stable query key
  const normalizedParams = params
    ? {
      variantId: params.variantId,
      productId: params.productId,
      status: params.status,
      limit: params.limit,
      offset: params.offset,
    }
    : undefined;

  return {
    queryKey: ["variants", normalizedParams],
    queryFn: () => fetchVariants(params),
    staleTime: 0, // Always consider stale to ensure fresh data
    gcTime: 1000 * 60, // Keep in cache for 1 minute
    refetchOnMount: "always" as const, // Always refetch on mount
    networkMode: "always" as const, // Always use network, never serve stale cache
    placeholderData: keepPreviousData, // Show previous data during refetch
  };
}

export function useVariants(params?: GetVariantsQuery) {
  return useQuery(variantsQueryOptions(params));
}

export function useCreateVariant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      correlationId: string;
      userId: string;
      productId: string;
      sku?: string;
      price?: number;
      inventory?: number;
      options?: Record<string, string>;
      fulfillmentType: FulfillmentType;
    }) => {
      const commandType = getVariantCommandType("createVariant", payload.fulfillmentType);
      const result = await sendCommand(commandType, payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to create variant");
      }
      return result.data;
    },
    onSuccess: async (_, variables) => {
      // Invalidate product variants for this product
      await queryClient.invalidateQueries({
        queryKey: ["productVariants"],
        refetchType: "all"
      });
      // Invalidate variants view
      await queryClient.invalidateQueries({
        queryKey: ["variants"],
        refetchType: "all"
      });
      // Also invalidate products list since variant count changes
      await queryClient.invalidateQueries({
        queryKey: ["products"],
        refetchType: "all"
      });
    },
  });
}

export function useUpdateVariantDetails() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      options: Record<string, string>;
      expectedVersion: number;
      fulfillmentType: FulfillmentType;
    }) => {
      const commandType = getVariantCommandType("updateVariantDetails", payload.fulfillmentType);
      const result = await sendCommand(commandType, payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update variant details");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["productVariants"],
        refetchType: "all"
      });
      await queryClient.invalidateQueries({
        queryKey: ["variants"],
        refetchType: "all"
      });
    },
  });
}

export function useUpdateVariantPrice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      price: number;
      expectedVersion: number;
      fulfillmentType: FulfillmentType;
    }) => {
      const commandType = getVariantCommandType("updateVariantPrice", payload.fulfillmentType);
      const result = await sendCommand(commandType, payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update variant price");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["productVariants"],
        refetchType: "all"
      });
      await queryClient.invalidateQueries({
        queryKey: ["variants"],
        refetchType: "all"
      });
    },
  });
}

export function useUpdateVariantInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      inventory: number;
      expectedVersion: number;
    }) => {
      // Inventory is only for dropship variants
      const result = await sendCommand("updateDropshipVariantInventory", payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update variant inventory");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["productVariants"],
        refetchType: "all"
      });
      await queryClient.invalidateQueries({
        queryKey: ["variants"],
        refetchType: "all"
      });
    },
  });
}

export function useUpdateVariantSku() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      sku: string;
      expectedVersion: number;
      fulfillmentType: FulfillmentType;
    }) => {
      const commandType = getVariantCommandType("updateVariantSku", payload.fulfillmentType);
      const result = await sendCommand(commandType, payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update variant SKU");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["productVariants"],
        refetchType: "all"
      });
      await queryClient.invalidateQueries({
        queryKey: ["variants"],
        refetchType: "all"
      });
    },
  });
}

export function useArchiveVariant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      expectedVersion: number;
      fulfillmentType: FulfillmentType;
    }) => {
      const commandType = getVariantCommandType("archiveVariant", payload.fulfillmentType);
      const result = await sendCommand(commandType, payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to archive variant");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["productVariants"],
        refetchType: "all"
      });
      await queryClient.invalidateQueries({
        queryKey: ["variants"],
        refetchType: "all"
      });
    },
  });
}

export function usePublishVariant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      expectedVersion: number;
      fulfillmentType: FulfillmentType;
    }) => {
      const commandType = getVariantCommandType("publishVariant", payload.fulfillmentType);
      const result = await sendCommand(commandType, payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to publish variant");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["productVariants"],
        refetchType: "all"
      });
      await queryClient.invalidateQueries({
        queryKey: ["variants"],
        refetchType: "all"
      });
    },
  });
}

export function useAddVariantImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      imageData: string;
      filename: string;
      contentType: string;
      altText: string;
      expectedVersion: number;
      fulfillmentType: FulfillmentType;
    }) => {
      const commandType = getVariantCommandType("addVariantImage", payload.fulfillmentType);
      const result = await sendCommand(commandType, payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to add variant image");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["productVariants"],
        refetchType: "all"
      });
      await queryClient.invalidateQueries({
        queryKey: ["variants"],
        refetchType: "all"
      });
    },
  });
}

export function useRemoveVariantImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      imageId: string;
      expectedVersion: number;
      fulfillmentType: FulfillmentType;
    }) => {
      const commandType = getVariantCommandType("removeVariantImage", payload.fulfillmentType);
      const result = await sendCommand(commandType, payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to remove variant image");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["productVariants"],
        refetchType: "all"
      });
      await queryClient.invalidateQueries({
        queryKey: ["variants"],
        refetchType: "all"
      });
    },
  });
}

export function useReorderVariantImages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      orderedImageIds: string[];
      expectedVersion: number;
      fulfillmentType: FulfillmentType;
    }) => {
      const commandType = getVariantCommandType("reorderVariantImages", payload.fulfillmentType);
      const result = await sendCommand(commandType, payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to reorder variant images");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["productVariants"],
        refetchType: "all"
      });
      await queryClient.invalidateQueries({
        queryKey: ["variants"],
        refetchType: "all"
      });
    },
  });
}

export function useUpdateVariantImageAltText() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      imageId: string;
      altText: string;
      expectedVersion: number;
      fulfillmentType: FulfillmentType;
    }) => {
      const commandType = getVariantCommandType("updateVariantImageAltText", payload.fulfillmentType);
      const result = await sendCommand(commandType, payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update image alt text");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["productVariants"],
        refetchType: "all"
      });
      await queryClient.invalidateQueries({
        queryKey: ["variants"],
        refetchType: "all"
      });
    },
  });
}

export function useAttachVariantDigitalAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      assetData: string;
      filename: string;
      mimeType: string;
      expectedVersion: number;
    }) => {
      // Digital asset attachment is only for digital downloadable variants
      const result = await sendCommand("attachDigitalDownloadableVariantDigitalAsset", payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to attach digital asset");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["productVariants"],
        refetchType: "all"
      });
      await queryClient.invalidateQueries({
        queryKey: ["variants"],
        refetchType: "all"
      });
    },
  });
}

export function useDetachVariantDigitalAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      expectedVersion: number;
    }) => {
      // Digital asset detachment is only for digital downloadable variants
      const result = await sendCommand("detachDigitalDownloadableVariantDigitalAsset", payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to detach digital asset");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["productVariants"],
        refetchType: "all"
      });
      await queryClient.invalidateQueries({
        queryKey: ["variants"],
        refetchType: "all"
      });
    },
  });
}
