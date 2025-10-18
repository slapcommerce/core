import { OutboxDispatcher } from "../../../src/infrastructure/outboxDispatcher";
import { expect, test, describe } from "bun:test";
import { db } from "../../helpers/postgres";
import { redis, redisStreamsResponseToObject } from "../../helpers/redis";
import { insertPendingOutboxMessage } from "../../helpers/factories";
import { randomUUIDv7 } from "bun";

describe("OutboxDispatcher", () => {
  test("dispatches pending outbox message to Redis and updates status", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7();
    const streamName = randomUUIDv7();
    await insertPendingOutboxMessage(db, outboxId);
    const dispatcher = new OutboxDispatcher({
      db,
      redis,
      streamName,
    });

    // ACT
    await dispatcher.dispatch(outboxId);

    // ASSERT
    const streamMessages = await redis.xrange(streamName, "-", "+");
    expect(streamMessages).toHaveLength(1);
    const messageData = redisStreamsResponseToObject(streamMessages[0]);
    expect(messageData.outbox_id).toBe(outboxId);
  });
});
