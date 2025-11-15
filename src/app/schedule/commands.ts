import { z } from "zod";

export const CreateScheduleCommand = z.object({
  id: z.string().uuidv7(),
  correlationId: z.string().uuidv7(),
  targetAggregateId: z.string().uuidv7(),
  targetAggregateType: z.string().min(1),
  commandType: z.string().min(1),
  commandData: z.record(z.string(), z.unknown()).nullable(),
  scheduledFor: z.coerce.date(),
  createdBy: z.string().min(1),
});

export type CreateScheduleCommand = z.infer<typeof CreateScheduleCommand>;

export const UpdateScheduleCommand = z.object({
  id: z.string().uuidv7(),
  scheduledFor: z.coerce.date(),
  commandData: z.record(z.string(), z.unknown()).nullable(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateScheduleCommand = z.infer<typeof UpdateScheduleCommand>;

export const CancelScheduleCommand = z.object({
  id: z.string().uuidv7(),
  expectedVersion: z.number().int().nonnegative(),
});

export type CancelScheduleCommand = z.infer<typeof CancelScheduleCommand>;

export const ListSchedulesQuery = z.object({
  status: z.enum(["pending", "executed", "failed", "cancelled"]).optional(),
  targetAggregateId: z.string().uuidv7().optional(),
  targetAggregateType: z.string().optional(),
  commandType: z.string().optional(),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
});

export type ListSchedulesQuery = z.infer<typeof ListSchedulesQuery>;
