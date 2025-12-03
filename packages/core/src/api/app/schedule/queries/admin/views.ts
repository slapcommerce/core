export type ScheduleStatus = "pending" | "completed" | "cancelled" | "failed";

export type ScheduleView = {
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

export type SchedulesView = ScheduleView[];

export class ScheduleReadModel {
  scheduleId!: string;
  scheduleGroupId!: string | null;
  aggregateId!: string;
  aggregateType!: string;
  scheduleType!: string;
  dueAt!: string;
  status!: ScheduleStatus;
  retryCount!: number;
  nextRetryAt!: string | null;
  errorMessage!: string | null;
  metadata!: string | null;
  createdAt!: string;
  updatedAt!: string;
}
