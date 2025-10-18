import type { DB } from "../../src/infrastructure/postgres";
import { OutboxTable } from "../../src/infrastructure/orm";

export async function insertPendingOutboxMessage(db: DB, id: string) {
  await db.insert(OutboxTable).values({
    id,
    status: "pending",
    createdAt: new Date(),
    dispatchedAt: null,
    processedAt: null,
    attempts: 0,
    event: {},
  });
}
