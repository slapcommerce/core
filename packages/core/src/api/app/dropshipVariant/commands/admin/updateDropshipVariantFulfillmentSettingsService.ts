import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { UpdateDropshipVariantFulfillmentSettingsCommand } from "./commands";
import { DropshipVariantAggregate } from "../../../../domain/dropshipVariant/aggregate";
import { randomUUIDv7 } from "bun";
import type { Service } from "../../../service";

export class UpdateDropshipVariantFulfillmentSettingsService implements Service<UpdateDropshipVariantFulfillmentSettingsCommand> {

  constructor(private unitOfWork: UnitOfWork) {}

  async execute(command: UpdateDropshipVariantFulfillmentSettingsCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;

      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(`Dropship variant with id ${command.id} not found`);
      }
      if (snapshot.version !== command.expectedVersion) {
        throw new Error(`Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${snapshot.version}`);
      }

      const variantAggregate = DropshipVariantAggregate.loadFromSnapshot(snapshot);
      variantAggregate.updateFulfillmentSettings(
        command.fulfillmentProviderId,
        command.supplierCost,
        command.supplierSku,
        command.userId
      );

      for (const event of variantAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      snapshotRepository.saveSnapshot({
        aggregateId: variantAggregate.id,
        correlationId: snapshot.correlationId,
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
