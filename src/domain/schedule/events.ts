import type { DomainEvent, StateBasedPayload } from "../_base/domainEvent";

export type ScheduleState = {
  targetAggregateId: string;
  targetAggregateType: string;
  commandType: string;
  commandData: Record<string, unknown> | null;
  scheduledFor: Date;
  status: "pending" | "executed" | "failed" | "cancelled";
  retryCount: number;
  nextRetryAt: Date | null;
  createdBy: string;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
};

export type ScheduleEventPayload = StateBasedPayload<ScheduleState>;

type ScheduleCreatedEventType = DomainEvent<
  "schedule.created",
  ScheduleEventPayload
>;

type ScheduleCreatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  priorState: ScheduleState;
  newState: ScheduleState;
};

export class ScheduleCreatedEvent implements ScheduleCreatedEventType {
  occurredAt: Date;
  eventName = "schedule.created" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  payload: ScheduleEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    priorState,
    newState,
  }: ScheduleCreatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.payload = { priorState, newState };
  }
}

type ScheduleUpdatedEventType = DomainEvent<
  "schedule.updated",
  ScheduleEventPayload
>;

type ScheduleUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  priorState: ScheduleState;
  newState: ScheduleState;
};

export class ScheduleUpdatedEvent implements ScheduleUpdatedEventType {
  occurredAt: Date;
  eventName = "schedule.updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  payload: ScheduleEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    priorState,
    newState,
  }: ScheduleUpdatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.payload = { priorState, newState };
  }
}

type ScheduleExecutedEventType = DomainEvent<
  "schedule.executed",
  ScheduleEventPayload
>;

type ScheduleExecutedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  priorState: ScheduleState;
  newState: ScheduleState;
};

export class ScheduleExecutedEvent implements ScheduleExecutedEventType {
  occurredAt: Date;
  eventName = "schedule.executed" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  payload: ScheduleEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    priorState,
    newState,
  }: ScheduleExecutedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.payload = { priorState, newState };
  }
}

type ScheduleFailedEventType = DomainEvent<
  "schedule.failed",
  ScheduleEventPayload
>;

type ScheduleFailedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  priorState: ScheduleState;
  newState: ScheduleState;
};

export class ScheduleFailedEvent implements ScheduleFailedEventType {
  occurredAt: Date;
  eventName = "schedule.failed" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  payload: ScheduleEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    priorState,
    newState,
  }: ScheduleFailedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.payload = { priorState, newState };
  }
}

type ScheduleCancelledEventType = DomainEvent<
  "schedule.cancelled",
  ScheduleEventPayload
>;

type ScheduleCancelledEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  priorState: ScheduleState;
  newState: ScheduleState;
};

export class ScheduleCancelledEvent implements ScheduleCancelledEventType {
  occurredAt: Date;
  eventName = "schedule.cancelled" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  payload: ScheduleEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    priorState,
    newState,
  }: ScheduleCancelledEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.payload = { priorState, newState };
  }
}
