import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Types

export type ScheduleStatus = "pending" | "completed" | "cancelled" | "failed";

export type Schedule = {
  scheduleId: string;
  scheduleGroupId: string | null;
  aggregateId: string;
  aggregateType: string;
  scheduleType: string;
  dueAt: string;
  status: ScheduleStatus;
  retryCount: number;
  nextRetryAt: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
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

// Fetch functions

async function fetchSchedules(aggregateId: string): Promise<Schedule[]> {
  const response = await fetch("/admin/api/queries", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "getSchedulesByAggregateId",
      params: { aggregateId },
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

// Query hooks

export function schedulesQueryOptions(aggregateId: string) {
  return {
    queryKey: ["schedules", aggregateId],
    queryFn: () => fetchSchedules(aggregateId),
    staleTime: 0,
    gcTime: 1000 * 60,
    refetchOnMount: "always" as const,
    enabled: !!aggregateId,
  };
}

export function useSchedules(aggregateId: string) {
  return useQuery(schedulesQueryOptions(aggregateId));
}

// Helper to get command type based on fulfillment type and entity type
function getDropCommandType(
  fulfillmentType: "digital" | "dropship",
  entityType: "product" | "variant",
  action: "schedule" | "update" | "cancel"
): string {
  const typePrefix = fulfillmentType === "digital" ? "DigitalDownloadable" : "Dropship";
  const entityPrefix = entityType === "product" ? "Product" : "Variant";

  switch (action) {
    case "schedule":
      return `schedule${typePrefix}${entityPrefix}Drop`;
    case "update":
      return `updateScheduled${typePrefix}${entityPrefix}Drop`;
    case "cancel":
      return `cancelScheduled${typePrefix}${entityPrefix}Drop`;
  }
}

function getSaleCommandType(
  fulfillmentType: "digital" | "dropship",
  action: "schedule" | "update" | "cancel"
): string {
  const typePrefix = fulfillmentType === "digital" ? "DigitalDownloadable" : "Dropship";

  switch (action) {
    case "schedule":
      return `schedule${typePrefix}VariantSale`;
    case "update":
      return `updateScheduled${typePrefix}VariantSale`;
    case "cancel":
      return `cancelScheduled${typePrefix}VariantSale`;
  }
}

// Product Drop Schedule mutations

export function useScheduleProductDrop() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      correlationId: string;
      userId: string;
      fulfillmentType: "digital" | "dropship";
      dropType: "hidden" | "visible";
      scheduledFor: Date;
      expectedVersion: number;
    }) => {
      const commandType = getDropCommandType(payload.fulfillmentType, "product", "schedule");
      const result = await sendCommand(commandType, {
        id: payload.id,
        type: commandType,
        correlationId: payload.correlationId,
        userId: payload.userId,
        dropType: payload.dropType,
        scheduledFor: payload.scheduledFor.toISOString(),
        expectedVersion: payload.expectedVersion,
      });
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to schedule product drop");
      }
      return result.data;
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["schedules", variables.id],
        refetchType: "all",
      });
      await queryClient.invalidateQueries({
        queryKey: ["products"],
        refetchType: "all",
      });
    },
  });
}

export function useUpdateScheduledProductDrop() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      fulfillmentType: "digital" | "dropship";
      dropType?: "hidden" | "visible";
      scheduledFor?: Date;
      expectedVersion: number;
    }) => {
      const commandType = getDropCommandType(payload.fulfillmentType, "product", "update");
      const result = await sendCommand(commandType, {
        id: payload.id,
        type: commandType,
        userId: payload.userId,
        dropType: payload.dropType,
        scheduledFor: payload.scheduledFor?.toISOString(),
        expectedVersion: payload.expectedVersion,
      });
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update scheduled product drop");
      }
      return result.data;
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["schedules", variables.id],
        refetchType: "all",
      });
      await queryClient.invalidateQueries({
        queryKey: ["products"],
        refetchType: "all",
      });
    },
  });
}

export function useCancelScheduledProductDrop() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      fulfillmentType: "digital" | "dropship";
      expectedVersion: number;
    }) => {
      const commandType = getDropCommandType(payload.fulfillmentType, "product", "cancel");
      const result = await sendCommand(commandType, {
        id: payload.id,
        type: commandType,
        userId: payload.userId,
        expectedVersion: payload.expectedVersion,
      });
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to cancel scheduled product drop");
      }
      return result.data;
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["schedules", variables.id],
        refetchType: "all",
      });
      await queryClient.invalidateQueries({
        queryKey: ["products"],
        refetchType: "all",
      });
    },
  });
}

// Variant Drop Schedule mutations

