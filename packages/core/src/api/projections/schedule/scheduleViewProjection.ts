import type { DomainEvent } from "../../domain/_base/domainEvent";
import type {
  UnitOfWorkRepositories,
} from "../../infrastructure/unitOfWork";
import {
  ScheduleCreatedEvent,
  ScheduleUpdatedEvent,
  ScheduleExecutedEvent,
  ScheduleFailedEvent,
  ScheduleCancelledEvent,
} from "../../domain/schedule/events";
import type { ScheduleEvent } from "../../domain/schedule/events";
import type { ScheduleViewData } from "../../infrastructure/repositories/scheduleViewRepository";
import type { ScheduleState } from "../../domain/schedule/events";
import { assertNever } from "../../lib/assertNever";

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

export class ScheduleViewProjection {
  constructor(private repositories: UnitOfWorkRepositories) { }

  async execute(
    event: ScheduleEvent
  ): Promise<void> {
    const { scheduleViewRepository } = this.repositories;
    switch (event.eventName) {
      case "schedule.created": {
        const scheduleCreatedEvent = event as ScheduleCreatedEvent;
        const state = scheduleCreatedEvent.payload.newState;

        const scheduleData = createScheduleViewData(
          scheduleCreatedEvent.aggregateId,
          scheduleCreatedEvent.correlationId,
          scheduleCreatedEvent.version,
          state,
          scheduleCreatedEvent.occurredAt
        );

        scheduleViewRepository.save(scheduleData);
        break;
      }
      case "schedule.updated": {
        const scheduleUpdatedEvent = event as ScheduleUpdatedEvent;
        const state = scheduleUpdatedEvent.payload.newState;

        const scheduleData = createScheduleViewData(
          scheduleUpdatedEvent.aggregateId,
          scheduleUpdatedEvent.correlationId,
          scheduleUpdatedEvent.version,
          state,
          scheduleUpdatedEvent.occurredAt
        );

        scheduleViewRepository.save(scheduleData);
        break;
      }
      case "schedule.executed": {
        const scheduleExecutedEvent = event as ScheduleExecutedEvent;
        const state = scheduleExecutedEvent.payload.newState;

        const scheduleData = createScheduleViewData(
          scheduleExecutedEvent.aggregateId,
          scheduleExecutedEvent.correlationId,
          scheduleExecutedEvent.version,
          state,
          scheduleExecutedEvent.occurredAt
        );

        scheduleViewRepository.save(scheduleData);
        break;
      }
      case "schedule.failed": {
        const scheduleFailedEvent = event as ScheduleFailedEvent;
        const state = scheduleFailedEvent.payload.newState;

        const scheduleData = createScheduleViewData(
          scheduleFailedEvent.aggregateId,
          scheduleFailedEvent.correlationId,
          scheduleFailedEvent.version,
          state,
          scheduleFailedEvent.occurredAt
        );

        scheduleViewRepository.save(scheduleData);
        break;
      }
      case "schedule.cancelled": {
        const scheduleCancelledEvent = event as ScheduleCancelledEvent;
        const state = scheduleCancelledEvent.payload.newState;

        const scheduleData = createScheduleViewData(
          scheduleCancelledEvent.aggregateId,
          scheduleCancelledEvent.correlationId,
          scheduleCancelledEvent.version,
          state,
          scheduleCancelledEvent.occurredAt
        );

        scheduleViewRepository.save(scheduleData);
        break;
      }
      default:
        assertNever(event);
    }
  }
}
