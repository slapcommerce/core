import type { Database } from "bun:sqlite";
import { EventRepository } from "./repositories/eventRepository";
import { SnapshotRepository } from "./repositories/snapshotRepository";
import { OutboxRepository } from "./repositories/outboxRepository";
import { ProductListViewRepository } from "./repositories/productListViewRepository";
import { ProductCollectionRepository } from "./repositories/productCollectionRepository";
import { ProductVariantRepository } from "./repositories/productVariantRepository";
import { SlugRedirectRepository } from "./repositories/slugRedirectRepository";
import { CollectionsListViewRepository } from "./repositories/collectionsListViewRepository";
import { ScheduleViewRepository } from "./repositories/scheduleViewRepository";
import { VariantDetailsViewRepository } from "./repositories/variantDetailsViewRepository";
import { TransactionBatcher } from "./transactionBatcher";
import { TransactionBatch } from "./transactionBatch";
import { ProjectionRouter } from "./routers/projectionRouter";

export type UnitOfWorkRepositories = {
  eventRepository: EventRepository;
  snapshotRepository: SnapshotRepository;
  outboxRepository: OutboxRepository;
  productListViewRepository: ProductListViewRepository;
  productCollectionRepository: ProductCollectionRepository;
  productVariantRepository: ProductVariantRepository;
  slugRedirectRepository: SlugRedirectRepository;
  collectionsListViewRepository: CollectionsListViewRepository;
  scheduleViewRepository: ScheduleViewRepository;
  variantDetailsViewRepository: VariantDetailsViewRepository;
};

export class UnitOfWork {
  private db: Database;
  private batcher: TransactionBatcher;
  private eventRepositoryFactory: typeof EventRepository;
  private snapshotRepositoryFactory: typeof SnapshotRepository;
  private outboxRepositoryFactory: typeof OutboxRepository;
  private productListViewRepositoryFactory: typeof ProductListViewRepository;
  private productCollectionRepositoryFactory: typeof ProductCollectionRepository;
  private productVariantRepositoryFactory: typeof ProductVariantRepository;
  private slugRedirectRepositoryFactory: typeof SlugRedirectRepository;
  private collectionsListViewRepositoryFactory: typeof CollectionsListViewRepository;
  private scheduleViewRepositoryFactory: typeof ScheduleViewRepository;
  private variantDetailsViewRepositoryFactory: typeof VariantDetailsViewRepository;

  constructor(
    db: Database,
    batcher: TransactionBatcher,
  ) {
    this.db = db;
    this.batcher = batcher;
    this.eventRepositoryFactory = EventRepository;
    this.snapshotRepositoryFactory = SnapshotRepository;
    this.outboxRepositoryFactory = OutboxRepository;
    this.productListViewRepositoryFactory = ProductListViewRepository;
    this.productCollectionRepositoryFactory = ProductCollectionRepository;
    this.productVariantRepositoryFactory = ProductVariantRepository;
    this.slugRedirectRepositoryFactory = SlugRedirectRepository;
    this.collectionsListViewRepositoryFactory = CollectionsListViewRepository;
    this.scheduleViewRepositoryFactory = ScheduleViewRepository;
    this.variantDetailsViewRepositoryFactory = VariantDetailsViewRepository;
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
    const productListViewRepository = new this.productListViewRepositoryFactory(
      this.db,
      batch,
    );
    const productCollectionRepository =
      new this.productCollectionRepositoryFactory(this.db, batch);
    const productVariantRepository = new this.productVariantRepositoryFactory(
      this.db,
      batch,
    );
    const slugRedirectRepository = new this.slugRedirectRepositoryFactory(
      this.db,
      batch,
    );
    const collectionsListViewRepository =
      new this.collectionsListViewRepositoryFactory(this.db, batch);
    const scheduleViewRepository = new this.scheduleViewRepositoryFactory(
      this.db,
      batch,
    );
    const variantDetailsViewRepository = new this.variantDetailsViewRepositoryFactory(
      this.db,
      batch,
    );

    // Create the repositories object
    const repositories: UnitOfWorkRepositories = {
      eventRepository,
      snapshotRepository,
      outboxRepository,
      productListViewRepository,
      productCollectionRepository,
      productVariantRepository,
      slugRedirectRepository,
      collectionsListViewRepository,
      scheduleViewRepository,
      variantDetailsViewRepository,
    };

    try {
      // Execute the work callback with repositories
      await work(repositories);

      // Auto-route all uncommitted events to projections
      const projectionRouter = ProjectionRouter.create(repositories);
      for (const event of eventRepository.uncommittedEvents) {
        await projectionRouter.route(event);
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
