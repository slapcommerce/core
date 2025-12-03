import type { DropshipVariantState } from "../../../domain/dropshipVariant/events";
import type { DigitalDownloadableVariantState } from "../../../domain/digitalDownloadableVariant/events";
import type { DropshipProductState } from "../../../domain/dropshipProduct/events";
import type { DigitalDownloadableProductState } from "../../../domain/digitalDownloadableProduct/events";
import type { DomainEventUnion } from "../../../domain/_base/domainEvent";
import type { UnitOfWorkRepositories } from "../../unitOfWork";
import type { SaleScheduleState, DropScheduleState } from "../../../domain/_base/schedule";

// Sale schedule event names (variants only)
type VariantSaleScheduleEventName =
  | "dropship_variant.sale_scheduled"
  | "dropship_variant.scheduled_sale_started"
  | "dropship_variant.scheduled_sale_ended"
  | "dropship_variant.scheduled_sale_updated"
  | "dropship_variant.scheduled_sale_cancelled"
  | "digital_downloadable_variant.sale_scheduled"
  | "digital_downloadable_variant.scheduled_sale_started"
  | "digital_downloadable_variant.scheduled_sale_ended"
  | "digital_downloadable_variant.scheduled_sale_updated"
  | "digital_downloadable_variant.scheduled_sale_cancelled";

// Drop schedule event names (variants and products)
type DropScheduleEventName =
  | "dropship_variant.drop_scheduled"
  | "dropship_variant.dropped"
  | "dropship_variant.scheduled_drop_updated"
  | "dropship_variant.scheduled_drop_cancelled"
  | "digital_downloadable_variant.drop_scheduled"
  | "digital_downloadable_variant.dropped"
  | "digital_downloadable_variant.scheduled_drop_updated"
  | "digital_downloadable_variant.scheduled_drop_cancelled"
  | "dropship_product.drop_scheduled"
  | "dropship_product.dropped"
  | "dropship_product.scheduled_drop_updated"
  | "dropship_product.scheduled_drop_cancelled"
  | "digital_downloadable_product.drop_scheduled"
  | "digital_downloadable_product.dropped"
  | "digital_downloadable_product.scheduled_drop_updated"
  | "digital_downloadable_product.scheduled_drop_cancelled";

type AllScheduleEventName = VariantSaleScheduleEventName | DropScheduleEventName;

type VariantState = DropshipVariantState | DigitalDownloadableVariantState;
type ProductState = DropshipProductState | DigitalDownloadableProductState;
type AggregateState = VariantState | ProductState;

type ScheduleEvent = Extract<DomainEventUnion, { eventName: AllScheduleEventName }>;

type HandlerMap = {
  [K in AllScheduleEventName]: (event: ScheduleEvent) => void;
};

export class PendingSchedulesProjector {
  protected repositories: UnitOfWorkRepositories;
  protected handlers: HandlerMap;

  constructor(repositories: UnitOfWorkRepositories) {
    this.repositories = repositories;
    this.handlers = {
      // Dropship variant sale schedule events
      "dropship_variant.sale_scheduled": this.handleSaleScheduled.bind(this),
      "dropship_variant.scheduled_sale_started": this.handleScheduledSaleStarted.bind(this),
      "dropship_variant.scheduled_sale_ended": this.handleScheduledSaleEnded.bind(this),
      "dropship_variant.scheduled_sale_updated": this.handleScheduledSaleUpdated.bind(this),
      "dropship_variant.scheduled_sale_cancelled": this.handleScheduledSaleCancelled.bind(this),

      // Digital downloadable variant sale schedule events
      "digital_downloadable_variant.sale_scheduled": this.handleSaleScheduled.bind(this),
      "digital_downloadable_variant.scheduled_sale_started": this.handleScheduledSaleStarted.bind(this),
      "digital_downloadable_variant.scheduled_sale_ended": this.handleScheduledSaleEnded.bind(this),
      "digital_downloadable_variant.scheduled_sale_updated": this.handleScheduledSaleUpdated.bind(this),
      "digital_downloadable_variant.scheduled_sale_cancelled": this.handleScheduledSaleCancelled.bind(this),

      // Dropship variant drop schedule events
      "dropship_variant.drop_scheduled": this.handleDropScheduled.bind(this),
      "dropship_variant.dropped": this.handleDropped.bind(this),
      "dropship_variant.scheduled_drop_updated": this.handleScheduledDropUpdated.bind(this),
      "dropship_variant.scheduled_drop_cancelled": this.handleScheduledDropCancelled.bind(this),

      // Digital downloadable variant drop schedule events
      "digital_downloadable_variant.drop_scheduled": this.handleDropScheduled.bind(this),
      "digital_downloadable_variant.dropped": this.handleDropped.bind(this),
      "digital_downloadable_variant.scheduled_drop_updated": this.handleScheduledDropUpdated.bind(this),
      "digital_downloadable_variant.scheduled_drop_cancelled": this.handleScheduledDropCancelled.bind(this),

      // Dropship product drop schedule events
      "dropship_product.drop_scheduled": this.handleDropScheduled.bind(this),
      "dropship_product.dropped": this.handleDropped.bind(this),
      "dropship_product.scheduled_drop_updated": this.handleScheduledDropUpdated.bind(this),
      "dropship_product.scheduled_drop_cancelled": this.handleScheduledDropCancelled.bind(this),

      // Digital downloadable product drop schedule events
      "digital_downloadable_product.drop_scheduled": this.handleDropScheduled.bind(this),
      "digital_downloadable_product.dropped": this.handleDropped.bind(this),
      "digital_downloadable_product.scheduled_drop_updated": this.handleScheduledDropUpdated.bind(this),
      "digital_downloadable_product.scheduled_drop_cancelled": this.handleScheduledDropCancelled.bind(this),
    };
  }

