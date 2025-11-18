import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import type { CollectionsViewParams } from "@/views/collectionsView";
import type { ImageItem } from "@/domain/_base/imageCollection";

export type Collection = {
  aggregate_id: string;
  collection_id: string;
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
  meta_title: string;
  meta_description: string;
  published_at: string | null;
  images: ImageItem[];
};

type QueryResponse = {
  success: boolean;
  data?: Collection[];
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

async function fetchCollections(
  params?: CollectionsViewParams
): Promise<Collection[]> {
  const response = await fetch("/admin/api/queries", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "collectionsView",
      params: params || {},
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch collections: ${response.statusText}`);
  }

  const result = (await response.json()) as QueryResponse;

  if (!result.success || !result.data) {
    throw new Error(result.error?.message || "Failed to fetch collections");
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

export function useCollections(params?: CollectionsViewParams) {
  // Normalize params to ensure stable query key
  const normalizedParams = params
    ? {
        collectionId: params.collectionId,
        status: params.status,
        limit: params.limit,
        offset: params.offset,
      }
    : undefined;

  return useQuery({
    queryKey: ["collections", normalizedParams],
    queryFn: () => fetchCollections(params),
    staleTime: 0, // Always consider stale to ensure fresh data
    gcTime: 1000 * 60, // Keep in cache for 1 minute
    refetchOnMount: "always", // Always refetch on mount
    networkMode: "always", // Always use network, never serve stale cache
    placeholderData: keepPreviousData, // Show previous data during refetch
  });
}

export function useCreateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      correlationId: string;
      name: string;
      description: string | null;
      slug: string;
    }) => {
      const result = await sendCommand("createCollection", payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to create collection");
      }
      return result.data;
    },
    onSuccess: async () => {
      // Invalidate and refetch to ensure fresh data
      await queryClient.invalidateQueries({ 
        queryKey: ["collections"],
        refetchType: "all"
      });
    },
  });
}

export function useUpdateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      name: string;
      description: string | null;
      newSlug: string;
      expectedVersion: number;
    }) => {
      const result = await sendCommand("updateCollectionMetadata", payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update collection");
      }
      return result.data;
    },
    onSuccess: async (_, variables) => {
      // Invalidate and refetch collections to ensure fresh version numbers
      await queryClient.invalidateQueries({ 
        queryKey: ["collections"],
        refetchType: "all"
      });
      // Invalidate slug redirect chain query for this collection
      await queryClient.invalidateQueries({ 
        queryKey: ["slugRedirectChain", variables.id, "collection"],
        refetchType: "all"
      });
    },
  });
}

export function useArchiveCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      expectedVersion: number;
    }) => {
      const result = await sendCommand("archiveCollection", payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to archive collection");
      }
      return result.data;
    },
    onSuccess: async () => {
      // Invalidate and refetch to ensure fresh data
      await queryClient.invalidateQueries({ 
        queryKey: ["collections"],
        refetchType: "all"
      });
    },
  });
}

export function usePublishCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      expectedVersion: number;
    }) => {
      const result = await sendCommand("publishCollection", payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to publish collection");
      }
      return result.data;
    },
    onSuccess: async () => {
      // Invalidate and refetch to ensure fresh data
      await queryClient.invalidateQueries({ 
        queryKey: ["collections"],
        refetchType: "all"
      });
    },
  });
}

export function useUnpublishCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      expectedVersion: number;
    }) => {
      const result = await sendCommand("unpublishCollection", payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to unpublish collection");
      }
      return result.data;
    },
    onSuccess: async () => {
      // Invalidate and refetch to ensure fresh data
      await queryClient.invalidateQueries({ 
        queryKey: ["collections"],
        refetchType: "all"
      });
    },
  });
}

export function useUpdateCollectionSeoMetadata() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      metaTitle: string;
      metaDescription: string;
      expectedVersion: number;
    }) => {
      const result = await sendCommand("updateCollectionSeoMetadata", payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update SEO metadata");
      }
      return result.data;
    },
    onSuccess: async () => {
      // Invalidate and refetch to ensure fresh data
      await queryClient.invalidateQueries({ 
        queryKey: ["collections"],
        refetchType: "all"
      });
    },
  });
}

export function useAddCollectionImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      imageData: string;
      filename: string;
      contentType: string;
      altText: string;
      expectedVersion: number;
    }) => {
      const result = await sendCommand("addCollectionImage", payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to add collection image");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["collections"],
        refetchType: "all"
      });
    },
  });
}

export function useRemoveCollectionImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      imageId: string;
      expectedVersion: number;
    }) => {
      const result = await sendCommand("removeCollectionImage", payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to remove collection image");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["collections"],
        refetchType: "all"
      });
    },
  });
}

export function useReorderCollectionImages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      orderedImageIds: string[];
      expectedVersion: number;
    }) => {
      const result = await sendCommand("reorderCollectionImages", payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to reorder collection images");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["collections"],
        refetchType: "all"
      });
    },
  });
}

export function useUpdateCollectionImageAltText() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      imageId: string;
      altText: string;
      expectedVersion: number;
    }) => {
      const result = await sendCommand("updateCollectionImageAltText", payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update image alt text");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["collections"],
        refetchType: "all"
      });
    },
  });
}

export type SlugRedirect = {
  slug: string;
  created_at: string;
};

async function fetchSlugRedirectChain(
  entityId: string,
  entityType: 'product' | 'collection'
): Promise<SlugRedirect[]> {
  const response = await fetch("/admin/api/queries", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "slugRedirectChain",
      params: { entityId, entityType },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch slug redirect chain: ${response.statusText}`);
  }

  const result = (await response.json()) as QueryResponse;

  if (!result.success || !result.data) {
    throw new Error(result.error?.message || "Failed to fetch slug redirect chain");
  }

  return result.data as SlugRedirect[];
}

export function useSlugRedirectChain(
  entityId: string | undefined,
  entityType: 'product' | 'collection'
) {
  return useQuery({
    queryKey: ["slugRedirectChain", entityId, entityType],
    queryFn: () => fetchSlugRedirectChain(entityId!, entityType),
    enabled: !!entityId,
    staleTime: 0, // Always consider stale to ensure fresh data
    gcTime: 1000 * 60, // Keep in cache for 1 minute
    refetchOnMount: "always", // Always refetch on mount
    networkMode: "always", // Always use network, never serve stale cache
    placeholderData: keepPreviousData, // Show previous data during refetch
  });
}

