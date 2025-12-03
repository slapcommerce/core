export type ScheduleStatus = "pending" | "active" | "completed" | "cancelled";

export type ScheduleState = {
  id: string;
  scheduleGroupId: string;
  startScheduleId: string;
  endScheduleId: string | null;
  status: ScheduleStatus;
  startDate: Date;
  endDate: Date | null;
  createdAt: Date;
  createdBy: string;
};

export type ScheduleParams = {
  id: string;
  scheduleGroupId: string;
  startScheduleId: string;
  endScheduleId: string | null;
  status?: ScheduleStatus;
  startDate: Date;
  endDate: Date | null;
  createdAt: Date;
  createdBy: string;
};

/**
 * Abstract base class for schedule entities.
 *
 * Schedules are child entities owned by aggregates (like Variants or Products).
 * They encapsulate scheduling behavior and state transitions.
 *
 * All schedules have:
 * - startDate: When the first action triggers
 * - endDate (nullable): When the second action triggers (for paired schedules)
 *
 * Paired schedules (like sales) have both start and end dates.
 * Single schedules (like drops) only have a start date.
 */
export abstract class Schedule {
  readonly id: string;
  readonly scheduleGroupId: string;
  readonly startScheduleId: string;
  readonly endScheduleId: string | null;

  protected _status: ScheduleStatus;
  protected _startDate: Date;
  protected _endDate: Date | null;
  readonly createdAt: Date;
  readonly createdBy: string;

  constructor(params: ScheduleParams) {
    this.id = params.id;
    this.scheduleGroupId = params.scheduleGroupId;
    this.startScheduleId = params.startScheduleId;
    this.endScheduleId = params.endScheduleId;
    this._status = params.status ?? "pending";
    this._startDate = params.startDate;
    this._endDate = params.endDate;
    this.createdAt = params.createdAt;
    this.createdBy = params.createdBy;
  }

  get status(): ScheduleStatus {
    return this._status;
  }

  get startDate(): Date {
    return this._startDate;
  }

  get endDate(): Date | null {
    return this._endDate;
  }

  get isPaired(): boolean {
    return this._endDate !== null;
  }

  /**
   * Whether this schedule can be modified (update dates, values, etc.)
   */
  canBeModified(): boolean {
    return this._status === "pending" || this._status === "active";
  }

  /**
   * Whether the start date can be modified (only when pending)
   */
  canModifyStartDate(): boolean {
    return this._status === "pending";
  }

  /**
   * Validate the schedule's current state.
   * Subclasses should implement type-specific validation.
   */
  abstract validate(): void;

  /**
   * Serialize the schedule to a plain object for snapshots/events.
   */
  abstract toState(): Record<string, unknown>;

  /**
   * Transition from pending to active (start execution triggered)
   */
  activate(): void {
    if (this._status !== "pending") {
      throw new Error("Can only activate a pending schedule");
    }
    this._status = "active";
  }

  /**
   * Transition from active to completed (end execution triggered or single schedule done)
   */
  complete(): void {
    if (this._status !== "active") {
      throw new Error("Can only complete an active schedule");
    }
    this._status = "completed";
  }

  /**
   * Cancel the schedule. Can cancel pending or active schedules, but not completed ones.
   */
  cancel(): void {
    if (this._status === "completed") {
      throw new Error("Cannot cancel a completed schedule");
    }
    this._status = "cancelled";
  }

  protected baseState(): ScheduleState {
    return {
      id: this.id,
      scheduleGroupId: this.scheduleGroupId,
      startScheduleId: this.startScheduleId,
      endScheduleId: this.endScheduleId,
      status: this._status,
      startDate: this._startDate,
      endDate: this._endDate,
      createdAt: this.createdAt,
      createdBy: this.createdBy,
    };
  }
}
