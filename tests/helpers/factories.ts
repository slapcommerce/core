import { v4 as uuidv4 } from "uuid";
import type { IntegrationEvent } from "../../src/integrationEvents/_base";
import type { DB } from "../../src/infrastructure/postgres";
import { OutboxTable } from "../../src/infrastructure/orm";
import { eq } from "drizzle-orm";

export interface CreateOutboxMessageOptions {
  id?: string;
  status?: string;
  createdAt?: Date;
  dispatchedAt?: Date | null;
  processedAt?: Date | null;
  attempts?: number;
  event?: IntegrationEvent<string, Record<string, unknown>>;
}

export async function createOutboxMessage(
  db: DB,
  options: CreateOutboxMessageOptions = {}
): Promise<string> {
  const id = options.id || uuidv4();
  const event = options.event || createTestIntegrationEvent();

  await db.insert(OutboxTable).values({
    id,
    status: options.status || "pending",
    createdAt: options.createdAt || new Date(),
    dispatchedAt:
      options.dispatchedAt !== undefined ? options.dispatchedAt : null,
    processedAt: options.processedAt !== undefined ? options.processedAt : null,
    attempts: options.attempts || 0,
    event: event as any,
  });

  return id;
}

export function createTestIntegrationEvent(
  overrides: Partial<IntegrationEvent<string, Record<string, unknown>>> = {}
): IntegrationEvent<string, Record<string, unknown>> {
  return {
    eventId: uuidv4(),
    eventName: "product.created",
    occurredAt: new Date(),
    correlationId: uuidv4(),
    payload: {
      productId: uuidv4(),
      title: "Test Product",
      description: "Test Description",
      slug: "test-product",
      status: "active",
    },
    ...overrides,
  };
}

export function createTestIntegrationEventWithName(
  eventName: string
): IntegrationEvent<string, Record<string, unknown>> {
  return createTestIntegrationEvent({ eventName });
}

export async function createMultipleOutboxMessages(
  db: DB,
  count: number,
  options: CreateOutboxMessageOptions = {}
): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const id = await createOutboxMessage(db, {
      ...options,
      event: createTestIntegrationEvent({
        payload: { index: i },
      }),
    });
    ids.push(id);
  }
  return ids;
}

// Redis Stream Helper Functions

export async function getStreamMessageCount(
  redis: any,
  streamName: string = "events"
): Promise<number> {
  try {
    const result = await redis.xlen(streamName);
    return result || 0;
  } catch (error) {
    return 0;
  }
}

export async function waitForStreamMessages(
  redis: any,
  expectedCount: number,
  options: {
    timeout?: number;
    streamName?: string;
  } = {}
): Promise<void> {
  const timeout = options.timeout || 5000;
  const streamName = options.streamName || "events";
  const startTime = Date.now();

  while (true) {
    const count = await getStreamMessageCount(redis, streamName);
    if (count >= expectedCount) {
      return;
    }

    if (Date.now() - startTime > timeout) {
      throw new Error(
        `Timeout waiting for ${expectedCount} messages in stream. Current count: ${count}`
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

export async function waitForOutboxStatus(
  db: DB,
  outboxId: string,
  expectedStatus: string,
  options: {
    timeout?: number;
  } = {}
): Promise<void> {
  const timeout = options.timeout || 5000;
  const startTime = Date.now();

  while (true) {
    const [message] = await db
      .select()
      .from(OutboxTable)
      .where(eq(OutboxTable.id, outboxId))
      .execute();

    if (message && message.status === expectedStatus) {
      return;
    }

    if (Date.now() - startTime > timeout) {
      throw new Error(
        `Timeout waiting for outbox ${outboxId} to reach status ${expectedStatus}. Current status: ${message?.status || "not found"}`
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
