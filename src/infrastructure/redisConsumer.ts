import Redis from "ioredis";
import { redis } from "./redis";
import type {
  DomainEvent,
  DomainEventPayload,
} from "../domain/_base/domainEvent";
import { decryptEvent, encryptEvent } from "./utils/encryption";

interface ConsumerConfig {
  aggregateTypes: string[];
  eventHandler: any;
  consumerGroupName: string;
  consumerName: string;
  batchSize?: number;
  blockTimeMs?: number;
  partitionDays?: number;
  maxRetries?: number;
}

interface StreamMessage {
  id: string;
  event: DomainEvent<string, DomainEventPayload>;
}

export class RedisAggregateTypeConsumer {
  private redis: Redis;
  private aggregateTypes: string[];
  private consumerGroupName: string;
  private consumerName: string;
  private batchSize: number;
  private blockTimeMs: number;
  private partitionDays: number;
  private maxRetries: number;
  private isRunning: boolean = false;
  private eventHandler: any;
  private consumerGroupsInitialized: Set<string> = new Set();

  constructor(config: ConsumerConfig) {
    this.redis = redis;
    this.aggregateTypes = config.aggregateTypes;
    this.consumerGroupName = config.consumerGroupName;
    this.consumerName = config.consumerName;
    this.batchSize = config.batchSize ?? 10;
    this.blockTimeMs = config.blockTimeMs ?? 5000;
    this.partitionDays = config.partitionDays ?? 7;
    this.maxRetries = config.maxRetries ?? 3;
    this.eventHandler = config.eventHandler;
  }

  /**
   * Get all stream keys for the configured aggregate types across all partition days
   */
  private getStreamKeys(): string[] {
    const streamKeys: string[] = [];
    const today = new Date();

    for (const aggregateType of this.aggregateTypes) {
      for (let i = 0; i < this.partitionDays; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];
        streamKeys.push(`events:${aggregateType}:${dateStr}`);
      }
    }

