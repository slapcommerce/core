import { Schedule, type ScheduleParams, type ScheduleStatus } from "./schedule";

export type DropType = "hidden" | "visible";

export type DropScheduleState = {
  id: string;
  scheduleGroupId: string;
  startScheduleId: string;
  status: ScheduleStatus;
  startDate: Date;
  dropType: DropType;
  createdAt: Date;
  createdBy: string;
};

export type DropScheduleParams = Omit<ScheduleParams, "endScheduleId" | "endDate"> & {
  dropType: DropType;
};

/**
 * DropSchedule is a single schedule entity for product/variant drops.
 *
 * It only has a start date (when the drop occurs). There is no end date.
 * The entity transitions directly from pending to completed when executed.
 */
export class DropSchedule extends Schedule {
  private _dropType: DropType;

  constructor(params: DropScheduleParams) {
    super({
      ...params,
      endScheduleId: null,
      endDate: null,
    });
    this._dropType = params.dropType;
    this.validate();
  }

  get dropType(): DropType {
    return this._dropType;
  }

  validate(): void {
    // Drop date validation is context-dependent
    // (new drops must be in future, but rehydrated drops might have past dates)
  }

  /**
   * Validate that the drop date is in the future (for new schedules only)
   */
  validateForCreate(): void {
    if (this._startDate <= new Date()) {
      throw new Error("Drop date must be in the future");
    }
  }

  /**
   * Update the schedule's values. Can update start date and drop type.
   */
  update(params: { startDate?: Date; dropType?: DropType }): void {
    if (!this.canBeModified()) {
      throw new Error("Cannot modify schedule in current state");
    }

    if (params.startDate !== undefined) {
      if (!this.canModifyStartDate()) {
        throw new Error("Cannot modify start date after schedule has started");
      }
      this._startDate = params.startDate;
    }

    if (params.dropType !== undefined) {
      this._dropType = params.dropType;
    }

    this.validate();
  }

  /**
   * Execute the drop. For single schedules, this activates and completes in one step.
   */
  execute(): void {
    this.activate();
    this.complete();
  }

  toState(): DropScheduleState {
    const base = this.baseState();
    return {
      id: base.id,
      scheduleGroupId: base.scheduleGroupId,
      startScheduleId: base.startScheduleId,
      status: base.status,
      startDate: base.startDate,
      dropType: this._dropType,
      createdAt: base.createdAt,
      createdBy: base.createdBy,
    };
  }

  static fromState(state: DropScheduleState): DropSchedule {
    return new DropSchedule({
      id: state.id,
      scheduleGroupId: state.scheduleGroupId,
      startScheduleId: state.startScheduleId,
      status: state.status,
      startDate: new Date(state.startDate),
      dropType: state.dropType,
      createdAt: new Date(state.createdAt),
      createdBy: state.createdBy,
    });
  }

  static create(params: {
    id: string;
    scheduleGroupId: string;
    startScheduleId: string;
    dropType: DropType;
    startDate: Date;
    createdBy: string;
  }): DropSchedule {
    const schedule = new DropSchedule({
      ...params,
      createdAt: new Date(),
    });
    schedule.validateForCreate();
    return schedule;
  }
}
