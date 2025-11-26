import { z } from "zod";

export const CreateScheduleCommand = z.object({
  id: z.string().uuidv7(),
  type: z.literal("createSchedule"),
  correlationId: z.string().uuidv7(),
  userId: z.string(),
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
  type: z.literal("updateSchedule"),
  userId: z.string(),
  scheduledFor: z.coerce.date(),
  commandData: z.record(z.string(), z.unknown()).nullable(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateScheduleCommand = z.infer<typeof UpdateScheduleCommand>;

export const CancelScheduleCommand = z.object({
  id: z.string().uuidv7(),
  type: z.literal("cancelSchedule"),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type CancelScheduleCommand = z.infer<typeof CancelScheduleCommand>;
