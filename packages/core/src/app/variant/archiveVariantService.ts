import type { UnitOfWork } from "../../infrastructure/unitOfWork";
import type { ArchiveVariantCommand } from "./commands";
import { VariantAggregate } from "../../domain/variant/aggregate";
import { SkuAggregate } from "../../domain/sku/skuAggregate";
import { randomUUIDv7 } from "bun";
import type { AccessLevel } from "../accessLevel";
import type { Service } from "../service";
  
export class ArchiveVariantService implements Service<ArchiveVariantCommand> {
  accessLevel: AccessLevel = "admin";

  constructor(
    private unitOfWork: UnitOfWork,

  ) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: ArchiveVariantCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;
      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(`Variant with id ${command.id} not found`);
      }
      if (snapshot.version !== command.expectedVersion) {
        throw new Error(`Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${snapshot.version}`);
      }
      const variantAggregate = VariantAggregate.loadFromSnapshot(snapshot);
      const variantSnapshotData = variantAggregate.toSnapshot();

      // Archive variant
      variantAggregate.archive(command.userId);

      // Load SKU aggregate to release it
      const skuSnapshot = snapshotRepository.getSnapshot(variantSnapshotData.sku);
      if (!skuSnapshot) {
        throw new Error(`SKU "${variantSnapshotData.sku}" not found`);
      }
      const skuAggregate = SkuAggregate.loadFromSnapshot(skuSnapshot);
      skuAggregate.releaseSku(command.userId);

      // Handle variant events and projections
      for (const event of variantAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Handle SKU aggregate events and projections
      for (const event of skuAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Save variant snapshot
      snapshotRepository.saveSnapshot({
        aggregate_id: variantAggregate.id,
        correlation_id: snapshot.correlation_id,
        version: variantAggregate.version,
        payload: variantAggregate.toSnapshot(),
      });

      // Save SKU aggregate snapshot
      snapshotRepository.saveSnapshot({
        aggregate_id: skuAggregate.id,
        correlation_id: snapshot.correlation_id,
        version: skuAggregate.version,
        payload: skuAggregate.toSnapshot(),
      });

      // Add all events to outbox
      for (const event of variantAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
      for (const event of skuAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }
}
