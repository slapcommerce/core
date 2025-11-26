import type { Database } from 'bun:sqlite'

export interface OutboxHandler {
  handle(eventPayload: string): Promise<void>
}

export interface OutboxPollerConfig {
  /** Time interval in milliseconds between polls (default: 5000ms) */
  pollIntervalMs?: number
  /** Maximum number of retries before moving to DLQ (default: 5) */
  maxRetries?: number
  /** Base for exponential backoff calculation (default: 2) */
  exponentialBackoffBase?: number
  /** Number of records to fetch per poll (default: 10) */
  batchSize?: number
  /** Time interval in milliseconds to flush batched acks (default: 100ms) */
  batchFlushIntervalMs?: number
  /** Number of acks to accumulate before flushing (default: 50) */
  batchSizeThreshold?: number
}

type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed'

interface OutboxRecord {
  id: string
  aggregateId: string
  eventType: string
  payload: string
  status: ProcessingStatus
  retryCount: number
  lastAttemptAt: string | null
  nextRetryAt: string | null
  idempotencyKey: string | null
}

interface ProcessingRecord {
  id: string
  outboxId: string
  handlerId: string
  idempotencyKey: string
  status: ProcessingStatus
  retryCount: number
  lastAttemptAt: string | null
  nextRetryAt: string | null
  processedAt: string | null
}

interface PendingAck {
  type: 'completed' | 'failed' | 'retry'
  processingId: string
  outboxId: string
  retryCount: number
  nextRetryAt: string | null
  errorMessage?: string
}

interface PendingProcessingWrite {
  type: 'create' | 'update_status'
  processingId: string
  outboxId: string
  handlerId: string
  idempotencyKey: string
  status?: 'processing'
}

interface DLQEntry {
  outboxId: string
  handlerId: string
  eventType: string
  payload: string
  errorMessage: string | null
  finalRetryCount: number
  failedAt: string
  originalOccurredAt: string | null
}

export class OutboxPoller {
  private readonly db: Database
  private readonly config: Required<OutboxPollerConfig>
  private readonly handlers: Map<string, Array<{ handler: OutboxHandler; handlerId: string }>> = new Map()
  private isRunning = false
  private pollTimer: Timer | null = null
  private flushTimer: Timer | null = null
  private pendingAcks: PendingAck[] = []
  private pendingProcessingWrites: PendingProcessingWrite[] = []
  private lastFlushTime = Date.now()

  constructor(db: Database, config?: OutboxPollerConfig) {
    this.db = db
    this.config = {
      pollIntervalMs: config?.pollIntervalMs ?? 5000,
      maxRetries: config?.maxRetries ?? 5,
      exponentialBackoffBase: config?.exponentialBackoffBase ?? 2,
      batchSize: config?.batchSize ?? 10,
      batchFlushIntervalMs: config?.batchFlushIntervalMs ?? 100,
      batchSizeThreshold: config?.batchSizeThreshold ?? 50,
    }
  }

