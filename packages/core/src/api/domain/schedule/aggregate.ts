import {
  ScheduleCreatedEvent,
  ScheduleUpdatedEvent,
  ScheduleExecutedEvent,
  ScheduleFailedEvent,
  ScheduleCancelledEvent,
  type ScheduleState,
  type ScheduleEvent,
} from "./events";

type ScheduleAggregateParams = {
  id: string;
  correlationId: string;
  createdAt: Date;
  updatedAt: Date;
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
  version: number;
  events: ScheduleEvent[];
};

type CreateScheduleAggregateParams = {
  id: string;
  correlationId: string;
  userId: string;
  targetAggregateId: string;
  targetAggregateType: string;
  commandType: string;
  commandData: Record<string, unknown> | null;
  scheduledFor: Date;
  createdBy: string;
};

export class ScheduleAggregate {
  public id: string;
  public version: number = 0;
  public events: ScheduleEvent[];
  public uncommittedEvents: ScheduleEvent[] = [];
  private correlationId: string;
  private createdAt: Date;
  private updatedAt: Date;
  private targetAggregateId: string;
  private targetAggregateType: string;
  private commandType: string;
  private commandData: Record<string, unknown> | null;
  private scheduledFor: Date;
  private status: "pending" | "executed" | "failed" | "cancelled";
  private retryCount: number;
  private nextRetryAt: Date | null;
  private createdBy: string;
  private errorMessage: string | null;

  constructor({
    id,
    correlationId,
    createdAt,
    updatedAt,
    targetAggregateId,
    targetAggregateType,
    commandType,
    commandData,
    scheduledFor,
    status,
    retryCount,
    nextRetryAt,
    createdBy,
    errorMessage,
    version = 0,
    events,
  }: ScheduleAggregateParams) {
    this.id = id;
    this.correlationId = correlationId;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.targetAggregateId = targetAggregateId;
    this.targetAggregateType = targetAggregateType;
    this.commandType = commandType;
    this.commandData = commandData;
    this.scheduledFor = scheduledFor;
    this.status = status;
    this.retryCount = retryCount;
    this.nextRetryAt = nextRetryAt;
    this.createdBy = createdBy;
    this.errorMessage = errorMessage;
    this.version = version;
    this.events = events;
  }

  static create({
    id,
    correlationId,
    userId,
    targetAggregateId,
    targetAggregateType,
    commandType,
    commandData,
    scheduledFor,
    createdBy,
  }: CreateScheduleAggregateParams) {
    const createdAt = new Date();
    const scheduleAggregate = new ScheduleAggregate({
      id,
      correlationId,
      createdAt,
      updatedAt: createdAt,
      targetAggregateId,
      targetAggregateType,
      commandType,
      commandData,
      scheduledFor,
      status: "pending",
      retryCount: 0,
      nextRetryAt: null,
      createdBy,
      errorMessage: null,
      version: 0,
      events: [],
    });
    const priorState = {} as ScheduleState;
    const newState = scheduleAggregate.toState();
    const scheduleCreatedEvent = new ScheduleCreatedEvent({
      occurredAt: createdAt,
      correlationId,
      aggregateId: id,
      version: 0,
      userId,
      priorState,
      newState,
    });
    scheduleAggregate.uncommittedEvents.push(scheduleCreatedEvent);
    return scheduleAggregate;
  }

