import type { UnitOfWork } from "../../infrastructure/unitOfWork";
import type { ReorderCollectionImagesCommand } from "./commands";
import type { ProjectionService } from "../../infrastructure/projectionService";
import { CollectionAggregate } from "../../domain/collection/aggregate";
import { randomUUIDv7 } from "bun";
import type { AccessLevel } from "../accessLevel";


export class ReorderCollectionImagesService {
  accessLevel: AccessLevel = "admin";

  constructor(
    private unitOfWork: UnitOfWork,
    private projectionService: ProjectionService
  ) {}

  async execute(command: ReorderCollectionImagesCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } =
        repositories;

      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(`Collection with id ${command.id} not found`);
      }

      if (snapshot.version !== command.expectedVersion) {
        throw new Error(
          `Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${snapshot.version}`
        );
      }

      // Load aggregate and reorder images
      const collectionAggregate = CollectionAggregate.loadFromSnapshot(snapshot);
      const currentImages = collectionAggregate.images;
      const updatedImages = currentImages.reorder(command.orderedImageIds);
      collectionAggregate.updateImages(updatedImages, command.userId);

      // Persist events
      for (const event of collectionAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
        await this.projectionService.handleEvent(event, repositories);
      }

      // Update snapshot
      snapshotRepository.saveSnapshot({
        aggregate_id: collectionAggregate.id,
        correlation_id: snapshot.correlation_id,
        version: collectionAggregate.version,
        payload: collectionAggregate.toSnapshot(),
      });

      // Add to outbox
      for (const event of collectionAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }
}