export function useScheduleVariantDrop() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      correlationId: string;
      userId: string;
      fulfillmentType: "digital" | "dropship";
      dropType: "hidden" | "visible";
      scheduledFor: Date;
      expectedVersion: number;
    }) => {
      const commandType = getDropCommandType(payload.fulfillmentType, "variant", "schedule");
      const result = await sendCommand(commandType, {
        id: payload.id,
        type: commandType,
        correlationId: payload.correlationId,
        userId: payload.userId,
        dropType: payload.dropType,
        scheduledFor: payload.scheduledFor.toISOString(),
        expectedVersion: payload.expectedVersion,
      });
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to schedule variant drop");
      }
      return result.data;
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["schedules", variables.id],
        refetchType: "all",
      });
      await queryClient.invalidateQueries({
        queryKey: ["variants"],
        refetchType: "all",
      });
    },
  });
}

export function useUpdateScheduledVariantDrop() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      fulfillmentType: "digital" | "dropship";
      dropType?: "hidden" | "visible";
      scheduledFor?: Date;
      expectedVersion: number;
    }) => {
      const commandType = getDropCommandType(payload.fulfillmentType, "variant", "update");
      const result = await sendCommand(commandType, {
        id: payload.id,
        type: commandType,
        userId: payload.userId,
        dropType: payload.dropType,
        scheduledFor: payload.scheduledFor?.toISOString(),
        expectedVersion: payload.expectedVersion,
      });
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update scheduled variant drop");
      }
      return result.data;
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["schedules", variables.id],
        refetchType: "all",
      });
      await queryClient.invalidateQueries({
        queryKey: ["variants"],
        refetchType: "all",
      });
    },
  });
}

export function useCancelScheduledVariantDrop() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      fulfillmentType: "digital" | "dropship";
      expectedVersion: number;
    }) => {
      const commandType = getDropCommandType(payload.fulfillmentType, "variant", "cancel");
      const result = await sendCommand(commandType, {
        id: payload.id,
        type: commandType,
        userId: payload.userId,
        expectedVersion: payload.expectedVersion,
      });
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to cancel scheduled variant drop");
      }
      return result.data;
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["schedules", variables.id],
        refetchType: "all",
      });
      await queryClient.invalidateQueries({
        queryKey: ["variants"],
        refetchType: "all",
      });
    },
  });
}

// Variant Sale Schedule mutations (variants only - products don't have sales)

export function useScheduleVariantSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      correlationId: string;
      userId: string;
      fulfillmentType: "digital" | "dropship";
      saleType: "fixed" | "percent" | "amount";
      saleValue: number;
      startDate: Date;
      endDate: Date;
      expectedVersion: number;
    }) => {
      const commandType = getSaleCommandType(payload.fulfillmentType, "schedule");
      const result = await sendCommand(commandType, {
        id: payload.id,
        type: commandType,
        correlationId: payload.correlationId,
        userId: payload.userId,
        saleType: payload.saleType,
        saleValue: payload.saleValue,
        startDate: payload.startDate.toISOString(),
        endDate: payload.endDate.toISOString(),
        expectedVersion: payload.expectedVersion,
      });
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to schedule variant sale");
      }
      return result.data;
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["schedules", variables.id],
        refetchType: "all",
      });
      await queryClient.invalidateQueries({
        queryKey: ["variants"],
        refetchType: "all",
      });
    },
  });
}

export function useUpdateScheduledVariantSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      fulfillmentType: "digital" | "dropship";
      saleType?: "fixed" | "percent" | "amount";
      saleValue?: number;
      startDate?: Date;
      endDate?: Date;
      expectedVersion: number;
    }) => {
      const commandType = getSaleCommandType(payload.fulfillmentType, "update");
      const result = await sendCommand(commandType, {
        id: payload.id,
        type: commandType,
        userId: payload.userId,
        saleType: payload.saleType,
        saleValue: payload.saleValue,
        startDate: payload.startDate?.toISOString(),
        endDate: payload.endDate?.toISOString(),
        expectedVersion: payload.expectedVersion,
      });
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update scheduled variant sale");
      }
      return result.data;
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["schedules", variables.id],
        refetchType: "all",
      });
      await queryClient.invalidateQueries({
        queryKey: ["variants"],
        refetchType: "all",
      });
    },
  });
}

export function useCancelScheduledVariantSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      fulfillmentType: "digital" | "dropship";
      expectedVersion: number;
    }) => {
      const commandType = getSaleCommandType(payload.fulfillmentType, "cancel");
      const result = await sendCommand(commandType, {
        id: payload.id,
        type: commandType,
        userId: payload.userId,
        expectedVersion: payload.expectedVersion,
      });
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to cancel scheduled variant sale");
      }
      return result.data;
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["schedules", variables.id],
        refetchType: "all",
      });
      await queryClient.invalidateQueries({
        queryKey: ["variants"],
        refetchType: "all",
      });
    },
  });
}
