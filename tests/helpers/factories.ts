import type { DB } from "../../src/infrastructure/postgres";
import { OutboxTable } from "../../src/infrastructure/orm";
import type { IntegrationEvent } from "../../src/integrationEvents/_base";

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

export async function insertPendingOutboxMessageWithEvent(
  db: DB,
  id: string,
  event: IntegrationEvent<string, Record<string, unknown>>
) {
  await db.insert(OutboxTable).values({
    id,
    status: "pending",
    createdAt: new Date(),
    dispatchedAt: null,
    processedAt: null,
    attempts: 0,
    event: event as any,
  });
}

export async function insertDispatchedOutboxMessage(
  db: DB,
  id: string,
  attempts: number = 1,
  event: IntegrationEvent<string, Record<string, unknown>> = {} as any
) {
  await db.insert(OutboxTable).values({
    id,
    status: "dispatched",
    createdAt: new Date(Date.now() - 60000), // 1 minute ago
    dispatchedAt: new Date(),
    processedAt: null,
    attempts,
    event: event as any,
  });
}

export async function insertDispatchedOutboxMessageWithEvent(
  db: DB,
  id: string,
  attempts: number = 1,
  event: IntegrationEvent<string, Record<string, unknown>>
) {
  await db.insert(OutboxTable).values({
    id,
    status: "dispatched",
    createdAt: new Date(Date.now() - 60000), // 1 minute ago
    dispatchedAt: new Date(),
    processedAt: null,
    attempts,
    event: event as any,
  });
}

export async function insertProcessedOutboxMessage(
  db: DB,
  id: string,
  attempts: number = 1,
  event: IntegrationEvent<string, Record<string, unknown>> = {} as any
) {
  await db.insert(OutboxTable).values({
    id,
    status: "processed",
    createdAt: new Date(Date.now() - 120000), // 2 minutes ago
    dispatchedAt: new Date(Date.now() - 60000), // 1 minute ago
    processedAt: new Date(),
    attempts,
    event: event as any,
  });
}

export async function insertStuckPendingOutboxMessage(
  db: DB,
  id: string,
  ageInMs: number,
  event: IntegrationEvent<string, Record<string, unknown>>
) {
  const createdAt = new Date(Date.now() - ageInMs);
  await db.insert(OutboxTable).values({
    id,
    status: "pending",
    createdAt,
    dispatchedAt: null,
    processedAt: null,
    attempts: 0,
    event: event as any,
  });
}

export async function insertStuckDispatchedOutboxMessage(
  db: DB,
  id: string,
  ageInMs: number,
  attempts: number = 1,
  event: IntegrationEvent<string, Record<string, unknown>>
) {
  const dispatchedAt = new Date(Date.now() - ageInMs);
  const createdAt = new Date(dispatchedAt.getTime() - 10000); // Created 10s before dispatch
  await db.insert(OutboxTable).values({
    id,
    status: "dispatched",
    createdAt,
    dispatchedAt,
    processedAt: null,
    attempts,
    event: event as any,
  });
}

export async function insertStuckOutboxMessageWithMaxAttempts(
  db: DB,
  id: string,
  ageInMs: number,
  attempts: number,
  event: IntegrationEvent<string, Record<string, unknown>>
) {
  const dispatchedAt = new Date(Date.now() - ageInMs);
  const createdAt = new Date(dispatchedAt.getTime() - 60000); // Created 60s before dispatch
  await db.insert(OutboxTable).values({
    id,
    status: "dispatched",
    createdAt,
    dispatchedAt,
    processedAt: null,
    attempts,
    event: event as any,
  });
}

export function createMockIntegrationEvent(
  eventName: string,
  payload: Record<string, unknown>,
  eventId: string,
  correlationId: string
): IntegrationEvent<string, Record<string, unknown>> {
  return {
    eventId,
    eventName,
    occurredAt: new Date(),
    correlationId,
    payload,
  };
}
