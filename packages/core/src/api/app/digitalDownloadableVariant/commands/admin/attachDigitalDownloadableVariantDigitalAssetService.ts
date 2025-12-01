import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { AttachDigitalDownloadableVariantDigitalAssetCommand } from "./commands";
import type { DigitalAssetUploadHelper } from "../../../../infrastructure/digitalAssetUploadHelper";
import { DigitalDownloadableVariantAggregate } from "../../../../domain/digitalDownloadableVariant/aggregate";
import { randomUUIDv7 } from "bun";
import type { Service } from "../../../service";

export class AttachDigitalDownloadableVariantDigitalAssetService implements Service<AttachDigitalDownloadableVariantDigitalAssetCommand> {

  constructor(
    private unitOfWork: UnitOfWork,
    private digitalAssetUploadHelper: DigitalAssetUploadHelper
  ) {}

  async execute(command: AttachDigitalDownloadableVariantDigitalAssetCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;

      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(`Digital downloadable variant with id ${command.id} not found`);
      }
      if (snapshot.version !== command.expectedVersion) {
        throw new Error(`Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${snapshot.version}`);
      }

      // Decode base64 data and upload asset
      const base64Data = command.assetData.replace(/^data:[^;]+;base64,/, "");
      const buffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0)).buffer;

      const uploadResult = await this.digitalAssetUploadHelper.uploadAsset(
        buffer,
        command.filename,
        command.mimeType
      );

      // Load aggregate and attach digital asset
      const variantAggregate = DigitalDownloadableVariantAggregate.loadFromSnapshot(snapshot);
      const asset = {
        name: uploadResult.filename,
        fileKey: uploadResult.assetId,
        mimeType: command.mimeType,
        size: uploadResult.size,
      };
      variantAggregate.attachDigitalAsset(asset, command.userId);

      // Persist events
      for (const event of variantAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Update snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: variantAggregate.id,
        correlationId: snapshot.correlationId,
        version: variantAggregate.version,
        payload: variantAggregate.toSnapshot(),
      });

      // Add to outbox
      for (const event of variantAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }
}