    return streamKeys;
  }

  /**
   * Initialize consumer groups for all stream keys
   */
  private async ensureConsumerGroups(): Promise<void> {
    const streamKeys = this.getStreamKeys();

    for (const streamKey of streamKeys) {
      if (this.consumerGroupsInitialized.has(streamKey)) {
        continue;
      }

      try {
        // Create consumer group starting from the beginning of the stream
        // Use MKSTREAM to create the stream if it doesn't exist
        await this.redis.xgroup(
          "CREATE",
          streamKey,
          this.consumerGroupName,
          "0",
          "MKSTREAM"
        );
        this.consumerGroupsInitialized.add(streamKey);
      } catch (error: any) {
        // BUSYGROUP error means the group already exists, which is fine
        if (error.message?.includes("BUSYGROUP")) {
          this.consumerGroupsInitialized.add(streamKey);
        } else {
          console.error(
            `Failed to create consumer group for ${streamKey}:`,
            error
          );
        }
      }
    }
  }

  /**
   * Decrypt and parse a raw stream message
   */
  private async parseMessage(
    streamKey: string,
    messageId: string,
    fields: string[]
  ): Promise<StreamMessage> {
    // Fields come as [field, value, field, value, ...]
    // We expect ['event', <encrypted_buffer>]
    const eventIndex = fields.indexOf("event");
    if (eventIndex === -1 || eventIndex + 1 >= fields.length) {
      throw new Error(`Invalid message format in stream ${streamKey}`);
    }

    const encryptedData = fields[eventIndex + 1];
    if (!encryptedData) {
      throw new Error(`Missing encrypted data in stream ${streamKey}`);
    }

    const buffer = Buffer.from(encryptedData, "binary");
    const event = await decryptEvent(new Uint8Array(buffer));

    return {
      id: messageId,
      event,
    };
  }

  /**
   * Acknowledge multiple messages at once for better performance
   */
  private async acknowledgeMessages(
    streamKey: string,
    messageIds: string[]
  ): Promise<void> {
    if (messageIds.length === 0) return;
    await this.redis.xack(streamKey, this.consumerGroupName, ...messageIds);
  }

  /**
   * Get the DLQ stream key for a given stream
   */
  private getDLQStreamKey(streamKey: string): string {
    return `${streamKey}:dlq`;
  }

  /**
   * Move a message to the Dead Letter Queue
   */
  private async moveToDeadLetterQueue(
    streamKey: string,
    message: StreamMessage,
    error: Error,
    deliveryCount: number
  ): Promise<void> {
    const dlqStreamKey = this.getDLQStreamKey(streamKey);

    try {
      // Re-encrypt the event before storing in DLQ
      const encryptedEvent = await encryptEvent(message.event);
      const eventBuffer = Buffer.from(encryptedEvent).toString("binary");

      // Add the message to the DLQ with metadata
      await this.redis.xadd(
        dlqStreamKey,
        "*",
        "originalMessageId",
        message.id,
        "originalStream",
        streamKey,
        "event",
        eventBuffer,
        "error",
        error.message,
        "deliveryCount",
        deliveryCount.toString(),
        "timestamp",
        new Date().toISOString(),
        "consumerGroup",
        this.consumerGroupName,
        "consumer",
        this.consumerName
      );

      // Acknowledge the original message to remove it from PEL
      await this.acknowledgeMessages(streamKey, [message.id]);

      console.warn(
        `Message ${message.id} moved to DLQ after ${deliveryCount} attempts. Error: ${error.message}`
      );
    } catch (dlqError) {
      console.error(`Failed to move message ${message.id} to DLQ:`, dlqError);
      // Don't ACK if we couldn't move to DLQ
      throw dlqError;
    }
  }

  /**
   * Get detailed pending message information including delivery count
   */
  private async getPendingMessagesInfo(
    streamKey: string
  ): Promise<Map<string, number>> {
    try {
      // XPENDING returns [count, start-id, end-id, consumers]
      const summary = await this.redis.xpending(
        streamKey,
        this.consumerGroupName
      );

      if (!summary || summary[0] === "0") {
        return new Map();
      }

      // Get detailed info for all pending messages
      const detailed = await this.redis.xpending(
        streamKey,
        this.consumerGroupName,
        "-",
        "+",
        this.batchSize
      );

      // detailed is array of [messageId, consumer, idle-time, delivery-count]
      const deliveryCounts = new Map<string, number>();

      if (Array.isArray(detailed)) {
        for (const entry of detailed) {
          if (Array.isArray(entry) && entry.length >= 4) {
            const messageId = entry[0] as string;
            const deliveryCount = parseInt(entry[3] as string, 10);
            deliveryCounts.set(messageId, deliveryCount);
          }
        }
      }

      return deliveryCounts;
    } catch (error) {
      console.error(`Failed to get pending info for ${streamKey}:`, error);
      return new Map();
    }
  }

  /**
   * Read pending messages from a stream
   */
  private async readPending(streamKey: string): Promise<StreamMessage[]> {
    const result = await this.redis.xreadgroup(
      "GROUP",
      this.consumerGroupName,
      this.consumerName,
      "COUNT",
      this.batchSize,
      "STREAMS",
      streamKey,
      "0" // Read pending messages (PEL)
    );

    if (!result) {
      return [];
    }

    const messages: StreamMessage[] = [];
    for (const [stream, entries] of result as [
      string,
      [string, string[]][]
    ][]) {
      for (const [messageId, fields] of entries) {
        try {
          const message = await this.parseMessage(stream, messageId, fields);
          messages.push(message);
        } catch (error) {
          console.error(
            `Failed to parse message ${messageId} from ${stream}:`,
            error
          );
        }
      }
    }

    return messages;
  }

  /**
   * Read new messages from a stream
   */
  private async readNew(streamKey: string): Promise<StreamMessage[]> {
    const result = await this.redis.xreadgroup(
      "GROUP",
      this.consumerGroupName,
      this.consumerName,
      "COUNT",
      this.batchSize,
      "BLOCK",
      this.blockTimeMs,
      "STREAMS",
      streamKey,
      ">" // Read only new messages
    );

    if (!result) {
      return [];
    }

    const messages: StreamMessage[] = [];
    for (const [stream, entries] of result as [
      string,
      [string, string[]][]
    ][]) {
      for (const [messageId, fields] of entries) {
        try {
          const message = await this.parseMessage(stream, messageId, fields);
          messages.push(message);
        } catch (error) {
          console.error(
            `Failed to parse message ${messageId} from ${stream}:`,
            error
          );
        }
      }
    }

    return messages;
  }

  /**
   * Process a single stream's messages
   */
  private async processStream(streamKey: string): Promise<void> {
    // Get delivery counts for pending messages
    const deliveryCounts = await this.getPendingMessagesInfo(streamKey);

    // First, process any pending messages
    const pendingMessages = await this.readPending(streamKey);
    const pendingAcks: string[] = [];

    for (const message of pendingMessages) {
      const deliveryCount = deliveryCounts.get(message.id) || 1;

      // Check if message has exceeded retry limit
      if (deliveryCount > this.maxRetries) {
        try {
          await this.moveToDeadLetterQueue(
            streamKey,
            message,
            new Error(`Max retries (${this.maxRetries}) exceeded`),
            deliveryCount
          );
          // Message is already ACK'd in moveToDeadLetterQueue
          continue;
        } catch (dlqError) {
          console.error(
            `Failed to move message ${message.id} to DLQ:`,
            dlqError
          );
          // Don't ACK if DLQ move failed, will retry later
          continue;
        }
      }

      try {
        await this.eventHandler.handle(message.event);
        pendingAcks.push(message.id);
      } catch (error) {
        console.error(
          `Failed to process pending message ${message.id} (attempt ${deliveryCount}/${this.maxRetries}):`,
          error
        );
        // Message remains in PEL for retry
      }
    }

    // Batch acknowledge all successfully processed pending messages
    await this.acknowledgeMessages(streamKey, pendingAcks);

    // Then, read and process new messages
    const newMessages = await this.readNew(streamKey);
    const newAcks: string[] = [];

    for (const message of newMessages) {
      try {
        await this.eventHandler.handle(message.event);
        newAcks.push(message.id);
      } catch (error) {
        console.error(
          `Failed to process new message ${message.id} (attempt 1/${this.maxRetries}):`,
          error
        );
        // Message remains in PEL for retry
      }
    }

    // Batch acknowledge all successfully processed new messages
    await this.acknowledgeMessages(streamKey, newAcks);
  }

  /**
   * Start consuming messages
   * @param handler Optional custom message handler
   */
  async start(
    handler?: (message: StreamMessage) => Promise<void>
  ): Promise<void> {
    if (this.isRunning) {
      throw new Error("Consumer is already running");
    }

    this.isRunning = true;

    console.log(
      `Starting consumer for aggregate types: ${this.aggregateTypes.join(", ")}`
    );
    console.log(`Consuming from ${this.partitionDays} days of partitions`);
    console.log(`Max retries before DLQ: ${this.maxRetries}`);

    // Initialize consumer groups
    await this.ensureConsumerGroups();

    // Main consumption loop
    while (this.isRunning) {
      try {
        // Refresh stream keys to handle date rollovers
        const streamKeys = this.getStreamKeys();

        // Ensure consumer groups exist for any new stream keys
        await this.ensureConsumerGroups();

        // Process each stream
        for (const streamKey of streamKeys) {
          if (!this.isRunning) break;
          await this.processStream(streamKey);
        }
      } catch (error) {
        console.error("Error in consumer loop:", error);
        // Brief pause before retrying
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Stop consuming messages
   */
  async stop(): Promise<void> {
    console.log("Stopping consumer...");
    this.isRunning = false;
  }

  /**
   * Get consumer info for debugging
   */
  async getConsumerInfo(streamKey: string): Promise<any> {
    try {
      const info = await this.redis.xinfo(
        "CONSUMERS",
        streamKey,
        this.consumerGroupName
      );
      return info;
    } catch (error) {
      console.error(`Failed to get consumer info for ${streamKey}:`, error);
      return null;
    }
  }

  /**
   * Get pending messages count for a stream
   */
  async getPendingCount(streamKey: string): Promise<number> {
    try {
      const pending = await this.redis.xpending(
        streamKey,
        this.consumerGroupName
      );
      return pending ? parseInt(pending[0] as string, 10) : 0;
    } catch (error) {
      console.error(`Failed to get pending count for ${streamKey}:`, error);
      return 0;
    }
  }

  /**
   * Get the count of messages in a DLQ stream
   */
  async getDLQCount(streamKey: string): Promise<number> {
    try {
      const dlqStreamKey = this.getDLQStreamKey(streamKey);
      const length = await this.redis.xlen(dlqStreamKey);
      return length || 0;
    } catch (error) {
      console.error(`Failed to get DLQ count for ${streamKey}:`, error);
      return 0;
    }
  }

  /**
   * Get all DLQ counts for the configured aggregate types
   */
  async getAllDLQCounts(): Promise<Map<string, number>> {
    const streamKeys = this.getStreamKeys();
    const dlqCounts = new Map<string, number>();

    for (const streamKey of streamKeys) {
      const count = await this.getDLQCount(streamKey);
      if (count > 0) {
        dlqCounts.set(streamKey, count);
      }
    }

    return dlqCounts;
  }

  /**
   * Read messages from a DLQ stream
   */
  async readDLQMessages(streamKey: string, count: number = 10): Promise<any[]> {
    try {
      const dlqStreamKey = this.getDLQStreamKey(streamKey);
      const messages = await this.redis.xrange(
        dlqStreamKey,
        "-",
        "+",
        "COUNT",
        count
      );

      if (!messages || messages.length === 0) {
        return [];
      }

      const results = await Promise.all(
        messages.map(async ([id, fields]: [string, string[]]) => {
          const data: any = { id };
          for (let i = 0; i < fields.length; i += 2) {
            const key = fields[i];
            const value = fields[i + 1];

            if (!key || value === undefined) continue;

            // Decrypt the event field
            if (key === "event") {
              try {
                const buffer = Buffer.from(value, "binary");
                data[key] = await decryptEvent(new Uint8Array(buffer));
              } catch (error) {
                console.error(`Failed to decrypt event in DLQ:`, error);
                data[key] = null;
              }
            } else {
              data[key] = value;
            }
          }
          return data;
        })
      );

      return results;
    } catch (error) {
      console.error(`Failed to read DLQ messages for ${streamKey}:`, error);
      return [];
    }
  }

  /**
   * Reprocess a message from the DLQ
   * Attempts to process the message again and removes it from DLQ if successful
   */
  async reprocessDLQMessage(
    streamKey: string,
    dlqMessageId: string
  ): Promise<boolean> {
    try {
      const dlqStreamKey = this.getDLQStreamKey(streamKey);

      // Read the specific message from DLQ
      const messages = await this.redis.xrange(
        dlqStreamKey,
        dlqMessageId,
        dlqMessageId
      );

      if (!messages || messages.length === 0) {
        console.error(`Message ${dlqMessageId} not found in DLQ`);
        return false;
      }

      const message = messages[0];
      if (!message) {
        console.error(`Message ${dlqMessageId} not found in DLQ`);
        return false;
      }

      const [id, fields] = message;
      const data: any = {};

      for (let i = 0; i < fields.length; i += 2) {
        const key = fields[i];
        const value = fields[i + 1];
        if (key && value !== undefined) {
          data[key] = value;
        }
      }

      // Decrypt the event
      let event;
      try {
        const buffer = Buffer.from(data.event, "binary");
        event = await decryptEvent(new Uint8Array(buffer));
      } catch (error) {
        console.error(`Failed to decrypt event from DLQ message:`, error);
        return false;
      }

      // Attempt to process the event
      try {
        await this.eventHandler.handle(event);

        // If successful, remove from DLQ
        await this.redis.xdel(dlqStreamKey, dlqMessageId);

        console.log(
          `Successfully reprocessed message ${dlqMessageId} from DLQ`
        );
        return true;
      } catch (error) {
        console.error(
          `Failed to reprocess message ${dlqMessageId} from DLQ:`,
          error
        );
        return false;
      }
    } catch (error) {
      console.error(`Error reprocessing DLQ message:`, error);
      return false;
    }
  }

  /**
   * Delete a message from the DLQ
   */
  async deleteDLQMessage(
    streamKey: string,
    dlqMessageId: string
  ): Promise<boolean> {
    try {
      const dlqStreamKey = this.getDLQStreamKey(streamKey);
      const deleted = await this.redis.xdel(dlqStreamKey, dlqMessageId);
      return deleted > 0;
    } catch (error) {
      console.error(`Failed to delete DLQ message:`, error);
      return false;
    }
  }

  /**
   * Clear all messages from a DLQ stream
   */
  async clearDLQ(streamKey: string): Promise<boolean> {
    try {
      const dlqStreamKey = this.getDLQStreamKey(streamKey);
      await this.redis.del(dlqStreamKey);
      console.log(`Cleared DLQ for stream ${streamKey}`);
      return true;
    } catch (error) {
      console.error(`Failed to clear DLQ for ${streamKey}:`, error);
      return false;
    }
  }
}
