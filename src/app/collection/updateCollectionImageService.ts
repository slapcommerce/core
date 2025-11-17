import type { UnitOfWork } from "../../infrastructure/unitOfWork";
import type { UpdateCollectionImageCommand } from "./commands";
import type { ProjectionService } from "../../infrastructure/projectionService";
import type { ImageUploadHelper } from "../../infrastructure/imageUploadHelper";
import type { ImageUploadResult } from "../../infrastructure/adapters/imageStorageAdapter";
import { CollectionAggregate } from "../../domain/collection/aggregate";
import { randomUUIDv7 } from "bun";

export class UpdateCollectionImageService {
  constructor(
    private unitOfWork: UnitOfWork,
    private projectionService: ProjectionService,
    private imageUploadHelper?: ImageUploadHelper
  ) {
    this.unitOfWork = unitOfWork;
    this.projectionService = projectionService;
    this.imageUploadHelper = imageUploadHelper;
  }

  async execute(command: UpdateCollectionImageCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;
      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(`Collection with id ${command.id} not found`);
      }
      if (snapshot.version !== command.expectedVersion) {
        throw new Error(`Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${snapshot.version}`);
      }
      
      let imageUrls: ImageUploadResult['urls'] | null = null;
      
      // If image data is provided, upload it using the imageUploadHelper
      if (command.imageData && command.filename && command.contentType) {
        if (!this.imageUploadHelper) {
          throw new Error("Image upload helper is required but not provided");
        }
        
        // Convert base64 string to ArrayBuffer
        const base64Data = command.imageData.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0)).buffer;
        
        // Upload the image
        const uploadResult = await this.imageUploadHelper.uploadImage(
          buffer,
          command.filename,
          command.contentType
        );
        
        // Store all optimized image URLs
        imageUrls = uploadResult.urls;
      }
      
      const collectionAggregate = CollectionAggregate.loadFromSnapshot(snapshot);
      collectionAggregate.updateImage(imageUrls, command.userId);

      for (const event of collectionAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
        await this.projectionService.handleEvent(event, repositories);
      }

      snapshotRepository.saveSnapshot({
        aggregate_id: collectionAggregate.id,
        correlation_id: snapshot.correlation_id,
        version: collectionAggregate.version,
        payload: collectionAggregate.toSnapshot(),
      });

      for (const event of collectionAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }
}

