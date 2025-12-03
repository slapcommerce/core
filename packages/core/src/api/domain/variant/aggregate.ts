import type { DomainEvent } from "../_base/domainEvent";
import { ImageCollection } from "../_base/imageCollection";
import { SaleSchedule, type SaleScheduleState, type SaleScheduleUpdateParams, DropSchedule, type DropScheduleState, type DropType } from "../_base/schedule";

export type VariantStatus = "draft" | "active" | "archived" | "hidden_pending_drop" | "visible_pending_drop";

export type SaleType = "fixed" | "percent" | "amount";

export interface VariantState {
  productId: string;
  sku: string;
  listPrice: number;
  saleType: SaleType | null;
  saleValue: number | null;
  options: Record<string, string>;
  status: VariantStatus;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  images: ImageCollection;
  saleSchedule: SaleScheduleState | null;
  dropSchedule: DropScheduleState | null;
}

export type VariantEventParams<TState> = {
  occurredAt: Date;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  priorState: TState;
  newState: TState;
};

export type VariantAggregateParams = {
  id: string;
  correlationId: string;
  createdAt: Date;
  updatedAt: Date;
  productId: string;
  sku: string;
  listPrice: number;
  saleType: SaleType | null;
  saleValue: number | null;
  options: Record<string, string>;
  version: number;
  status: VariantStatus;
  publishedAt: Date | null;
  images: ImageCollection;
};

export abstract class VariantAggregate<
  TState extends VariantState,
  TEvent extends DomainEvent
