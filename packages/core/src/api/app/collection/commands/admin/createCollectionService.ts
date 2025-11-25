import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { CreateCollectionCommand } from "./commands";
import { CollectionAggregate } from "../../../../domain/collection/aggregate";
import { SlugAggregate } from "../../../../domain/slug/slugAggregate";
import { randomUUIDv7 } from "bun";

export class CreateCollectionService {

  constructor(
    private unitOfWork: UnitOfWork,

  ) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: CreateCollectionCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;
      
      // Load or create slug aggregate
      const slugSnapshot = snapshotRepository.getSnapshot(command.slug);
      let slugAggregate: SlugAggregate;
      if (!slugSnapshot) {
        slugAggregate = SlugAggregate.create({
          slug: command.slug,
          correlationId: command.correlationId,
        });
      } else {
        slugAggregate = SlugAggregate.loadFromSnapshot(slugSnapshot);
      }

      // Check if slug is available
      if (!slugAggregate.isSlugAvailable()) {
        throw new Error(`Slug "${command.slug}" is already in use`);
      }

      // Create collection aggregate
      const collectionAggregate = CollectionAggregate.create({
        id: command.id,
        correlationId: command.correlationId,
        userId: command.userId,
        name: command.name,
        description: command.description,
        slug: command.slug,
      });
      
      // Reserve slug in registry
      slugAggregate.reserveSlug(command.id, command.userId);

      // Handle collection events and projections
      for (const event of collectionAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Handle slug aggregate events and projections
      for (const event of slugAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Save collection snapshot
      snapshotRepository.saveSnapshot({
        aggregate_id: collectionAggregate.id,
        correlation_id: command.correlationId,
        version: collectionAggregate.version,
        payload: collectionAggregate.toSnapshot(),
      });

      // Save slug aggregate snapshot
      snapshotRepository.saveSnapshot({
        aggregate_id: slugAggregate.id,
        correlation_id: command.correlationId,
        version: slugAggregate.version,
        payload: slugAggregate.toSnapshot(),
      });

      // Add all events to outbox
      for (const event of collectionAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
      for (const event of slugAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }
}
