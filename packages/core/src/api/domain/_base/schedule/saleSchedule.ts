import { Schedule, type ScheduleParams, type ScheduleStatus } from "./schedule";
import type { SaleType } from "../../variant/aggregate";

export type SaleScheduleState = {
  id: string;
  scheduleGroupId: string;
  startScheduleId: string;
  endScheduleId: string;
  status: ScheduleStatus;
  startDate: Date;
  endDate: Date;
  saleType: SaleType;
  saleValue: number;
  createdAt: Date;
  createdBy: string;
};

export type SaleScheduleParams = Omit<ScheduleParams, "endScheduleId" | "endDate"> & {
  endScheduleId: string;
  endDate: Date;
  saleType: SaleType;
  saleValue: number;
};

export type SaleScheduleUpdateParams = {
  startDate?: Date;
  endDate?: Date;
  saleType?: SaleType;
  saleValue?: number;
};

/**
 * SaleSchedule is a paired schedule entity for variant sales.
 *
 * It has both a start date (when sale begins) and end date (when sale ends).
 * The entity enforces validation rules for sale values and date ranges.
 */
export class SaleSchedule extends Schedule {
  private _saleType: SaleType;
  private _saleValue: number;

  constructor(params: SaleScheduleParams) {
    super({
      ...params,
      endScheduleId: params.endScheduleId,
      endDate: params.endDate,
    });
    this._saleType = params.saleType;
    this._saleValue = params.saleValue;
    this.validate();
  }

  get saleType(): SaleType {
    return this._saleType;
  }

  get saleValue(): number {
    return this._saleValue;
  }

  validate(): void {
    if (!this._endDate) {
      throw new Error("SaleSchedule requires an endDate");
    }
    if (this._endDate <= this._startDate) {
      throw new Error("End date must be after start date");
    }
    this.validateSaleValue();
  }

  private validateSaleValue(): void {
    if (this._saleValue === null || this._saleValue === undefined) {
      throw new Error("Sale value is required");
    }

    switch (this._saleType) {
      case "percent":
        if (this._saleValue < 0 || this._saleValue > 1) {
          throw new Error("Percent sale value must be between 0 and 1");
        }
        break;
      case "fixed":
      case "amount":
        if (this._saleValue < 0) {
          throw new Error("Sale value must be non-negative");
        }
        break;
    }
  }

  /**
   * Update the schedule's values. Validates based on current status.
   */
  update(params: SaleScheduleUpdateParams): void {
    if (!this.canBeModified()) {
      throw new Error("Cannot modify schedule in current state");
    }

    if (params.startDate !== undefined) {
      if (!this.canModifyStartDate()) {
        throw new Error("Cannot modify start date after schedule has started");
      }
      this._startDate = params.startDate;
    }

    if (params.endDate !== undefined) {
      this._endDate = params.endDate;
    }

    if (params.saleType !== undefined) {
      this._saleType = params.saleType;
    }

    if (params.saleValue !== undefined) {
      this._saleValue = params.saleValue;
    }

    this.validate();
  }

  toState(): SaleScheduleState {
    const base = this.baseState();
    return {
      id: base.id,
      scheduleGroupId: base.scheduleGroupId,
      startScheduleId: base.startScheduleId,
      endScheduleId: base.endScheduleId as string,
      status: base.status,
      startDate: base.startDate,
      endDate: base.endDate as Date,
      saleType: this._saleType,
      saleValue: this._saleValue,
      createdAt: base.createdAt,
      createdBy: base.createdBy,
    };
  }

  static fromState(state: SaleScheduleState): SaleSchedule {
    return new SaleSchedule({
      id: state.id,
      scheduleGroupId: state.scheduleGroupId,
      startScheduleId: state.startScheduleId,
      endScheduleId: state.endScheduleId,
      status: state.status,
      startDate: new Date(state.startDate),
      endDate: new Date(state.endDate),
      saleType: state.saleType,
      saleValue: state.saleValue,
      createdAt: new Date(state.createdAt),
      createdBy: state.createdBy,
    });
  }

  static create(params: {
    id: string;
    scheduleGroupId: string;
    startScheduleId: string;
    endScheduleId: string;
    saleType: SaleType;
    saleValue: number;
    startDate: Date;
    endDate: Date;
    createdBy: string;
  }): SaleSchedule {
    return new SaleSchedule({
      ...params,
      createdAt: new Date(),
    });
  }
}
