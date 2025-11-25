import type { Database } from "bun:sqlite";
import { EventRepository } from "./repositories/eventRepository";
import { SnapshotRepository } from "./repositories/snapshotRepository";
import { OutboxRepository } from "./repositories/outboxRepository";
import { CollectionsReadModelRepository } from "./repositories/readModels/collectionsReadModelRepository";
import { SlugRedirectRepository } from "./repositories/slugRedirectRepository";
import { TransactionBatcher } from "./transactionBatcher";
import { TransactionBatch } from "./transactionBatch";
import { ProjectorDispatcher } from "./routers/projectorDispatcher";

export type UnitOfWorkRepositories = {
  eventRepository: EventRepository;
  snapshotRepository: SnapshotRepository;
  outboxRepository: OutboxRepository;
  CollectionsReadModelRepository: CollectionsReadModelRepository;
  SlugRedirectRepository: SlugRedirectRepository;
};

export class UnitOfWork {
  private db: Database;
  private batcher: TransactionBatcher;
  private eventRepositoryFactory: typeof EventRepository;
  private snapshotRepositoryFactory: typeof SnapshotRepository;
  private outboxRepositoryFactory: typeof OutboxRepository;
  private CollectionsReadModelRepositoryFactory: typeof CollectionsReadModelRepository;
  private SlugRedirectRepositoryFactory: typeof SlugRedirectRepository;

  constructor(
    db: Database,
    batcher: TransactionBatcher,
  ) {
    this.db = db;
    this.batcher = batcher;
    this.eventRepositoryFactory = EventRepository;
    this.snapshotRepositoryFactory = SnapshotRepository;
    this.outboxRepositoryFactory = OutboxRepository;
    this.CollectionsReadModelRepositoryFactory = CollectionsReadModelRepository;
    this.SlugRedirectRepositoryFactory = SlugRedirectRepository;
  }

  async withTransaction(
    work: (
      repositories: UnitOfWorkRepositories,
    ) => Promise<void>,
  ) {
    // Create a new batch for this transaction
    const batch = new TransactionBatch();

    // Create repositories with the batch for command queueing
    // All repositories share the same batch for atomic transactions
    const eventRepository = new this.eventRepositoryFactory(this.db, batch);
    const snapshotRepository = new this.snapshotRepositoryFactory(
      this.db,
      batch,
    );
    const outboxRepository = new this.outboxRepositoryFactory(this.db, batch);
    const CollectionsReadModelRepository =
      new this.CollectionsReadModelRepositoryFactory(this.db, batch);
    const slugRedirectRepository =
      new this.SlugRedirectRepositoryFactory(this.db, batch);

    // Create the repositories object
    const repositories: UnitOfWorkRepositories = {
      eventRepository,
      snapshotRepository,
      outboxRepository,
      CollectionsReadModelRepository,
      SlugRedirectRepository: slugRedirectRepository,
    };

    try {
      // Execute the work callback with repositories
      await work(repositories);

      // Auto-dispatch all uncommitted events to projectors
      const projectorDispatcher = ProjectorDispatcher.create(repositories);
      for (const event of eventRepository.uncommittedEvents) {
        await projectorDispatcher.dispatch(event);
      }

      // Enqueue the batch for background flushing
      this.batcher.enqueueBatch(batch);

      // Wait for the batch to be flushed
      await batch.promise;
    } catch (error) {
      // If the work callback throws, reject the batch
      batch.reject(error instanceof Error ? error : new Error(String(error)));
      // Handle the promise rejection to prevent unhandled rejection warnings
      batch.promise.catch(() => { });
      throw error;
    }
  }
}