  async execute(event: DomainEventUnion): Promise<void> {
    const handler = (this.handlers as any)[event.eventName];
    if (handler) {
      await handler(event as ScheduleEvent);
    }
    // Silently ignore events with no handler
  }

  private getAggregateType(eventName: string): string {
    if (eventName.startsWith("dropship_variant")) return "dropship_variant";
    if (eventName.startsWith("digital_downloadable_variant")) return "digital_downloadable_variant";
    if (eventName.startsWith("dropship_product")) return "dropship_product";
    if (eventName.startsWith("digital_downloadable_product")) return "digital_downloadable_product";
    return "unknown";
  }

  // ============================================
  // Sale Schedule Handlers (variants only)
  // ============================================

  private handleSaleScheduled(event: ScheduleEvent): void {
    const state = event.payload.newState as VariantState;
    const saleSchedule = state.saleSchedule as SaleScheduleState;
    const aggregateType = this.getAggregateType(event.eventName);
    const now = new Date();

    // Create two pending schedule records: one for start, one for end
    this.repositories.pendingSchedulesReadModelRepository.save({
      scheduleId: saleSchedule.startScheduleId,
      scheduleGroupId: saleSchedule.scheduleGroupId,
      aggregateId: event.aggregateId,
      aggregateType,
      scheduleType: "sale_start",
      dueAt: saleSchedule.startDate,
      status: "pending",
      retryCount: 0,
      nextRetryAt: null,
      errorMessage: null,
      metadata: {
        saleType: saleSchedule.saleType,
        saleValue: saleSchedule.saleValue,
      },
      createdAt: now,
      updatedAt: now,
    });

    this.repositories.pendingSchedulesReadModelRepository.save({
      scheduleId: saleSchedule.endScheduleId,
      scheduleGroupId: saleSchedule.scheduleGroupId,
      aggregateId: event.aggregateId,
      aggregateType,
      scheduleType: "sale_end",
      dueAt: saleSchedule.endDate,
      status: "pending",
      retryCount: 0,
      nextRetryAt: null,
      errorMessage: null,
      metadata: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  private handleScheduledSaleStarted(event: ScheduleEvent): void {
    const state = event.payload.newState as VariantState;
    const saleSchedule = state.saleSchedule as SaleScheduleState;

    // Mark the start schedule as completed
    this.repositories.pendingSchedulesReadModelRepository.updateStatus(
      saleSchedule.startScheduleId,
      "completed"
    );
  }

  private handleScheduledSaleEnded(event: ScheduleEvent): void {
    const state = event.payload.newState as VariantState;
    const saleSchedule = state.saleSchedule as SaleScheduleState;

    // Mark the end schedule as completed
    this.repositories.pendingSchedulesReadModelRepository.updateStatus(
      saleSchedule.endScheduleId,
      "completed"
    );
  }

  private handleScheduledSaleUpdated(event: ScheduleEvent): void {
    const priorState = event.payload.priorState as VariantState;
    const newState = event.payload.newState as VariantState;
    const priorSchedule = priorState.saleSchedule as SaleScheduleState;
    const newSchedule = newState.saleSchedule as SaleScheduleState;
    const aggregateType = this.getAggregateType(event.eventName);
    const now = new Date();

    // Update start schedule if start date changed and schedule is still pending
    if (priorSchedule.status === "pending" && newSchedule.startDate !== priorSchedule.startDate) {
      this.repositories.pendingSchedulesReadModelRepository.save({
        scheduleId: newSchedule.startScheduleId,
        scheduleGroupId: newSchedule.scheduleGroupId,
        aggregateId: event.aggregateId,
        aggregateType,
        scheduleType: "sale_start",
        dueAt: newSchedule.startDate,
        status: "pending",
        retryCount: 0,
        nextRetryAt: null,
        errorMessage: null,
        metadata: {
          saleType: newSchedule.saleType,
          saleValue: newSchedule.saleValue,
        },
        createdAt: now,
        updatedAt: now,
      });
    }

    // Update end schedule if end date changed
    if (newSchedule.endDate !== priorSchedule.endDate) {
      this.repositories.pendingSchedulesReadModelRepository.save({
        scheduleId: newSchedule.endScheduleId,
        scheduleGroupId: newSchedule.scheduleGroupId,
        aggregateId: event.aggregateId,
        aggregateType,
        scheduleType: "sale_end",
        dueAt: newSchedule.endDate,
        status: "pending",
        retryCount: 0,
        nextRetryAt: null,
        errorMessage: null,
        metadata: null,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  private handleScheduledSaleCancelled(event: ScheduleEvent): void {
    const state = event.payload.newState as VariantState;
    const saleSchedule = state.saleSchedule as SaleScheduleState;

    // Delete both schedule records by group ID
    this.repositories.pendingSchedulesReadModelRepository.deleteByGroupId(
      saleSchedule.scheduleGroupId
    );
  }

  // ============================================
  // Drop Schedule Handlers (variants and products)
  // ============================================

  private handleDropScheduled(event: ScheduleEvent): void {
    const state = event.payload.newState as AggregateState;
    const dropSchedule = state.dropSchedule as DropScheduleState;
    const aggregateType = this.getAggregateType(event.eventName);
    const now = new Date();

    // Create one pending schedule record for the drop
    this.repositories.pendingSchedulesReadModelRepository.save({
      scheduleId: dropSchedule.startScheduleId,
      scheduleGroupId: dropSchedule.scheduleGroupId,
      aggregateId: event.aggregateId,
      aggregateType,
      scheduleType: "dropped",
      dueAt: dropSchedule.startDate,
      status: "pending",
      retryCount: 0,
      nextRetryAt: null,
      errorMessage: null,
      metadata: {
        dropType: dropSchedule.dropType,
      },
      createdAt: now,
      updatedAt: now,
    });
  }

  private handleDropped(event: ScheduleEvent): void {
    const state = event.payload.newState as AggregateState;
    const dropSchedule = state.dropSchedule as DropScheduleState;

    // Mark the drop schedule as completed
    this.repositories.pendingSchedulesReadModelRepository.updateStatus(
      dropSchedule.startScheduleId,
      "completed"
    );
  }

  private handleScheduledDropUpdated(event: ScheduleEvent): void {
    const newState = event.payload.newState as AggregateState;
    const newSchedule = newState.dropSchedule as DropScheduleState;
    const aggregateType = this.getAggregateType(event.eventName);
    const now = new Date();

    // Update the drop schedule record with new date
    this.repositories.pendingSchedulesReadModelRepository.save({
      scheduleId: newSchedule.startScheduleId,
      scheduleGroupId: newSchedule.scheduleGroupId,
      aggregateId: event.aggregateId,
      aggregateType,
      scheduleType: "dropped",
      dueAt: newSchedule.startDate,
      status: "pending",
      retryCount: 0,
      nextRetryAt: null,
      errorMessage: null,
      metadata: {
        dropType: newSchedule.dropType,
      },
      createdAt: now,
      updatedAt: now,
    });
  }

  private handleScheduledDropCancelled(event: ScheduleEvent): void {
    const state = event.payload.newState as AggregateState;
    const dropSchedule = state.dropSchedule as DropScheduleState;

    // Delete the schedule record by group ID
    this.repositories.pendingSchedulesReadModelRepository.deleteByGroupId(
      dropSchedule.scheduleGroupId
    );
  }
}
