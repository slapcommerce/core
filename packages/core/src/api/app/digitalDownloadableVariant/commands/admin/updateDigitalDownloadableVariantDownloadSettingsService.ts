import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { UpdateDigitalDownloadableVariantDownloadSettingsCommand } from "./commands";
import { DigitalDownloadableVariantAggregate } from "../../../../domain/digitalDownloadableVariant/aggregate";
import { randomUUIDv7 } from "bun";
import type { Service } from "../../../service";

export class UpdateDigitalDownloadableVariantDownloadSettingsService implements Service<UpdateDigitalDownloadableVariantDownloadSettingsCommand> {

  constructor(private unitOfWork: UnitOfWork) {}

  async execute(command: UpdateDigitalDownloadableVariantDownloadSettingsCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;

      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(`Digital downloadable variant with id ${command.id} not found`);
      }
      if (snapshot.version !== command.expectedVersion) {
        throw new Error(`Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${snapshot.version}`);
      }

      const variantAggregate = DigitalDownloadableVariantAggregate.loadFromSnapshot(snapshot);
      variantAggregate.updateDownloadSettings(command.maxDownloads, command.accessDurationDays, command.userId);

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
