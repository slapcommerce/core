import type { UnitOfWork } from "../../infrastructure/unitOfWork";
import type { DetachVariantDigitalAssetCommand } from "./commands";
import { VariantAggregate } from "../../domain/variant/aggregate";
import { randomUUIDv7 } from "bun";
import type { AccessLevel } from "../accessLevel";
import type { Service } from "../service";

export class DetachVariantDigitalAssetService implements Service<DetachVariantDigitalAssetCommand> {
  accessLevel: AccessLevel = "admin";

  constructor(
    private unitOfWork: UnitOfWork,

  ) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: DetachVariantDigitalAssetCommand) {
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
      
      variantAggregate.detachDigitalAsset(command.userId);

      for (const event of variantAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      snapshotRepository.saveSnapshot({
        aggregate_id: variantAggregate.id,
        correlation_id: snapshot.correlation_id,
        version: variantAggregate.version,
        payload: variantAggregate.toSnapshot(),
      });

      for (const event of variantAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }
}