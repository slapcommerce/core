import type { Database } from "bun:sqlite"
import type { TransactionBatch } from "../../transactionBatch"
import type { ScheduleState } from "@/api/domain/schedule/events"

export class SchedulesReadModelRepository {
  private db: Database
  private batch: TransactionBatch

  constructor(db: Database, batch: TransactionBatch) {
    this.db = db
    this.batch = batch
  }

  save(state: ScheduleState) {
    const statement = this.db.query(
      `INSERT OR REPLACE INTO schedulesReadModel (
        aggregateId, correlationId, version, createdAt, updatedAt,
        targetAggregateId, targetAggregateType, commandType, commandData,
        scheduledFor, status, retryCount, nextRetryAt, createdBy, errorMessage
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )

    this.batch.addCommand({
      statement,
      params: [
        state.id,
        state.correlationId,
        state.version,
        state.createdAt.toISOString(),
        state.updatedAt.toISOString(),
        state.targetAggregateId,
        state.targetAggregateType,
        state.commandType,
        state.commandData ? JSON.stringify(state.commandData) : null,
        state.scheduledFor.toISOString(),
        state.status,
        state.retryCount,
        state.nextRetryAt ? state.nextRetryAt.toISOString() : null,
        state.createdBy,
        state.errorMessage,
      ],
      type: 'insert'
    })
  }
}
