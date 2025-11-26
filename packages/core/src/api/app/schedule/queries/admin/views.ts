export class ScheduleReadModel {
  declare aggregateId: string;
  declare correlationId: string;
  declare version: number;
  declare targetAggregateId: string;
  declare targetAggregateType: string;
  declare commandType: string;
  declare commandData: string | null;
  declare scheduledFor: string;
  declare status: "pending" | "executed" | "failed" | "cancelled";
  declare retryCount: number;
  declare nextRetryAt: string | null;
  declare createdBy: string;
  declare errorMessage: string | null;
  declare createdAt: string;
  declare updatedAt: string;
}

export type ScheduleView = ScheduleReadModel | null;
export type SchedulesView = ScheduleReadModel[];
