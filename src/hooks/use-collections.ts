import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CollectionsViewParams } from "@/views/collectionsView";

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
  return useQuery({
    queryKey: ["collections", params],
    queryFn: () => fetchCollections(params),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      // Invalidate slug redirect chain query for this collection
      queryClient.invalidateQueries({ 
        queryKey: ["slugRedirectChain", variables.id, "collection"] 
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
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
  });
}

