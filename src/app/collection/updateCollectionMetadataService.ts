import type { UnitOfWork } from "../../infrastructure/unitOfWork";
import type { UpdateCollectionMetadataCommand } from "./commands";
import type { ProjectionService } from "../../infrastructure/projectionService";
import { CollectionAggregate } from "../../domain/collection/aggregate";
import { SlugAggregate } from "../../domain/slug/slugAggregate";
import { randomUUIDv7 } from "bun";

export class UpdateCollectionMetadataService {
  constructor(
    private unitOfWork: UnitOfWork,
    private projectionService: ProjectionService
  ) {
    this.unitOfWork = unitOfWork;
    this.projectionService = projectionService;
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

      // Handle slug change if different
      let newSlugAggregate: SlugAggregate | null = null;
      let oldSlugAggregate: SlugAggregate | null = null;

      if (oldSlug !== command.newSlug) {
        // Load or create new slug aggregate
        const newSlugSnapshot = snapshotRepository.getSnapshot(command.newSlug);
        if (!newSlugSnapshot) {
          newSlugAggregate = SlugAggregate.create({
            slug: command.newSlug,
            correlationId: collectionSnapshot.correlation_id,
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

        // Reserve new slug and mark old slug as redirected
        newSlugAggregate.reserveSlug(command.id);
        oldSlugAggregate.markAsRedirect(command.newSlug);
      }

      // Update metadata on collection aggregate
      collectionAggregate.updateMetadata(command.name, command.description, command.newSlug);

      // Handle collection events and projections
      for (const event of collectionAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
        await this.projectionService.handleEvent(event, repositories);
      }

      // Handle slug aggregates events and projections if slug changed
      if (newSlugAggregate) {
        for (const event of newSlugAggregate.uncommittedEvents) {
          eventRepository.addEvent(event);
          await this.projectionService.handleEvent(event, repositories);
        }
      }
      if (oldSlugAggregate) {
        for (const event of oldSlugAggregate.uncommittedEvents) {
          eventRepository.addEvent(event);
          await this.projectionService.handleEvent(event, repositories);
        }
      }

      // Save collection snapshot
      snapshotRepository.saveSnapshot({
        aggregate_id: collectionAggregate.id,
        correlation_id: collectionSnapshot.correlation_id,
        version: collectionAggregate.version,
        payload: collectionAggregate.toSnapshot(),
      });

      // Save new slug snapshot if slug changed
      if (newSlugAggregate) {
        snapshotRepository.saveSnapshot({
          aggregate_id: newSlugAggregate.id,
          correlation_id: newSlugAggregate.id, // Use slug as correlation_id for slug aggregates
          version: newSlugAggregate.version,
          payload: newSlugAggregate.toSnapshot(),
        });
      }

      // Save old slug snapshot if slug changed
      if (oldSlugAggregate) {
        snapshotRepository.saveSnapshot({
          aggregate_id: oldSlugAggregate.id,
          correlation_id: oldSlugAggregate.id, // Use slug as correlation_id for slug aggregates
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

