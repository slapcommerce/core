import { z } from "zod";

export const GetSchedulesQuery = z.object({
  status: z.enum(["pending", "executed", "failed", "cancelled"]).optional(),
  targetAggregateId: z.string().optional(),
  targetAggregateType: z.string().optional(),
  commandType: z.string().optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});

export type GetSchedulesQuery = z.infer<typeof GetSchedulesQuery>;

export const GetScheduleQuery = z.object({
  scheduleId: z.string(),
});

export type GetScheduleQuery = z.infer<typeof GetScheduleQuery>;
