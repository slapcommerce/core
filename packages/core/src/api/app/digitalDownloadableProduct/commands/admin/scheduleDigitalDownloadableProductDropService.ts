import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { ScheduleDigitalDownloadableProductDropCommand } from "./commands";
import { DigitalDownloadableProductAggregate } from "../../../../domain/digitalDownloadableProduct/aggregate";
import { VariantPositionsWithinProductAggregate } from "../../../../domain/variantPositionsWithinProduct/aggregate";
import { randomUUIDv7 } from "bun";

export class ScheduleDigitalDownloadableProductDropService {
  constructor(private unitOfWork: UnitOfWork) {}

  async execute(command: ScheduleDigitalDownloadableProductDropCommand) {
    let scheduleId: string = "";
    await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } =
        repositories;

      // Load and validate product
      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(
          `Digital downloadable product with id ${command.id} not found`
        );
      }
      if (snapshot.version !== command.expectedVersion) {
        throw new Error(
          `Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${snapshot.version}`
        );
      }

      const aggregate =
        DigitalDownloadableProductAggregate.loadFromSnapshot(snapshot);

      // Check if product has variants
      const variantPositionsSnapshot = snapshotRepository.getSnapshot(
        aggregate.variantPositionsAggregateId
      );
      const variantPositionsAggregate = variantPositionsSnapshot
        ? VariantPositionsWithinProductAggregate.loadFromSnapshot(variantPositionsSnapshot)
        : null;
      const variantIds = variantPositionsAggregate
        ? variantPositionsAggregate.getVariantIds()
        : [];
      const hasVariants = variantIds.length > 0;

      // Validate all variants are publishable
      const unpublishableVariants: { id: string; reason: string }[] = [];
      for (const variantId of variantIds) {
        const variantSnapshot = snapshotRepository.getSnapshot(variantId);
        if (!variantSnapshot) {
          unpublishableVariants.push({ id: variantId, reason: "not found" });
          continue;
        }
        const payload = JSON.parse(variantSnapshot.payload);

        if (payload.status === "archived") {
          unpublishableVariants.push({ id: variantId, reason: "archived" });
        } else if (!payload.sku || payload.sku.trim() === "") {
          unpublishableVariants.push({ id: variantId, reason: "missing SKU" });
        } else if (payload.listPrice < 0) {
          unpublishableVariants.push({ id: variantId, reason: "negative price" });
        }
      }

      if (unpublishableVariants.length > 0) {
        throw new Error(
          `Cannot schedule drop: variants not publishable: ${JSON.stringify(unpublishableVariants)}`
        );
      }

      // Generate IDs for the schedule
      scheduleId = randomUUIDv7();
      const scheduleGroupId = randomUUIDv7();
      const startScheduleId = randomUUIDv7();

      aggregate.scheduleDrop({
        id: scheduleId,
        scheduleGroupId,
        startScheduleId,
        dropType: command.dropType,
        scheduledFor: command.scheduledFor,
        userId: command.userId,
        hasVariants,
      });

      // Persist events
      for (const event of aggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      snapshotRepository.saveSnapshot({
        aggregateId: aggregate.id,
        correlationId: command.correlationId,
        version: aggregate.version,
        payload: aggregate.toSnapshot(),
      });

      for (const event of aggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
    return { scheduleId };
  }
}
