import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { ChangeDigitalDownloadableProductSlugCommand } from "./commands";
import { DigitalDownloadableProductAggregate } from "../../../../domain/digitalDownloadableProduct/aggregate";
import { SlugAggregate } from "../../../../domain/slug/slugAggregate";
import { randomUUIDv7 } from "bun";
import type { Service } from "../../../service";

export class ChangeDigitalDownloadableProductSlugService
  implements Service<ChangeDigitalDownloadableProductSlugCommand>
{
  constructor(private unitOfWork: UnitOfWork) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: ChangeDigitalDownloadableProductSlugCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } =
        repositories;

      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(
          `Digital downloadable product with id ${command.id} not found`
        );
      }
      if (snapshot.version !== command.expectedVersion) {
        throw new Error(
          `Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${snapshot.version}`
        );
      }

      const productAggregate =
        DigitalDownloadableProductAggregate.loadFromSnapshot(snapshot);
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

      // Reserve new slug
      newSlugAggregate.reserveSlug(
        command.id,
        "digital_downloadable_product",
        command.userId
      );

      // Release old slug
      const oldSlugSnapshot = snapshotRepository.getSnapshot(oldSlug);
      if (oldSlugSnapshot) {
        const oldSlugAggregate =
          SlugAggregate.loadFromSnapshot(oldSlugSnapshot);
        oldSlugAggregate.releaseSlug(command.userId);

        for (const event of oldSlugAggregate.uncommittedEvents) {
          eventRepository.addEvent(event);
        }

        snapshotRepository.saveSnapshot({
          aggregateId: oldSlugAggregate.id,
          correlationId: snapshot.correlationId,
          version: oldSlugAggregate.version,
          payload: oldSlugAggregate.toSnapshot(),
        });

        for (const event of oldSlugAggregate.uncommittedEvents) {
          outboxRepository.addOutboxEvent(event, {
            id: randomUUIDv7(),
          });
        }
      }

      // Update product with new slug
      productAggregate.changeSlug(command.newSlug, command.userId);

      // Save product events
      for (const event of productAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Save new slug events
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

      // Save new slug snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: newSlugAggregate.id,
        correlationId: snapshot.correlationId,
        version: newSlugAggregate.version,
        payload: newSlugAggregate.toSnapshot(),
      });

      // Add product events to outbox
      for (const event of productAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }

      // Add new slug events to outbox
      for (const event of newSlugAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }
}
