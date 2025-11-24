import type { ScheduleEvent } from "../../domain/schedule/events";
import type { ScheduleViewData } from "../../infrastructure/repositories/scheduleViewRepository";
import type { ScheduleState } from "../../domain/schedule/events";
import { Projection } from "../_base/projection";

function createScheduleViewData(
  aggregateId: string,
  correlationId: string,
  version: number,
  state: ScheduleState,
  updatedAt: Date
): ScheduleViewData {
  return {
    aggregate_id: aggregateId,
    target_aggregate_id: state.targetAggregateId,
    target_aggregate_type: state.targetAggregateType,
    command_type: state.commandType,
    command_data: state.commandData,
    scheduled_for: state.scheduledFor,
    status: state.status,
    retry_count: state.retryCount,
    next_retry_at: state.nextRetryAt,
    created_by: state.createdBy,
    error_message: state.errorMessage,
    correlation_id: correlationId,
    version: version,
    created_at: state.createdAt,
    updated_at: updatedAt,
  };
}

export class ScheduleViewProjection extends Projection<ScheduleEvent> {
  protected handlers = {
    'schedule.created': this.updateView.bind(this),
    'schedule.updated': this.updateView.bind(this),
    'schedule.executed': this.updateView.bind(this),
    'schedule.failed': this.updateView.bind(this),
    'schedule.cancelled': this.updateView.bind(this),
  };

  private async updateView(event: ScheduleEvent): Promise<void> {
    const { scheduleViewRepository } = this.repositories;
    const state = event.payload.newState;

    const scheduleData = createScheduleViewData(
      event.aggregateId,
      event.correlationId,
      event.version,
      state,
      event.occurredAt
    );

    scheduleViewRepository.save(scheduleData);
  }
}
