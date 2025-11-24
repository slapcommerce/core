import type { Database } from 'bun:sqlite'
import { TransactionBatch } from './transactionBatch'

export interface BatcherConfig {
  /** Time interval in milliseconds to trigger a flush (default: 50ms) */
  flushIntervalMs: number

  /** Number of batches to trigger a size-based flush (default: 100) */
  batchSizeThreshold: number

  /**
   * Maximum number of batches allowed in the queue (default: 1000)
   *
   * This provides backpressure to prevent unbounded memory growth if the batcher
   * cannot flush fast enough. When the queue reaches this limit, new withTransaction()
   * calls will be immediately rejected with an error.
   *
   * Without this limit, a surge of transactions could consume all available memory
   * if the flush rate cannot keep up with the enqueue rate.
   *
   * Example scenario: If your application suddenly receives 10,000 concurrent requests,
   * and the batcher can only flush 100 transactions per 50ms (2000/sec), the queue
   * would grow to 8,000+ batches before stabilizing. With maxQueueDepth: 1000, the
   * excess requests fail fast instead of accumulating in memory.
   */
  maxQueueDepth: number
}

/**
 * TransactionBatcher provides background transaction batching for SQLite.
 *
 * Key behaviors:
 * - Multiple concurrent withTransaction() calls can be open simultaneously
 * - Commands are queued and flushed in batches (not executed immediately)
 * - withTransaction() blocks until the batch is flushed to the database
 * - Flushes are triggered by time (50ms default) OR size (100 batches default)
 * - Failed transactions are isolated via binary search and rejected individually
 * - FIFO ordering is maintained across all concurrent transactions
 *
 * This design trades latency (max 50ms delay) for higher throughput by:
 * - Reducing SQLite transaction overhead (one BEGIN/COMMIT per batch)
 * - Better WAL mode utilization (fewer checkpoint operations)
 * - Reducing lock contention (multiple callers share a single transaction)
 *
 * Usage:
 * ```typescript
 * const batcher = new TransactionBatcher(db)
 * batcher.start()
 *
 * const unitOfWork = new UnitOfWork(db, batcher)
 * await unitOfWork.withTransaction(async ({ eventRepository }) => {
 *   eventRepository.addEvent(...)
 * })
 * // Returns only after data is committed to database
 * ```
 */
export class TransactionBatcher {
  private readonly db: Database
  private readonly config: BatcherConfig
  private readonly queue: TransactionBatch[] = []
  private flushTimer: Timer | null = null
  private isRunning = false
  private lastFlushTime = Date.now()

  constructor(db: Database, config?: Partial<BatcherConfig>) {
    this.db = db
    this.config = {
      flushIntervalMs: config?.flushIntervalMs ?? 50,
      batchSizeThreshold: config?.batchSizeThreshold ?? 100,
      maxQueueDepth: config?.maxQueueDepth ?? 1000,
    }
  }

  start(): void {
    if (this.isRunning) return

    this.isRunning = true
    this.scheduleNextFlush()
  }

  stop(): void {
    this.isRunning = false
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
  }

  enqueueBatch(batch: TransactionBatch): void {
    if (this.queue.length >= this.config.maxQueueDepth) {
      batch.reject(new Error(`Queue depth exceeded: ${this.config.maxQueueDepth}`))
      return
    }

    this.queue.push(batch)

    // Check if we've hit the size threshold
    if (this.queue.length >= this.config.batchSizeThreshold) {
      this.flushNow()
    }
  }

  private scheduleNextFlush(): void {
    if (!this.isRunning) return

    const timeSinceLastFlush = Date.now() - this.lastFlushTime
    const timeUntilNextFlush = Math.max(0, this.config.flushIntervalMs - timeSinceLastFlush)

    this.flushTimer = setTimeout(() => {
      this.flushNow()
    }, timeUntilNextFlush)
  }

  private async flushNow(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }

    if (this.queue.length === 0) {
      this.lastFlushTime = Date.now()
      this.scheduleNextFlush()
      return
    }

    // Collect all batches to flush (FIFO order is maintained)
    const batchesToFlush = this.queue.splice(0, this.queue.length)

    try {
      await this.flushBatchesWithIsolation(batchesToFlush)
    } catch (error) {
      // This should never happen as flushBatchesWithIsolation handles all errors
      console.error('Unexpected error in flush:', error)
    }

    this.lastFlushTime = Date.now()
    this.scheduleNextFlush()
  }

  private async flushBatchesWithIsolation(batches: TransactionBatch[]): Promise<void> {
    if (batches.length === 0) return

    try {
      // Try to flush all batches in a single transaction
      await this.executeBatches(batches)

      // Success! Resolve all batches
      for (const batch of batches) {
        batch.resolve()
      }
    } catch (error) {
      // Transaction failed, use binary search to isolate the problematic batch
      await this.isolateFailures(batches)
    }
  }

  private async isolateFailures(batches: TransactionBatch[]): Promise<void> {
    if (batches.length === 1) {
      // Found the problematic batch, try executing it once more to capture the actual error
      try {
        await this.executeBatches(batches)
        batches[0].resolve()
      } catch (error) {
        // Capture and log the actual SQLite error
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('TransactionBatcher: Actual SQLite error:', errorMessage, error)
        // @ts-ignore
        batches[0].reject(new Error(`Transaction failed: ${errorMessage}`))
      }
      return
    }

    // Binary search: split batches in half
    const midpoint = Math.floor(batches.length / 2)
    const leftHalf = batches.slice(0, midpoint)
    const rightHalf = batches.slice(midpoint)

    // Try left half
    try {
      await this.executeBatches(leftHalf)
      // Left half succeeded
      for (const batch of leftHalf) {
        batch.resolve()
      }
      // Right half must contain the failure(s)
      await this.isolateFailures(rightHalf)
    } catch (error) {
      // Left half contains failure(s)
      await this.isolateFailures(leftHalf)

      // Now try right half
      try {
        await this.executeBatches(rightHalf)
        for (const batch of rightHalf) {
          batch.resolve()
        }
      } catch (error) {
        // Right half also contains failure(s)
        await this.isolateFailures(rightHalf)
      }
    }
  }

  private async executeBatches(batches: TransactionBatch[]): Promise<void> {
    return new Promise((resolve, reject) => {
      let inTransaction = false
      try {
        // Ensure we're not already in a transaction
        try {
          this.db.run('ROLLBACK')
        } catch {
          // Ignore - not in a transaction
        }

        this.db.run('BEGIN TRANSACTION')
        inTransaction = true

        for (const batch of batches) {
          for (const command of batch.commands) {
            command.statement.run(...command.params)
          }
        }

        this.db.run('COMMIT')
        inTransaction = false
        resolve()
      } catch (error) {
        if (inTransaction) {
          try {
            this.db.run('ROLLBACK')
          } catch (rollbackError) {
            console.error('Rollback failed:', rollbackError)
          }
        }
        reject(error)
      }
    })
  }
}
