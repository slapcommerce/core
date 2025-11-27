export class ScheduleReadModel {
  aggregateId!: string;
  correlationId!: string;
  version!: number;
  targetAggregateId!: string;
  targetAggregateType!: string;
  commandType!: string;
  commandData!: string | null;
  scheduledFor!: string;
  status!: "pending" | "executed" | "failed" | "cancelled";
  retryCount!: number;
  nextRetryAt!: string | null;
  createdBy!: string;
  errorMessage!: string | null;
  createdAt!: string;
  updatedAt!: string;

  constructor() {}
}

export type ScheduleView = ScheduleReadModel | null;
export type SchedulesView = ScheduleReadModel[];
