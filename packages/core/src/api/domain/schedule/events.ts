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



type ScheduleCreatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ScheduleState;
  newState: ScheduleState;
};

export class ScheduleCreatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "schedule.created" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<ScheduleState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: ScheduleCreatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}


type ScheduleUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ScheduleState;
  newState: ScheduleState;
};

export class ScheduleUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "schedule.updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<ScheduleState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: ScheduleUpdatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}


type ScheduleExecutedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ScheduleState;
  newState: ScheduleState;
};

export class ScheduleExecutedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "schedule.executed" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<ScheduleState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: ScheduleExecutedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}


type ScheduleFailedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ScheduleState;
  newState: ScheduleState;
};

export class ScheduleFailedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "schedule.failed" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<ScheduleState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: ScheduleFailedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}


type ScheduleCancelledEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ScheduleState;
  newState: ScheduleState;
};

export class ScheduleCancelledEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "schedule.cancelled" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<ScheduleState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: ScheduleCancelledEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

/**
 * Union of all schedule events
 */
export type ScheduleEvent =
  | ScheduleCreatedEvent
  | ScheduleUpdatedEvent
  | ScheduleExecutedEvent
  | ScheduleFailedEvent
  | ScheduleCancelledEvent;