  /**
   * Register a handler for a specific event type.
   * Multiple handlers can be registered for the same event type (fanout pattern).
   */
  registerHandler(eventType: string, handler: OutboxHandler, handlerId: string): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, [])
    }
    this.handlers.get(eventType)!.push({ handler, handlerId })
  }

  /**
   * Start the polling loop.
   */
  start(): void {
    if (this.isRunning) return

    this.isRunning = true
    this.scheduleNextPoll()
    this.scheduleNextFlush()
  }

  /**
   * Stop the polling loop gracefully.
   * Flushes any pending batched writes before stopping.
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return

    this.isRunning = false

    if (this.pollTimer) {
      clearTimeout(this.pollTimer)
      this.pollTimer = null
    }

    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }

    // Flush any pending writes before stopping
    await this.flushProcessingWrites()
    await this.flushAcks()
  }

  private scheduleNextPoll(): void {
    if (!this.isRunning) return

    this.pollTimer = setTimeout(() => {
      this.poll().finally(() => {
        this.scheduleNextPoll()
      })
    }, this.config.pollIntervalMs)
  }

  private scheduleNextFlush(): void {
    if (!this.isRunning) return

    const timeSinceLastFlush = Date.now() - this.lastFlushTime
    const timeUntilNextFlush = Math.max(0, this.config.batchFlushIntervalMs - timeSinceLastFlush)

    this.flushTimer = setTimeout(() => {
      this.flushAcks().finally(() => {
        this.scheduleNextFlush()
      })
    }, timeUntilNextFlush)
  }

  private async poll(): Promise<void> {
    try {
      const records = this.fetchPendingRecords()
      if (records.length === 0) return

      await this.processRecords(records)
    } catch (error) {
      console.error('Error in poll:', error)
    }
  }

  private fetchPendingRecords(): OutboxRecord[] {
    // Fetch all pending outbox records (no status field needed since we delete completed ones)
    const query = this.db.query<OutboxRecord, [number]>(
      `SELECT id, aggregateId, eventType, payload, status, retryCount, lastAttemptAt, nextRetryAt, idempotencyKey
       FROM outbox
       ORDER BY id ASC
       LIMIT ?`
    )

    return query.all(this.config.batchSize) as OutboxRecord[]
  }

  private async processRecords(records: OutboxRecord[]): Promise<void> {
    // Flush any pending processing writes before starting new batch
    await this.flushProcessingWrites()

    for (const record of records) {
      const handlers = this.handlers.get(record.eventType)
      if (!handlers || handlers.length === 0) {
        // No handlers registered for this event type, mark outbox as completed
        this.queueOutboxAck(record.id, 'completed')
        continue
      }

      // Process with all handlers (fanout)
      for (const { handler, handlerId } of handlers) {
        await this.processWithHandler(record, handler, handlerId)
      }
    }

    // Flush processing writes after processing batch
    await this.flushProcessingWrites()
  }

  private async processWithHandler(
    record: OutboxRecord,
    handler: OutboxHandler,
    handlerId: string
  ): Promise<void> {
    // Generate idempotency key
    const idempotencyKey = this.generateIdempotencyKey(record.payload, handlerId)

    // Check if processing record exists
    const existing = this.db
      .query<ProcessingRecord, [string]>(
        `SELECT id, status, retryCount, lastAttemptAt, nextRetryAt, processedAt
         FROM outboxProcessing
         WHERE idempotencyKey = ?`
      )
      .get(idempotencyKey) as ProcessingRecord | undefined

    // If existing and completed, skip (already processed)
    if (existing?.status === 'completed') {
      return
    }

    // If existing and failed, check if it's ready to retry
    if (existing?.status === 'failed' && existing.nextRetryAt && new Date(existing.nextRetryAt).getTime() > Date.now()) {
      // Not ready to retry yet, skip
      return
    }

    // Get or create processing record
    let processingId: string
    let retryCount: number
    let lastAttemptAt: string | null

    if (existing) {
      processingId = existing.id
      retryCount = existing.retryCount
      lastAttemptAt = existing.lastAttemptAt

      // Queue status update to 'processing'
      this.queueProcessingWrite({
        type: 'update_status',
        processingId,
        outboxId: record.id,
        handlerId,
        idempotencyKey,
        status: 'processing',
      })
    } else {
      processingId = crypto.randomUUID()
      retryCount = 0
      lastAttemptAt = null

      // Queue creation of processing record
      this.queueProcessingWrite({
        type: 'create',
        processingId,
        outboxId: record.id,
        handlerId,
        idempotencyKey,
        status: 'processing',
      })
    }

    // Flush processing writes before executing handler to ensure record exists
    await this.flushProcessingWrites()

    // Re-check if record exists (might have been created by another process)
    const finalCheck = this.db
      .query<ProcessingRecord, [string]>(
        `SELECT id, status, retryCount, lastAttemptAt, nextRetryAt, processedAt
         FROM outboxProcessing
         WHERE idempotencyKey = ?`
      )
      .get(idempotencyKey) as ProcessingRecord | undefined

    // If record doesn't exist or is completed, skip
    if (!finalCheck || finalCheck.status === 'completed') {
      return
    }

    // Use the actual processing ID from database
    processingId = finalCheck.id
    retryCount = finalCheck.retryCount
    lastAttemptAt = finalCheck.lastAttemptAt

    try {
      // Execute handler
      await handler.handle(record.payload)

      // Success - mark as completed
      this.queueAck({
        type: 'completed',
        processingId,
        outboxId: record.id,
        retryCount,
        nextRetryAt: null,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const isPermanentFailure = this.isPermanentFailure(error)

      if (isPermanentFailure || retryCount >= this.config.maxRetries) {
        // Move to DLQ
        await this.moveToDLQ(record, handlerId, errorMessage, retryCount)
        // Delete processing record after moving to DLQ
        this.queueAck({
          type: 'failed',
          processingId,
          outboxId: record.id,
          retryCount,
          nextRetryAt: null,
          errorMessage,
        })
      } else {
        // Schedule retry with exponential backoff
        const nextRetryAt = this.calculateNextRetryAt(retryCount)
        this.queueAck({
          type: 'retry',
          processingId,
          outboxId: record.id,
          retryCount: retryCount + 1,
          nextRetryAt,
          errorMessage,
        })
      }
    }
  }

  private generateIdempotencyKey(payload: string, handlerId: string): string {
    const data = `${payload}:${handlerId}`
    // Use crypto.subtle for hashing if available, otherwise fallback to simple hash
    // For Bun, we can use Bun.hash which is fast
    const hash = Bun.hash(data)
    return hash.toString(16)
  }

  private calculateNextRetryAt(retryCount: number): string {
    const backoffMs = Math.pow(this.config.exponentialBackoffBase, retryCount) * 1000
    return new Date(Date.now() + backoffMs).toISOString()
  }

  private isPermanentFailure(error: unknown): boolean {
    // Simple heuristic: check if error message indicates permanent failure
    // This can be extended with more sophisticated logic
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      // Examples of permanent failures
      return (
        message.includes('validation') ||
        message.includes('invalid') ||
        message.includes('not found') ||
        message.includes('unauthorized') ||
        message.includes('forbidden')
      )
    }
    return false
  }

  private async moveToDLQ(
    record: OutboxRecord,
    handlerId: string,
    errorMessage: string,
    finalRetryCount: number
  ): Promise<void> {
    const dlqEntry: DLQEntry = {
      outboxId: record.id,
      handlerId: handlerId,
      eventType: record.eventType,
      payload: record.payload,
      errorMessage: errorMessage,
      finalRetryCount: finalRetryCount,
      failedAt: new Date().toISOString(),
      originalOccurredAt: null, // Could be extracted from payload if needed
    }

    this.db
      .query(
        `INSERT INTO outboxDlq (id, outboxId, handlerId, eventType, payload, errorMessage, finalRetryCount, failedAt, originalOccurredAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        crypto.randomUUID(),
        dlqEntry.outboxId,
        dlqEntry.handlerId,
        dlqEntry.eventType,
        dlqEntry.payload,
        dlqEntry.errorMessage,
        dlqEntry.finalRetryCount,
        dlqEntry.failedAt,
        dlqEntry.originalOccurredAt
      )
  }

  private queueAck(ack: PendingAck): void {
    this.pendingAcks.push(ack)

    // Check if we've hit the size threshold
    if (this.pendingAcks.length >= this.config.batchSizeThreshold) {
      // Flush immediately (fire and forget to avoid blocking)
      this.flushAcks().catch((error) => {
        console.error('Error flushing acks:', error)
      })
    }
  }

  private queueOutboxAck(outboxId: string, status: 'completed' | 'failed'): void {
    this.pendingAcks.push({
      type: status,
      processingId: outboxId, // Use outboxId as processingId for outbox-level acks
      outboxId,
      retryCount: 0,
      nextRetryAt: null,
    })

    if (this.pendingAcks.length >= this.config.batchSizeThreshold) {
      this.flushAcks().catch((error) => {
        console.error('Error flushing acks:', error)
      })
    }
  }

  private queueProcessingWrite(write: PendingProcessingWrite): void {
    this.pendingProcessingWrites.push(write)

    // Check if we've hit the size threshold
    if (this.pendingProcessingWrites.length >= this.config.batchSizeThreshold) {
      // Flush immediately (fire and forget to avoid blocking)
      this.flushProcessingWrites().catch((error) => {
        console.error('Error flushing processing writes:', error)
      })
    }
  }

  private async flushProcessingWrites(): Promise<void> {
    if (this.pendingProcessingWrites.length === 0) {
      return
    }

    const writesToFlush = this.pendingProcessingWrites.splice(0, this.pendingProcessingWrites.length)

    try {
      this.db.run('BEGIN TRANSACTION')

      for (const write of writesToFlush) {
        if (write.type === 'create') {
          try {
            this.db
              .query(
                `INSERT INTO outboxProcessing (id, outboxId, handlerId, idempotencyKey, status, retryCount)
                 VALUES (?, ?, ?, ?, ?, 0)`
              )
              .run(write.processingId, write.outboxId, write.handlerId, write.idempotencyKey, write.status || 'processing')
          } catch (error: any) {
            // If unique constraint violation, ignore (record already exists)
            // This can happen due to race conditions, and we'll handle it on next poll
            if (!(error?.code === 'SQLITE_CONSTRAINT_UNIQUE' || error?.message?.includes('UNIQUE'))) {
              throw error
            }
          }
        } else if (write.type === 'update_status') {
          this.db
            .query(`UPDATE outboxProcessing SET status = ? WHERE id = ?`)
            .run(write.status || 'processing', write.processingId)
        }
      }

      this.db.run('COMMIT')
    } catch (error) {
      this.db.run('ROLLBACK')
      // Put writes back in queue for retry
      this.pendingProcessingWrites.unshift(...writesToFlush)
      throw error
    }
  }

  private async flushAcks(): Promise<void> {
    if (this.pendingAcks.length === 0) {
      this.lastFlushTime = Date.now()
      return
    }

    const acksToFlush = this.pendingAcks.splice(0, this.pendingAcks.length)

    try {
      this.db.run('BEGIN TRANSACTION')

      for (const ack of acksToFlush) {
        // Check if this is an outbox-level ack (processingId === outboxId)
        const isOutboxAck = ack.processingId === ack.outboxId

        if (isOutboxAck) {
          // Delete outbox record directly (no handlers registered case)
          if (ack.type === 'completed') {
            this.db.query(`DELETE FROM outbox WHERE id = ?`).run(ack.outboxId)
          }
        } else {
          // Handle outboxProcessing table
          if (ack.type === 'completed') {
            // Mark as completed but don't delete yet - keep for idempotency until all handlers are done
            this.db
              .query(
                `UPDATE outboxProcessing
                 SET status = 'completed', processedAt = ?, retryCount = ?
                 WHERE id = ?`
              )
              .run(new Date().toISOString(), ack.retryCount, ack.processingId)
          } else if (ack.type === 'failed') {
            // Delete processing record after moving to DLQ
            this.db.query(`DELETE FROM outboxProcessing WHERE id = ?`).run(ack.processingId)
          } else if (ack.type === 'retry') {
            // Update processing record for retry (keep it until it succeeds or goes to DLQ)
            this.db
              .query(
                `UPDATE outboxProcessing
                 SET status = 'failed', retryCount = ?, lastAttemptAt = ?, nextRetryAt = ?
                 WHERE id = ?`
              )
              .run(ack.retryCount, new Date().toISOString(), ack.nextRetryAt, ack.processingId)
          }
        }
      }

      // Delete outbox records if all handlers are done (no remaining processing records)
      // Collect unique outbox IDs that had processing updates
      const outboxIdsToCheck = new Set<string>()
      for (const ack of acksToFlush) {
        if (!ack.processingId || ack.processingId === ack.outboxId) continue
        outboxIdsToCheck.add(ack.outboxId)
      }

      for (const outboxId of outboxIdsToCheck) {
        // Check if all handlers for this outbox are done (no remaining processing records)
        const remainingHandlers = this.db
          .query<{ count: number }, [string]>(`SELECT COUNT(*) as count FROM outboxProcessing WHERE outboxId = ?`)
          .get(outboxId) as { count: number }

        if (remainingHandlers.count === 0) {
          // All handlers completed or moved to DLQ, delete outbox record and all its processing records
          this.db.query(`DELETE FROM outbox WHERE id = ?`).run(outboxId)
          // Also delete any remaining processing records (should be none, but ensure cleanup)
          this.db.query(`DELETE FROM outboxProcessing WHERE outboxId = ?`).run(outboxId)
        } else {
          // Check if all remaining handlers are completed (not failed/retrying)
          const completedHandlers = this.db
            .query<{ count: number }, [string]>(
              `SELECT COUNT(*) as count FROM outboxProcessing WHERE outboxId = ? AND status = 'completed'`
            )
            .get(outboxId) as { count: number }

          if (completedHandlers.count === remainingHandlers.count) {
            // All handlers completed, delete outbox and processing records
            this.db.query(`DELETE FROM outbox WHERE id = ?`).run(outboxId)
            this.db.query(`DELETE FROM outboxProcessing WHERE outboxId = ?`).run(outboxId)
          }
        }
      }

      this.db.run('COMMIT')
    } catch (error) {
      this.db.run('ROLLBACK')
      // Put acks back in queue for retry
      this.pendingAcks.unshift(...acksToFlush)
      throw error
    }

    this.lastFlushTime = Date.now()
  }
}