  private toState(): ScheduleState {
    return {
      targetAggregateId: this.targetAggregateId,
      targetAggregateType: this.targetAggregateType,
      commandType: this.commandType,
      commandData: this.commandData,
      scheduledFor: this.scheduledFor,
      status: this.status,
      retryCount: this.retryCount,
      nextRetryAt: this.nextRetryAt,
      createdBy: this.createdBy,
      errorMessage: this.errorMessage,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  update(scheduledFor: Date, commandData: Record<string, unknown> | null, userId: string) {
    if (this.status !== "pending") {
      throw new Error(
        `Cannot update schedule with status ${this.status}. Only pending schedules can be updated.`,
      );
    }
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.scheduledFor = scheduledFor;
    this.commandData = commandData;
    this.updatedAt = occurredAt;
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const updatedEvent = new ScheduleUpdatedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(updatedEvent);
    return this;
  }

  cancel(userId: string) {
    if (this.status === "executed") {
      throw new Error("Cannot cancel an already executed schedule");
    }
    if (this.status === "cancelled") {
      throw new Error("Schedule is already cancelled");
    }
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.status = "cancelled";
    this.updatedAt = occurredAt;
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const cancelledEvent = new ScheduleCancelledEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(cancelledEvent);
    return this;
  }

  markExecuted(userId: string) {
    if (this.status !== "pending") {
      throw new Error(
        `Cannot mark schedule as executed. Current status: ${this.status}`,
      );
    }
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.status = "executed";
    this.updatedAt = occurredAt;
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const executedEvent = new ScheduleExecutedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(executedEvent);
    return this;
  }

  markFailed(errorMessage: string, userId: string, maxRetries = 5) {
    if (this.status !== "pending") {
      throw new Error(
        `Cannot mark schedule as failed. Current status: ${this.status}`,
      );
    }
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.retryCount++;
    this.errorMessage = errorMessage;

    // Calculate next retry time using exponential backoff (2^n minutes)
    if (this.retryCount < maxRetries) {
      const backoffMinutes = Math.pow(2, this.retryCount);
      this.nextRetryAt = new Date(
        occurredAt.getTime() + backoffMinutes * 60 * 1000,
      );
      // Keep status as pending for retry
      this.status = "pending";
    } else {
      // Max retries reached, mark as permanently failed
      this.status = "failed";
      this.nextRetryAt = null;
    }

    this.updatedAt = occurredAt;
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const failedEvent = new ScheduleFailedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(failedEvent);
    return this;
  }

  static loadFromSnapshot(snapshot: {
    aggregate_id: string;
    correlation_id: string;
    version: number;
    payload: string;
  }) {
    const payload = JSON.parse(snapshot.payload);
    return new ScheduleAggregate({
      id: snapshot.aggregate_id,
      correlationId: snapshot.correlation_id,
      createdAt: new Date(payload.createdAt),
      updatedAt: new Date(payload.updatedAt),
      targetAggregateId: payload.targetAggregateId,
      targetAggregateType: payload.targetAggregateType,
      commandType: payload.commandType,
      commandData: payload.commandData,
      scheduledFor: new Date(payload.scheduledFor),
      status: payload.status,
      retryCount: payload.retryCount,
      nextRetryAt: payload.nextRetryAt ? new Date(payload.nextRetryAt) : null,
      createdBy: payload.createdBy,
      errorMessage: payload.errorMessage,
      version: snapshot.version,
      events: [],
    });
  }

  toSnapshot() {
    return {
      id: this.id,
      targetAggregateId: this.targetAggregateId,
      targetAggregateType: this.targetAggregateType,
      commandType: this.commandType,
      commandData: this.commandData,
      scheduledFor: this.scheduledFor,
      status: this.status,
      retryCount: this.retryCount,
      nextRetryAt: this.nextRetryAt,
      createdBy: this.createdBy,
      errorMessage: this.errorMessage,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      version: this.version,
    };
  }

  // Getters for accessing private properties
  getTargetAggregateId() {
    return this.targetAggregateId;
  }

  getTargetAggregateType() {
    return this.targetAggregateType;
  }

  getCommandType() {
    return this.commandType;
  }

  getCommandData() {
    return this.commandData;
  }

  getScheduledFor() {
    return this.scheduledFor;
  }

  getStatus() {
    return this.status;
  }

  getRetryCount() {
    return this.retryCount;
  }

  getNextRetryAt() {
    return this.nextRetryAt;
  }

  getCreatedBy() {
    return this.createdBy;
  }

  getErrorMessage() {
    return this.errorMessage;
  }
}
