import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { UpdateCollectionMetadataCommand } from "./commands";
import { CollectionAggregate } from "../../../../domain/collection/aggregate";
import { SlugAggregate } from "../../../../domain/slug/slugAggregate";
import { randomUUIDv7 } from "bun";

export class UpdateCollectionMetadataService {

  constructor(
    private unitOfWork: UnitOfWork,

  ) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: UpdateCollectionMetadataCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;
      
      // Load collection aggregate
      const collectionSnapshot = snapshotRepository.getSnapshot(command.id);
      if (!collectionSnapshot) {
        throw new Error(`Collection with id ${command.id} not found`);
      }
      if (collectionSnapshot.version !== command.expectedVersion) {
        throw new Error(`Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${collectionSnapshot.version}`);
      }
      const collectionAggregate = CollectionAggregate.loadFromSnapshot(collectionSnapshot);
      const oldSlug = collectionAggregate.slug;
      const collectionStatus = collectionAggregate.toSnapshot().status;

      // Handle slug change if different
      let newSlugAggregate: SlugAggregate | null = null;
      let oldSlugAggregate: SlugAggregate | null = null;

      if (oldSlug !== command.newSlug) {
        // Load or create new slug aggregate
        const newSlugSnapshot = snapshotRepository.getSnapshot(command.newSlug);
        if (!newSlugSnapshot) {
          newSlugAggregate = SlugAggregate.create({
            slug: command.newSlug,
            correlationId: collectionSnapshot.correlationId,
          });
        } else {
          newSlugAggregate = SlugAggregate.loadFromSnapshot(newSlugSnapshot);
        }

        // Check if new slug is available
        if (!newSlugAggregate.isSlugAvailable()) {
          throw new Error(`Slug "${command.newSlug}" is already in use`);
        }

        // Load old slug aggregate
        const oldSlugSnapshot = snapshotRepository.getSnapshot(oldSlug);
        if (!oldSlugSnapshot) {
          throw new Error(`Old slug "${oldSlug}" not found`);
        }
        oldSlugAggregate = SlugAggregate.loadFromSnapshot(oldSlugSnapshot);

        // Reserve new slug
        newSlugAggregate.reserveSlug(command.id, command.userId);

        // For draft collections: release old slug (no redirect)
        // For active collections: mark old slug as redirected
        if (collectionStatus === "draft") {
          oldSlugAggregate.releaseSlug(command.userId);
        } else {
          oldSlugAggregate.markAsRedirect(command.newSlug, command.userId);
        }
      }

      // Update metadata on collection aggregate
      collectionAggregate.updateMetadata(command.name, command.description, command.newSlug, command.userId);

      // Handle collection events and projections
      for (const event of collectionAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Handle slug aggregates events and projections if slug changed
      if (newSlugAggregate) {
        for (const event of newSlugAggregate.uncommittedEvents) {
          eventRepository.addEvent(event);
        }
      }
      if (oldSlugAggregate) {
        for (const event of oldSlugAggregate.uncommittedEvents) {
          eventRepository.addEvent(event);
        }
      }

      // Save collection snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: collectionAggregate.id,
        correlationId: collectionSnapshot.correlationId,
        version: collectionAggregate.version,
        payload: collectionAggregate.toSnapshot(),
      });

      // Save new slug snapshot if slug changed
      if (newSlugAggregate) {
        snapshotRepository.saveSnapshot({
          aggregateId: newSlugAggregate.id,
          correlationId: newSlugAggregate.id, // Use slug as correlationId for slug aggregates
          version: newSlugAggregate.version,
          payload: newSlugAggregate.toSnapshot(),
        });
      }

      // Save old slug snapshot if slug changed
      if (oldSlugAggregate) {
        snapshotRepository.saveSnapshot({
          aggregateId: oldSlugAggregate.id,
          correlationId: oldSlugAggregate.id, // Use slug as correlationId for slug aggregates
          version: oldSlugAggregate.version,
          payload: oldSlugAggregate.toSnapshot(),
        });
      }

      // Add all events to outbox
      for (const event of collectionAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
      if (newSlugAggregate) {
        for (const event of newSlugAggregate.uncommittedEvents) {
          outboxRepository.addOutboxEvent(event, {
            id: randomUUIDv7(),
          });
        }
      }
      if (oldSlugAggregate) {
        for (const event of oldSlugAggregate.uncommittedEvents) {
          outboxRepository.addOutboxEvent(event, {
            id: randomUUIDv7(),
          });
        }
      }
    });
  }
}
