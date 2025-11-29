import type { Database } from "bun:sqlite";
import { EventRepository } from "./repositories/eventRepository";
import { SnapshotRepository } from "./repositories/snapshotRepository";
import { OutboxRepository } from "./repositories/outboxRepository";
import { CollectionsReadModelRepository } from "./repositories/readModels/collectionsReadModelRepository";
import { SlugRedirectReadModelRepository } from "./repositories/readModels/slugRedirectReadModelRepository";
import { SchedulesReadModelRepository } from "./repositories/readModels/schedulesReadModelRepository";
import { ProductsReadModelRepository } from "./repositories/readModels/productsReadModelRepository";
import { VariantsReadModelRepository } from "./repositories/readModels/variantsReadModelRepository";
import { CollectionProductsReadModelRepository } from "./repositories/readModels/collectionProductsReadModelRepository";
import { ProductVariantsReadModelRepository } from "./repositories/readModels/productVariantsReadModelRepository";
import { BundlesReadModelRepository } from "./repositories/readModels/bundlesReadModelRepository";
import { TransactionBatcher } from "./transactionBatcher";
import { TransactionBatch } from "./transactionBatch";
import { ProjectorDispatcher } from "./routers/projectorDispatcher";

export type UnitOfWorkRepositories = {
  eventRepository: EventRepository;
  snapshotRepository: SnapshotRepository;
  outboxRepository: OutboxRepository;
  collectionsReadModelRepository: CollectionsReadModelRepository;
  slugRedirectReadModelRepository: SlugRedirectReadModelRepository;
  schedulesReadModelRepository: SchedulesReadModelRepository;
  productsReadModelRepository: ProductsReadModelRepository;
  variantsReadModelRepository: VariantsReadModelRepository;
  collectionProductsReadModelRepository: CollectionProductsReadModelRepository;
  productVariantsReadModelRepository: ProductVariantsReadModelRepository;
  bundlesReadModelRepository: BundlesReadModelRepository;
};

export class UnitOfWork {
  private db: Database;
  private batcher: TransactionBatcher;
  private eventRepositoryFactory: typeof EventRepository;
  private snapshotRepositoryFactory: typeof SnapshotRepository;
  private outboxRepositoryFactory: typeof OutboxRepository;
  private CollectionsReadModelRepositoryFactory: typeof CollectionsReadModelRepository;
  private SlugRedirectReadModelRepositoryFactory: typeof SlugRedirectReadModelRepository;
  private SchedulesReadModelRepositoryFactory: typeof SchedulesReadModelRepository;
  private ProductsReadModelRepositoryFactory: typeof ProductsReadModelRepository;
  private VariantsReadModelRepositoryFactory: typeof VariantsReadModelRepository;
  private CollectionProductsReadModelRepositoryFactory: typeof CollectionProductsReadModelRepository;
  private ProductVariantsReadModelRepositoryFactory: typeof ProductVariantsReadModelRepository;
  private BundlesReadModelRepositoryFactory: typeof BundlesReadModelRepository;

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
    this.SlugRedirectReadModelRepositoryFactory = SlugRedirectReadModelRepository;
    this.SchedulesReadModelRepositoryFactory = SchedulesReadModelRepository;
    this.ProductsReadModelRepositoryFactory = ProductsReadModelRepository;
    this.VariantsReadModelRepositoryFactory = VariantsReadModelRepository;
    this.CollectionProductsReadModelRepositoryFactory = CollectionProductsReadModelRepository;
    this.ProductVariantsReadModelRepositoryFactory = ProductVariantsReadModelRepository;
    this.BundlesReadModelRepositoryFactory = BundlesReadModelRepository;
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
    const collectionsReadModelRepository =
      new this.CollectionsReadModelRepositoryFactory(this.db, batch);
    const slugRedirectReadModelRepository =
      new this.SlugRedirectReadModelRepositoryFactory(this.db, batch);
    const schedulesReadModelRepository =
      new this.SchedulesReadModelRepositoryFactory(this.db, batch);
    const productsReadModelRepository =
      new this.ProductsReadModelRepositoryFactory(this.db, batch);
    const variantsReadModelRepository =
      new this.VariantsReadModelRepositoryFactory(this.db, batch);
    const collectionProductsReadModelRepository =
      new this.CollectionProductsReadModelRepositoryFactory(this.db, batch);
    const productVariantsReadModelRepository =
      new this.ProductVariantsReadModelRepositoryFactory(this.db, batch);
    const bundlesReadModelRepository =
      new this.BundlesReadModelRepositoryFactory(this.db, batch);

    // Create the repositories object
    const repositories: UnitOfWorkRepositories = {
      eventRepository,
      snapshotRepository,
      outboxRepository,
      collectionsReadModelRepository,
      slugRedirectReadModelRepository,
      schedulesReadModelRepository,
      productsReadModelRepository,
      variantsReadModelRepository,
      collectionProductsReadModelRepository,
      productVariantsReadModelRepository,
      bundlesReadModelRepository,
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
