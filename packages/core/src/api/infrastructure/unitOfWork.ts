import type { Database } from "bun:sqlite";
import { EventRepository } from "./repositories/eventRepository";
import { SnapshotRepository } from "./repositories/snapshotRepository";
import { OutboxRepository } from "./repositories/outboxRepository";
import { ProductsReadModelRepository } from "./repositories/productsReadModelRepository";
import { ProductCollectionRepository } from "./repositories/productCollectionRepository";
import { variantsRepository } from "./repositories/variantsRepository";
import { SlugRedirectRepository } from "./repositories/slugRedirectRepository";
import { CollectionsReadModelRepository } from "./repositories/collectionsReadModelRepository";
import { SchedulesReadModelRepository } from "./repositories/schedulesReadModelRepository";
import { VariantDetailsReadModelRepository } from "./repositories/variantDetailsReadModelRepository";
import { TransactionBatcher } from "./transactionBatcher";
import { TransactionBatch } from "./transactionBatch";
import { ProjectorDispatcher } from "./routers/projectorDispatcher";

export type UnitOfWorkRepositories = {
  eventRepository: EventRepository;
  snapshotRepository: SnapshotRepository;
  outboxRepository: OutboxRepository;
  ProductsReadModelRepository: ProductsReadModelRepository;
  productCollectionRepository: ProductCollectionRepository;
  productVariantRepository: variantsRepository;
  slugRedirectRepository: SlugRedirectRepository;
  CollectionsReadModelRepository: CollectionsReadModelRepository;
  scheduleReadModelRepository: SchedulesReadModelRepository;
  variantDetailsReadModelRepository: VariantDetailsReadModelRepository;
};

export class UnitOfWork {
  private db: Database;
  private batcher: TransactionBatcher;
  private eventRepositoryFactory: typeof EventRepository;
  private snapshotRepositoryFactory: typeof SnapshotRepository;
  private outboxRepositoryFactory: typeof OutboxRepository;
  private ProductsReadModelRepositoryFactory: typeof ProductsReadModelRepository;
  private productCollectionRepositoryFactory: typeof ProductCollectionRepository;
  private productVariantRepositoryFactory: typeof variantsRepository;
  private slugRedirectRepositoryFactory: typeof SlugRedirectRepository;
  private CollectionsReadModelRepositoryFactory: typeof CollectionsReadModelRepository;
  private scheduleReadModelRepositoryFactory: typeof SchedulesReadModelRepository;
  private variantDetailsReadModelRepositoryFactory: typeof VariantDetailsReadModelRepository;

  constructor(
    db: Database,
    batcher: TransactionBatcher,
  ) {
    this.db = db;
    this.batcher = batcher;
    this.eventRepositoryFactory = EventRepository;
    this.snapshotRepositoryFactory = SnapshotRepository;
    this.outboxRepositoryFactory = OutboxRepository;
    this.ProductsReadModelRepositoryFactory = ProductsReadModelRepository;
    this.productCollectionRepositoryFactory = ProductCollectionRepository;
    this.productVariantRepositoryFactory = variantsRepository;
    this.slugRedirectRepositoryFactory = SlugRedirectRepository;
    this.CollectionsReadModelRepositoryFactory = CollectionsReadModelRepository;
    this.scheduleReadModelRepositoryFactory = SchedulesReadModelRepository;
    this.variantDetailsReadModelRepositoryFactory = VariantDetailsReadModelRepository;
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
    const ProductsReadModelRepository = new this.ProductsReadModelRepositoryFactory(
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
    const CollectionsReadModelRepository =
      new this.CollectionsReadModelRepositoryFactory(this.db, batch);
    const scheduleReadModelRepository = new this.scheduleReadModelRepositoryFactory(
      this.db,
      batch,
    );
    const variantDetailsReadModelRepository = new this.variantDetailsReadModelRepositoryFactory(
      this.db,
      batch,
    );

    // Create the repositories object
    const repositories: UnitOfWorkRepositories = {
      eventRepository,
      snapshotRepository,
      outboxRepository,
      ProductsReadModelRepository,
      productCollectionRepository,
      productVariantRepository,
      slugRedirectRepository,
      CollectionsReadModelRepository,
      scheduleReadModelRepository,
      variantDetailsReadModelRepository,
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
