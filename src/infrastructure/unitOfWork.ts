import type { Database } from "bun:sqlite"
import { EventRepository, SnapshotRepository, OutboxRepository } from "./repository"
import { ProductListViewRepository } from "./productListViewRepository"
import { TransactionBatcher } from "./transactionBatcher"
import { TransactionBatch } from "./transactionBatch"

export class UnitOfWork {
  private db: Database
  private batcher: TransactionBatcher
  private eventRepositoryFactory: typeof EventRepository
  private snapshotRepositoryFactory: typeof SnapshotRepository
  private outboxRepositoryFactory: typeof OutboxRepository
  private productListViewRepositoryFactory: typeof ProductListViewRepository

  constructor(db: Database, batcher: TransactionBatcher) {
    this.db = db
    this.batcher = batcher
    this.eventRepositoryFactory = EventRepository
    this.snapshotRepositoryFactory = SnapshotRepository
    this.outboxRepositoryFactory = OutboxRepository
    this.productListViewRepositoryFactory = ProductListViewRepository
  }

  async withTransaction(work: ({ 
    eventRepository, 
    snapshotRepository, 
    outboxRepository,
    productListViewRepository
  }: { 
    eventRepository: EventRepository
    snapshotRepository: SnapshotRepository
    outboxRepository: OutboxRepository
    productListViewRepository: ProductListViewRepository
  }) => Promise<void>) {
    // Create a new batch for this transaction
    const batch = new TransactionBatch()

    // Create repositories with the batch for command queueing
    // All repositories share the same batch for atomic transactions
    const eventRepository = new this.eventRepositoryFactory(this.db, batch)
    const snapshotRepository = new this.snapshotRepositoryFactory(this.db, batch)
    const outboxRepository = new this.outboxRepositoryFactory(this.db, batch)
    const productListViewRepository = new this.productListViewRepositoryFactory(this.db, batch)

    try {
      // Execute the work callback (repositories will queue commands)
      await work({ eventRepository, snapshotRepository, outboxRepository, productListViewRepository })

      // Enqueue the batch for background flushing
      this.batcher.enqueueBatch(batch)

      // Wait for the batch to be flushed
      await batch.promise
    } catch (error) {
      // If the work callback throws, reject the batch
      batch.reject(error instanceof Error ? error : new Error(String(error)))
      // Handle the promise rejection to prevent unhandled rejection warnings
      batch.promise.catch(() => {})
      throw error
    }
  }
}