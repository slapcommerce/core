import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { CreateBundleCommand } from "./commands";
import { BundleAggregate } from "../../../../domain/bundle/aggregate";
import { SlugAggregate } from "../../../../domain/slug/slugAggregate";
import { CollectionAggregate } from "../../../../domain/collection/aggregate";
import { ProductPositionsWithinCollectionAggregate } from "../../../../domain/productPositionsWithinCollection/aggregate";
import { randomUUIDv7 } from "bun";
import type { Service } from "../../../service";

export class CreateBundleService implements Service<CreateBundleCommand> {
  constructor(private unitOfWork: UnitOfWork) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: CreateBundleCommand) {
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

      // Create bundle aggregate
      const bundleAggregate = BundleAggregate.create({
        ...command,
      });

      // Reserve slug in registry
      slugAggregate.reserveSlug(command.id, "bundle", command.userId);

      // Handle bundle events
      for (const event of bundleAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Handle slug aggregate events
      for (const event of slugAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Save bundle snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: bundleAggregate.id,
        correlationId: command.correlationId,
        version: bundleAggregate.version,
        payload: bundleAggregate.toSnapshot(),
      });

      // Save slug aggregate snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: slugAggregate.id,
        correlationId: command.correlationId,
        version: slugAggregate.version,
        payload: slugAggregate.toSnapshot(),
      });

      // Add all events to outbox
      for (const event of bundleAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
      for (const event of slugAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }

      // Add bundle to each collection's positions aggregate (bundles share positions with products)
      for (const collectionId of command.collections) {
        // Load collection to get the positions aggregate ID
        const collectionSnapshot = snapshotRepository.getSnapshot(collectionId);
        if (!collectionSnapshot) continue;

        const collectionAggregate = CollectionAggregate.loadFromSnapshot(collectionSnapshot);
        const positionsAggregateId = collectionAggregate.productPositionsAggregateId;
        if (!positionsAggregateId) continue;

        const positionsSnapshot = snapshotRepository.getSnapshot(positionsAggregateId);
        if (!positionsSnapshot) continue;

        const positionsAggregate =
          ProductPositionsWithinCollectionAggregate.loadFromSnapshot(positionsSnapshot);
        // Add bundle ID to positions (bundles share the same positions array as products)
        positionsAggregate.addProduct(command.id, command.userId);

        // Save positions events
        for (const event of positionsAggregate.uncommittedEvents) {
          eventRepository.addEvent(event);
        }

        // Save positions snapshot
        snapshotRepository.saveSnapshot({
          aggregateId: positionsAggregateId,
          correlationId: command.correlationId,
          version: positionsAggregate.version,
          payload: positionsAggregate.toSnapshot(),
        });

        // Add positions events to outbox
        for (const event of positionsAggregate.uncommittedEvents) {
          outboxRepository.addOutboxEvent(event, {
            id: randomUUIDv7(),
          });
        }
      }
    });
  }
}
