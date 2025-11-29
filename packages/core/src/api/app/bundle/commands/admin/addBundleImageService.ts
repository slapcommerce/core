import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { AddBundleImageCommand } from "./commands";
import type { ImageUploadHelper } from "../../../../infrastructure/imageUploadHelper";
import { BundleAggregate } from "../../../../domain/bundle/aggregate";
import { randomUUIDv7 } from "bun";
import type { Service } from "../../../service";

export class AddBundleImageService implements Service<AddBundleImageCommand> {
  constructor(
    private unitOfWork: UnitOfWork,
    private imageUploadHelper: ImageUploadHelper
  ) {}

  async execute(command: AddBundleImageCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;

      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(`Bundle with id ${command.id} not found`);
      }

      if (snapshot.version !== command.expectedVersion) {
        throw new Error(
          `Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${snapshot.version}`
        );
      }

      // Upload image
      const base64Data = command.imageData.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0)).buffer;

      const uploadResult = await this.imageUploadHelper.uploadImage(
        buffer,
        command.filename,
        command.contentType
      );

      // Load aggregate and add image
      const bundleAggregate = BundleAggregate.loadFromSnapshot(snapshot);
      bundleAggregate.addImage(uploadResult, command.altText, command.userId);

      // Persist events
      for (const event of bundleAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Update snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: bundleAggregate.id,
        correlationId: snapshot.correlationId,
        version: bundleAggregate.version,
        payload: bundleAggregate.toSnapshot(),
      });

      // Add to outbox
      for (const event of bundleAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }
}
