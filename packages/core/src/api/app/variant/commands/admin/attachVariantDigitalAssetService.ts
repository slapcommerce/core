import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { AttachVariantDigitalAssetCommand } from "./commands";
import type { DigitalAssetUploadHelper } from "../../../../infrastructure/digitalAssetUploadHelper";
import { VariantAggregate } from "../../../../domain/variant/aggregate";
import { randomUUIDv7 } from "bun";
import type { Service } from "../../../service";

export class AttachVariantDigitalAssetService implements Service<AttachVariantDigitalAssetCommand> {

  constructor(
    private unitOfWork: UnitOfWork,

    private digitalAssetUploadHelper: DigitalAssetUploadHelper
  ) {}

  async execute(command: AttachVariantDigitalAssetCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } =
        repositories;

      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(`Variant with id ${command.id} not found`);
      }

      if (snapshot.version !== command.expectedVersion) {
        throw new Error(
          `Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${snapshot.version}`
        );
      }

      // Load the product to check fulfillmentType
      const variantPayload = JSON.parse(snapshot.payload);
      const productSnapshot = snapshotRepository.getSnapshot(
        variantPayload.productId
      );
      if (!productSnapshot) {
        throw new Error(
          `Product with id ${variantPayload.productId} not found`
        );
      }
      const productPayload = JSON.parse(productSnapshot.payload);
      if (productPayload.fulfillmentType !== "digital") {
        throw new Error(
          `Cannot attach digital asset to variant: product fulfillmentType must be "digital" but is "${productPayload.fulfillmentType}"`
        );
      }

      // Decode base64 data and upload asset
      const base64Data = command.assetData.replace(/^data:[^;]+;base64,/, "");
      const buffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0))
        .buffer;

      const uploadResult = await this.digitalAssetUploadHelper.uploadAsset(
        buffer,
        command.filename,
        command.mimeType
      );

      // Load aggregate and attach digital asset
      const variantAggregate = VariantAggregate.loadFromSnapshot(snapshot);
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