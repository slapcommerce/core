import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { ChangeBundleSlugCommand } from "./commands";
import { BundleAggregate } from "../../../../domain/bundle/aggregate";
import { SlugAggregate } from "../../../../domain/slug/slugAggregate";
import { randomUUIDv7 } from "bun";
import type { Service } from "../../../service";

export class ChangeBundleSlugService implements Service<ChangeBundleSlugCommand> {
  constructor(private unitOfWork: UnitOfWork) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: ChangeBundleSlugCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;

      // Load bundle aggregate
      const bundleSnapshot = snapshotRepository.getSnapshot(command.id);
      if (!bundleSnapshot) {
        throw new Error(`Bundle with id ${command.id} not found`);
      }
      if (bundleSnapshot.version !== command.expectedVersion) {
        throw new Error(
          `Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${bundleSnapshot.version}`,
        );
      }
      const bundleAggregate = BundleAggregate.loadFromSnapshot(bundleSnapshot);
      const oldSlug = bundleAggregate.slug;

      // Check if slug is different first
      if (oldSlug === command.newSlug) {
        throw new Error("New slug must be different from current slug");
      }

      // Load or create new slug aggregate
      const newSlugSnapshot = snapshotRepository.getSnapshot(command.newSlug);
      let newSlugAggregate: SlugAggregate;
      if (!newSlugSnapshot) {
        newSlugAggregate = SlugAggregate.create({
          slug: command.newSlug,
          correlationId: bundleSnapshot.correlationId,
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

      // Change slug on bundle aggregate
      bundleAggregate.changeSlug(command.newSlug, command.userId);

      // Reserve new slug and mark old slug as redirected
      newSlugAggregate.reserveSlug(command.id, "bundle", command.userId);
      oldSlugAggregate.markAsRedirect(command.newSlug, command.userId);

      // Handle bundle events
      for (const event of bundleAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Handle slug aggregates events
      for (const event of newSlugAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }
      for (const event of oldSlugAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Save bundle snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: bundleAggregate.id,
        correlationId: bundleSnapshot.correlationId,
        version: bundleAggregate.version,
        payload: bundleAggregate.toSnapshot(),
      });

      // Save new slug snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: newSlugAggregate.id,
        correlationId: newSlugAggregate.id,
        version: newSlugAggregate.version,
        payload: newSlugAggregate.toSnapshot(),
      });

      // Save old slug snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: oldSlugAggregate.id,
        correlationId: oldSlugAggregate.id,
        version: oldSlugAggregate.version,
        payload: oldSlugAggregate.toSnapshot(),
      });

      // Add all events to outbox
      for (const event of bundleAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
      for (const event of newSlugAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
      for (const event of oldSlugAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }
}
