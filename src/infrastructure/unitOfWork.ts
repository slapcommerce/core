import type { Database } from "bun:sqlite"
import { EventRepository } from "./repository"
import { TransactionBatcher } from "./transactionBatcher"
import { TransactionBatch } from "./transactionBatch"

export class UnitOfWork {
  private db: Database
  private batcher: TransactionBatcher
  private eventRepositoryFactory: typeof EventRepository

  constructor(db: Database, batcher: TransactionBatcher) {
    this.db = db
    this.batcher = batcher
    this.eventRepositoryFactory = EventRepository
  }

  async withTransaction(work: ({ eventRepository }: { eventRepository: EventRepository }) => Promise<void>) {
    // Create a new batch for this transaction
    const batch = new TransactionBatch()

    // Create repository with the batch for command queueing
    const eventRepository = new this.eventRepositoryFactory(this.db, batch)

    try {
      // Execute the work callback (repositories will queue commands)
      await work({ eventRepository })

      // Enqueue the batch for background flushing
      this.batcher.enqueueBatch(batch)

      // Wait for the batch to be flushed
      await batch.promise
    } catch (error) {
      // If the work callback throws, reject the batch
      batch.reject(error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }
}