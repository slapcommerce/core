import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { ChangeDropshipProductSlugCommand } from "./commands";
import { DropshipProductAggregate } from "../../../../domain/dropshipProduct/aggregate";
import { SlugAggregate } from "../../../../domain/slug/slugAggregate";
import { randomUUIDv7 } from "bun";
import type { Service } from "../../../service";

export class ChangeDropshipProductSlugService
  implements Service<ChangeDropshipProductSlugCommand>
{
  constructor(private unitOfWork: UnitOfWork) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: ChangeDropshipProductSlugCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } =
        repositories;

      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(`Dropship product with id ${command.id} not found`);
      }
      if (snapshot.version !== command.expectedVersion) {
        throw new Error(
          `Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${snapshot.version}`
        );
      }

      const productAggregate =
        DropshipProductAggregate.loadFromSnapshot(snapshot);
      const oldSlug = productAggregate.slug;

      // Load or create new slug aggregate
      const newSlugSnapshot = snapshotRepository.getSnapshot(command.newSlug);
      let newSlugAggregate: SlugAggregate;
      if (!newSlugSnapshot) {
        newSlugAggregate = SlugAggregate.create({
          slug: command.newSlug,
          correlationId: snapshot.correlationId,
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
      const oldSlugAggregate = SlugAggregate.loadFromSnapshot(oldSlugSnapshot);

      // Release old slug
      oldSlugAggregate.releaseSlug(command.userId);

      // Reserve new slug
      newSlugAggregate.reserveSlug(
        command.id,
        "dropship_product",
        command.userId
      );

      // Update product slug
      productAggregate.changeSlug(command.newSlug, command.userId);

      // Handle product events
      for (const event of productAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Handle old slug aggregate events
      for (const event of oldSlugAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Handle new slug aggregate events
      for (const event of newSlugAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Save product snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: productAggregate.id,
        correlationId: snapshot.correlationId,
        version: productAggregate.version,
        payload: productAggregate.toSnapshot(),
      });

      // Save old slug aggregate snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: oldSlugAggregate.id,
        correlationId: snapshot.correlationId,
        version: oldSlugAggregate.version,
        payload: oldSlugAggregate.toSnapshot(),
      });

      // Save new slug aggregate snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: newSlugAggregate.id,
        correlationId: snapshot.correlationId,
        version: newSlugAggregate.version,
        payload: newSlugAggregate.toSnapshot(),
      });

      // Add all events to outbox
      for (const event of productAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
      for (const event of oldSlugAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
      for (const event of newSlugAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }
}