> {
  public id: string;
  public version: number = 0;
  public uncommittedEvents: TEvent[] = [];
  protected correlationId: string;
  protected createdAt: Date;
  protected updatedAt: Date;
  protected productId: string;
  protected sku: string;
  protected listPrice: number;
  protected saleType: SaleType | null;
  protected saleValue: number | null;
  protected options: Record<string, string>;
  protected status: VariantStatus;
  protected publishedAt: Date | null;
  public images: ImageCollection;
  protected saleSchedule: SaleSchedule | null = null;
  protected dropSchedule: DropSchedule | null = null;

  constructor(params: VariantAggregateParams) {
    this.id = params.id;
    this.correlationId = params.correlationId;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
    this.productId = params.productId;
    this.sku = params.sku;
    this.listPrice = params.listPrice;
    this.saleType = params.saleType;
    this.saleValue = params.saleValue;
    this.options = params.options;
    this.version = params.version;
    this.status = params.status;
    this.publishedAt = params.publishedAt;
    this.images = params.images;
  }

  // Abstract factory methods - subclasses provide type-specific events
  protected abstract createArchivedEvent(params: VariantEventParams<TState>): TEvent;
  protected abstract createPublishedEvent(params: VariantEventParams<TState>): TEvent;
  protected abstract createDetailsUpdatedEvent(params: VariantEventParams<TState>): TEvent;
  protected abstract createPriceUpdatedEvent(params: VariantEventParams<TState>): TEvent;
  protected abstract createSaleUpdatedEvent(params: VariantEventParams<TState>): TEvent;
  protected abstract createSkuUpdatedEvent(params: VariantEventParams<TState>): TEvent;
  protected abstract createImagesUpdatedEvent(params: VariantEventParams<TState>): TEvent;
  // Drop schedule events
  protected abstract createDropScheduledEvent(params: VariantEventParams<TState>): TEvent;
  protected abstract createDroppedEvent(params: VariantEventParams<TState>): TEvent;
  protected abstract createScheduledDropUpdatedEvent(params: VariantEventParams<TState>): TEvent;
  protected abstract createScheduledDropCancelledEvent(params: VariantEventParams<TState>): TEvent;
  // Sale schedule events
  protected abstract createSaleScheduledEvent(params: VariantEventParams<TState>): TEvent;
  protected abstract createScheduledSaleStartedEvent(params: VariantEventParams<TState>): TEvent;
  protected abstract createScheduledSaleEndedEvent(params: VariantEventParams<TState>): TEvent;
  protected abstract createScheduledSaleUpdatedEvent(params: VariantEventParams<TState>): TEvent;
  protected abstract createScheduledSaleCancelledEvent(params: VariantEventParams<TState>): TEvent;
  protected abstract toState(): TState;

  /**
   * Validate that the aggregate is in a state that supports scheduling a sale.
   * Override in subclasses for type-specific validation.
   */
  protected validateCanScheduleSale(): void {
    if (this.status === "archived") {
      throw new Error("Cannot schedule sale on archived variant");
    }
  }

  protected baseState(): VariantState {
    return {
      productId: this.productId,
      sku: this.sku,
      listPrice: this.listPrice,
      saleType: this.saleType,
      saleValue: this.saleValue,
      options: this.options,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      publishedAt: this.publishedAt,
      images: this.images,
      saleSchedule: this.saleSchedule?.toState() ?? null,
      dropSchedule: this.dropSchedule?.toState() ?? null,
    };
  }

  calculateActivePrice(): number {
    if (this.saleType === null || this.saleValue === null) {
      return this.listPrice;
    }
    switch (this.saleType) {
      case "fixed":
        return this.saleValue;
      case "percent":
        return Math.round(this.listPrice * (1 - this.saleValue));
      case "amount":
        return Math.max(0, this.listPrice - this.saleValue);
    }
  }

  archive(userId: string) {
    if (this.status === "archived") {
      throw new Error("Variant is already archived");
    }
    const occurredAt = new Date();
    const priorState = this.toState();
    this.status = "archived";
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = this.createArchivedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(event);
    return this;
  }

  publish(userId: string) {
    if (this.status === "archived") {
      throw new Error("Cannot publish an archived variant");
    }
    if (this.status === "active") {
      throw new Error("Variant is already published");
    }
    // Skip validation if coming from pending_drop statuses (already validated)
    const isFromPendingDrop = this.status === "hidden_pending_drop" || this.status === "visible_pending_drop";
    if (!isFromPendingDrop) {
      this.validatePublish();
    }

    const occurredAt = new Date();
    const priorState = this.toState();
    this.status = "active";
    this.publishedAt = occurredAt;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = this.createPublishedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(event);
    return this;
  }

  protected validatePublish(): void {
    if (!this.sku || this.sku.trim() === "") {
      throw new Error("Cannot publish variant without a SKU");
    }
    if (this.listPrice < 0) {
      throw new Error("Cannot publish variant with negative price");
    }
  }

  // ============================================
  // Drop Schedule Methods
  // ============================================

  /**
   * Schedule a drop for this variant.
   * Creates a DropSchedule entity that will execute at the scheduled date.
   */
  scheduleDrop(params: {
    id: string;
    scheduleGroupId: string;
    startScheduleId: string;
    dropType: DropType;
    scheduledFor: Date;
    userId: string;
  }) {
    if (this.status === "archived") {
      throw new Error("Cannot schedule drop on an archived variant");
    }
    if (this.dropSchedule && this.dropSchedule.status === "pending") {
      throw new Error("A drop is already scheduled. Cancel it first.");
    }
    this.validatePublish();

    const occurredAt = new Date();
    const priorState = this.toState();

    this.dropSchedule = DropSchedule.create({
      id: params.id,
      scheduleGroupId: params.scheduleGroupId,
      startScheduleId: params.startScheduleId,
      dropType: params.dropType,
      startDate: params.scheduledFor,
      createdBy: params.userId,
    });

    this.status = params.dropType === "hidden" ? "hidden_pending_drop" : "visible_pending_drop";
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = this.createDropScheduledEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId: params.userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(event);
    return this;
  }

  /**
   * Execute a scheduled drop. Called by the poller when scheduledFor is reached.
   * Publishes the variant and completes the schedule.
   */
  executeDrop(userId: string) {
    if (!this.dropSchedule || this.dropSchedule.status !== "pending") {
      throw new Error("No pending scheduled drop to execute");
    }

    const occurredAt = new Date();
    const priorState = this.toState();

    // Execute the drop (marks as completed)
    this.dropSchedule.execute();

    // Publish the variant
    this.status = "active";
    this.publishedAt = occurredAt;
    this.updatedAt = occurredAt;
    this.version++;

    const newState = this.toState();
    const event = this.createDroppedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(event);
    return this;
  }

  /**
   * Update a scheduled drop. Can update the scheduled date and drop type.
   */
  updateScheduledDrop(params: { scheduledFor?: Date; dropType?: DropType }, userId: string) {
    if (!this.dropSchedule) {
      throw new Error("No scheduled drop to update");
    }
    if (this.dropSchedule.status !== "pending") {
      throw new Error("Can only update a pending drop schedule");
    }

    const occurredAt = new Date();
    const priorState = this.toState();

    // Update the schedule entity
    this.dropSchedule.update({
      startDate: params.scheduledFor,
      dropType: params.dropType,
    });

    // Update status if drop type changed
    if (params.dropType !== undefined) {
      this.status = params.dropType === "hidden" ? "hidden_pending_drop" : "visible_pending_drop";
    }

    this.updatedAt = occurredAt;
    this.version++;

    const newState = this.toState();
    const event = this.createScheduledDropUpdatedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(event);
    return this;
  }

  /**
   * Cancel a scheduled drop.
   * Reverts the variant back to draft status.
   */
  cancelScheduledDrop(userId: string) {
    if (!this.dropSchedule) {
      throw new Error("No scheduled drop to cancel");
    }
    if (this.dropSchedule.status !== "pending") {
      throw new Error("Can only cancel a pending drop schedule");
    }

    const occurredAt = new Date();
    const priorState = this.toState();

    // Cancel the schedule entity
    this.dropSchedule.cancel();

    // Revert to draft status
    this.status = "draft";
    this.updatedAt = occurredAt;
    this.version++;

    const newState = this.toState();
    const event = this.createScheduledDropCancelledEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(event);
    return this;
  }

  /**
   * Get the current drop schedule state (for read operations)
   */
  getDropSchedule(): DropScheduleState | null {
    return this.dropSchedule?.toState() ?? null;
  }

  /**
   * Restore a drop schedule from snapshot data (called during loadFromSnapshot)
   */
  restoreDropSchedule(schedule: DropSchedule): void {
    this.dropSchedule = schedule;
  }

  updateDetails(options: Record<string, string>, userId: string) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.options = options;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = this.createDetailsUpdatedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(event);
    return this;
  }

  updatePrice(listPrice: number, userId: string) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.listPrice = listPrice;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = this.createPriceUpdatedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(event);
    return this;
  }

  updateSale(saleType: SaleType | null, saleValue: number | null, userId: string) {
    // Validation
    if (saleType === null && saleValue !== null) {
      throw new Error("saleValue must be null when saleType is null");
    }
    if (saleType !== null && saleValue === null) {
      throw new Error("saleValue is required when saleType is set");
    }
    if (saleType === "percent" && saleValue !== null && (saleValue < 0 || saleValue > 1)) {
      throw new Error("Percent sale value must be between 0 and 1");
    }
    if (saleType === "amount" && saleValue !== null && saleValue > this.listPrice) {
      throw new Error("Amount discount cannot exceed list price");
    }
    if ((saleType === "fixed" || saleType === "amount") && saleValue !== null && saleValue < 0) {
      throw new Error("Sale value must be non-negative");
    }

    const occurredAt = new Date();
    const priorState = this.toState();
    this.saleType = saleType;
    this.saleValue = saleValue;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = this.createSaleUpdatedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(event);
    return this;
  }

  updateSku(sku: string, userId: string) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.sku = sku;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = this.createSkuUpdatedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(event);
    return this;
  }

  updateImages(images: ImageCollection, userId: string) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.images = images;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = this.createImagesUpdatedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(event);
    return this;
  }

  // ============================================
  // Sale Schedule Methods
  // ============================================

  /**
   * Schedule a sale for this variant.
   * Creates a SaleSchedule entity that will activate at startDate and end at endDate.
   */
  scheduleSale(params: {
    id: string;
    scheduleGroupId: string;
    startScheduleId: string;
    endScheduleId: string;
    saleType: SaleType;
    saleValue: number;
    startDate: Date;
    endDate: Date;
    userId: string;
  }) {
    this.validateCanScheduleSale();

    if (this.saleSchedule && this.saleSchedule.status === "pending") {
      throw new Error("A sale is already scheduled. Cancel it first.");
    }
    if (this.saleSchedule && this.saleSchedule.status === "active") {
      throw new Error("A sale is currently active. Cannot schedule a new one.");
    }

    const occurredAt = new Date();
    const priorState = this.toState();

    this.saleSchedule = SaleSchedule.create({
      id: params.id,
      scheduleGroupId: params.scheduleGroupId,
      startScheduleId: params.startScheduleId,
      endScheduleId: params.endScheduleId,
      saleType: params.saleType,
      saleValue: params.saleValue,
      startDate: params.startDate,
      endDate: params.endDate,
      createdBy: params.userId,
    });

    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = this.createSaleScheduledEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId: params.userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(event);
    return this;
  }

  /**
   * Start a scheduled sale. Called by the executor when startDate is reached.
   * Applies the sale values to the variant.
   */
  startScheduledSale(userId: string) {
    if (!this.saleSchedule || this.saleSchedule.status !== "pending") {
      throw new Error("No pending scheduled sale to start");
    }

    const occurredAt = new Date();
    const priorState = this.toState();

    // Activate the schedule entity
    this.saleSchedule.activate();

    // Apply the sale values to the variant
    this.saleType = this.saleSchedule.saleType;
    this.saleValue = this.saleSchedule.saleValue;
    this.updatedAt = occurredAt;
    this.version++;

    const newState = this.toState();
    const event = this.createScheduledSaleStartedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(event);
    return this;
  }

  /**
   * End a scheduled sale. Called by the executor when endDate is reached.
   * Clears the sale values from the variant.
   */
  endScheduledSale(userId: string) {
    if (!this.saleSchedule || this.saleSchedule.status !== "active") {
      throw new Error("No active scheduled sale to end");
    }

    const occurredAt = new Date();
    const priorState = this.toState();

    // Complete the schedule entity
    this.saleSchedule.complete();

    // Clear the sale values
    this.saleType = null;
    this.saleValue = null;
    this.updatedAt = occurredAt;
    this.version++;

    const newState = this.toState();
    const event = this.createScheduledSaleEndedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(event);
    return this;
  }

  /**
   * Update a scheduled sale. Can update dates and sale values.
   * If the sale is active, also updates the live sale values on the variant.
   */
  updateScheduledSale(params: SaleScheduleUpdateParams, userId: string) {
    if (!this.saleSchedule) {
      throw new Error("No scheduled sale to update");
    }

    this.validateCanScheduleSale();

    const occurredAt = new Date();
    const priorState = this.toState();

    // Update the schedule entity
    this.saleSchedule.update(params);

    // If sale is active and sale values changed, update the variant's live values
    if (this.saleSchedule.status === "active") {
      if (params.saleType !== undefined) {
        this.saleType = params.saleType;
      }
      if (params.saleValue !== undefined) {
        this.saleValue = params.saleValue;
      }
    }

    this.updatedAt = occurredAt;
    this.version++;

    const newState = this.toState();
    const event = this.createScheduledSaleUpdatedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(event);
    return this;
  }

  /**
   * Cancel a scheduled sale.
   * If the sale is active, also clears the live sale values from the variant.
   */
  cancelScheduledSale(userId: string) {
    if (!this.saleSchedule) {
      throw new Error("No scheduled sale to cancel");
    }
    if (this.saleSchedule.status === "completed") {
      throw new Error("Cannot cancel a completed sale schedule");
    }

    const occurredAt = new Date();
    const priorState = this.toState();

    const wasActive = this.saleSchedule.status === "active";

    // Cancel the schedule entity
    this.saleSchedule.cancel();

    // If sale was active, clear the variant's sale values
    if (wasActive) {
      this.saleType = null;
      this.saleValue = null;
    }

    this.updatedAt = occurredAt;
    this.version++;

    const newState = this.toState();
    const event = this.createScheduledSaleCancelledEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(event);
    return this;
  }

  /**
   * Get the current sale schedule state (for read operations)
   */
  getSaleSchedule(): SaleScheduleState | null {
    return this.saleSchedule?.toState() ?? null;
  }

  /**
   * Restore a sale schedule from snapshot data (called during loadFromSnapshot)
   */
  restoreSaleSchedule(schedule: SaleSchedule): void {
    this.saleSchedule = schedule;
  }

  toSnapshot() {
    return {
      id: this.id,
      productId: this.productId,
      sku: this.sku,
      listPrice: this.listPrice,
      saleType: this.saleType,
      saleValue: this.saleValue,
      options: this.options,
      status: this.status,
      publishedAt: this.publishedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      version: this.version,
      images: this.images.toJSON(),
      saleSchedule: this.saleSchedule?.toState() ?? null,
      dropSchedule: this.dropSchedule?.toState() ?? null,
    };
  }
}
