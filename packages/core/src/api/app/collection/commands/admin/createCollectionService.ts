import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { CreateCollectionCommand } from "./commands";
import { CollectionAggregate } from "../../../../domain/collection/aggregate";
import { SlugAggregate } from "../../../../domain/slug/slugAggregate";
import { ProductPositionsWithinCollectionAggregate } from "../../../../domain/productPositionsWithinCollection/aggregate";
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

      // Generate ID for the product positions aggregate
      const productPositionsAggregateId = randomUUIDv7();

      // Create collection aggregate with reference to positions aggregate
      const collectionAggregate = CollectionAggregate.create({
        id: command.id,
        correlationId: command.correlationId,
        userId: command.userId,
        name: command.name,
        description: command.description,
        slug: command.slug,
        productPositionsAggregateId,
      });

      // Reserve slug in registry
      slugAggregate.reserveSlug(command.id, "collection", command.userId);

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
        aggregateId: collectionAggregate.id,
        correlationId: command.correlationId,
        version: collectionAggregate.version,
        payload: collectionAggregate.toSnapshot(),
      });

      // Save slug aggregate snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: slugAggregate.id,
        correlationId: command.correlationId,
        version: slugAggregate.version,
        payload: slugAggregate.toSnapshot(),
      });

      // Create empty ProductPositionsWithinCollection aggregate
      const positionsAggregate = ProductPositionsWithinCollectionAggregate.create({
        id: productPositionsAggregateId,
        collectionId: command.id,
        correlationId: command.correlationId,
        userId: command.userId,
        productIds: [],
      });

      // Handle positions aggregate events
      for (const event of positionsAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Save positions aggregate snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: productPositionsAggregateId,
        correlationId: command.correlationId,
        version: positionsAggregate.version,
        payload: positionsAggregate.toSnapshot(),
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
      for (const event of positionsAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }
}
