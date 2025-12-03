import { z } from "zod";

export const GetSchedulesByAggregateIdQuery = z.object({
  aggregateId: z.string(),
  status: z.enum(["pending", "completed", "cancelled", "failed"]).optional(),
});

export type GetSchedulesByAggregateIdQuery = z.infer<typeof GetSchedulesByAggregateIdQuery>;
