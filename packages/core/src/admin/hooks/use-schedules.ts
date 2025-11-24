import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import type { GetSchedulesQuery } from "@/api/views/schedule/queries";

export type Schedule = {
  aggregate_id: string;
  schedule_id: string;
  target_aggregate_id: string;
  target_aggregate_type: string;
  command_type: string;
  command_data: Record<string, unknown> | null;
  scheduled_for: string;
  status: "pending" | "executed" | "failed" | "cancelled";
  retry_count: number;
  next_retry_at: string | null;
  created_by: string;
  error_message: string | null;
  correlation_id: string;
  version: number;
  created_at: string;
  updated_at: string;
};

type QueryResponse = {
  success: boolean;
  data?: Schedule[];
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

async function fetchSchedules(
  params?: GetSchedulesQuery
): Promise<Schedule[]> {
  const response = await fetch("/admin/api/queries", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "schedulesView",
      params: params || {},
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch schedules: ${response.statusText}`);
  }

  const result = (await response.json()) as QueryResponse;

  if (!result.success || !result.data) {
    throw new Error(result.error?.message || "Failed to fetch schedules");
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

/**
 * Fetch schedules for a specific collection
 */
export function useCollectionSchedules(collectionId: string | undefined) {
  return useQuery({
    queryKey: ["schedules", "collection", collectionId],
    queryFn: () =>
      fetchSchedules({
        targetAggregateId: collectionId,
        targetAggregateType: "collection",
        status: "pending",
        limit: 50,
        offset: 0,
      }),
    enabled: !!collectionId,
    staleTime: 0,
    gcTime: 1000 * 60,
    refetchOnMount: "always",
    networkMode: "always",
    placeholderData: keepPreviousData,
  });
}

/**
 * Fetch schedules for a specific product
 */
export function useProductSchedules(productId: string | undefined) {
  return useQuery({
    queryKey: ["schedules", "product", productId],
    queryFn: () =>
      fetchSchedules({
        targetAggregateId: productId,
        targetAggregateType: "product",
        status: "pending",
        limit: 50,
        offset: 0,
      }),
    enabled: !!productId,
    staleTime: 0,
    gcTime: 1000 * 60,
    refetchOnMount: "always",
    networkMode: "always",
    placeholderData: keepPreviousData,
  });
}

/**
 * Fetch all schedules across all collections/products
 */
export function useAllSchedules(params?: GetSchedulesQuery) {
  const normalizedParams = params
    ? {
        status: params.status,
        targetAggregateType: params.targetAggregateType,
        commandType: params.commandType,
        limit: params.limit,
        offset: params.offset,
      }
    : undefined;

  return useQuery({
    queryKey: ["schedules", "all", normalizedParams],
    queryFn: () => fetchSchedules(params),
    staleTime: 0,
    gcTime: 1000 * 60,
    refetchOnMount: "always",
    networkMode: "always",
    placeholderData: keepPreviousData,
  });
}

/**
 * Create a new schedule
 */
export function useCreateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      correlationId: string;
      targetAggregateId: string;
      targetAggregateType: string;
      commandType: string;
      commandData: Record<string, unknown> | null;
      scheduledFor: Date;
      createdBy: string;
    }) => {
      const result = await sendCommand("createSchedule", payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to create schedule");
      }
      return result.data;
    },
    onSuccess: async (_, variables) => {
      // Invalidate schedules for the specific aggregate
      await queryClient.invalidateQueries({
        queryKey: ["schedules", variables.targetAggregateType, variables.targetAggregateId],
        refetchType: "all",
      });
      // Invalidate all schedules view
      await queryClient.invalidateQueries({
        queryKey: ["schedules", "all"],
        refetchType: "all",
      });
      // Invalidate collections/products to update any schedule badges
      await queryClient.invalidateQueries({
        queryKey: ["collections"],
        refetchType: "all",
      });
      await queryClient.invalidateQueries({
        queryKey: ["products"],
        refetchType: "all",
      });
    },
  });
}

/**
 * Update an existing pending schedule
 */
export function useUpdateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      scheduledFor: Date;
      commandData: Record<string, unknown> | null;
      expectedVersion: number;
    }) => {
      const result = await sendCommand("updateSchedule", payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update schedule");
      }
      return result.data;
    },
    onSuccess: async () => {
      // Invalidate all schedule queries
      await queryClient.invalidateQueries({
        queryKey: ["schedules"],
        refetchType: "all",
      });
    },
  });
}

/**
 * Cancel a pending schedule
 */
export function useCancelSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      expectedVersion: number;
    }) => {
      const result = await sendCommand("cancelSchedule", payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to cancel schedule");
      }
      return result.data;
    },
    onSuccess: async () => {
      // Invalidate all schedule queries
      await queryClient.invalidateQueries({
        queryKey: ["schedules"],
        refetchType: "all",
      });
      // Invalidate collections/products to update schedule badges
      await queryClient.invalidateQueries({
        queryKey: ["collections"],
        refetchType: "all",
      });
      await queryClient.invalidateQueries({
        queryKey: ["products"],
        refetchType: "all",
      });
    },
  });
}
