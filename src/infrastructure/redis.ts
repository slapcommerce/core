import Redis from "ioredis";
import type { DomainEvent } from "../domain/_base/domainEvent";

export enum RedisPrefix {
  EVENTS = "events:",
  PROJECTIONS = "projections:",
  PROJECTION_VERSION = "projection-version:",
  AGGREGATES = "aggregates:",
  AGGREGATE_TYPE = "aggregate-type:",
  AGGREGATE_TYPE_COUNTERS = "aggregate-type-counters:",
  COMMANDS = "commands:",
  SNAPSHOTS = "snapshot:",
}

export const redis = new Redis(process.env.REDIS_URL!);

interface Operation {
  type: "per-aggregate" | "aggregate-type" | "snapshot";
  streamName?: string;
  version: number;
  eventBuffer?: Buffer;
  snapshotKey?: string;
  snapshotData?: Buffer;
}

// Global script cache shared across all transactions
const scriptCache = new Map<string, string>();

export class LuaCommandTransaction {
  private operations: Operation[];
  private redis: Redis;
  private versionChecks: Map<string, number>;
  private commandId: string;
  private aggregateType: string;

  constructor(redis: Redis, commandId: string, aggregateType: string) {
    this.redis = redis;
    this.commandId = commandId;
    this.aggregateType = aggregateType;
    this.operations = [];
    this.versionChecks = new Map();
  }

  async addToPerAggregateStream(
    aggregateId: string,
    version: number,
    eventBuffer: Buffer
  ) {
    const streamName = `${RedisPrefix.EVENTS}${aggregateId}`;

    // Track expected current version for optimistic concurrency
    // For version 1, expect current version to be -1 (empty stream)
    // For version 2, expect current version to be 0 (after 1 event)
    const expectedCurrentVersion = version - 2;
    if (!this.versionChecks.has(streamName)) {
      this.versionChecks.set(streamName, expectedCurrentVersion);
    }

    this.operations.push({
      type: "per-aggregate",
      streamName,
      version,
      eventBuffer,
    });
  }

  async addToAggregateTypeStream(version: number, eventBuffer: Buffer) {
    const streamName = `${RedisPrefix.AGGREGATE_TYPE}${this.aggregateType}`;

    this.operations.push({
      type: "aggregate-type",
      streamName,
      version,
      eventBuffer,
    });
  }

  async addSnapshot(
    aggregateId: string,
    version: number,
    snapshotData: Buffer
  ) {
    const snapshotKey = `${RedisPrefix.SNAPSHOTS}${this.aggregateType}:${aggregateId}`;

    this.operations.push({
      type: "snapshot",
      version,
      snapshotKey,
      snapshotData,
    });
  }

  private constructScript(): string {
    // Create a signature for caching based on operation structure
    // Include operation types to ensure proper caching when mixing per-aggregate and aggregate-type ops
    const opTypes = this.operations.map((op) => op.type[0]).join(""); // 'p', 'a', or 's'
    const signature = `dedup:v${this.versionChecks.size}:o${this.operations.length}:t${opTypes}`;

    // Check cache first
    if (scriptCache.has(signature)) {
      return scriptCache.get(signature)!;
    }

    // Deduplication check (KEYS[1] = commandId, KEYS[2] = counter key)
    const dedupCheck = `
      local existingId = redis.call('GET', KEYS[1])
      if existingId then
        return existingId
      end
      local aggregateId = redis.call('INCR', KEYS[2])
      redis.call('SETEX', KEYS[1], 600, aggregateId)
    `;

    // Build version check operations using KEYS and ARGV
    // Keys start at index 3 (after commandId and counter keys)
    const versionCheckOps: string[] = [];
    let argvIndex = 1;
    for (let i = 0; i < this.versionChecks.size; i++) {
      const keyIndex = i + 3;
      versionCheckOps.push(`
      local len = redis.call('XLEN', KEYS[${keyIndex}])
      local currentVersion = len - 1
      if currentVersion ~= tonumber(ARGV[${argvIndex}]) then
        return redis.error_reply('Version mismatch for ' .. KEYS[${keyIndex}] .. ': expected ' .. ARGV[${argvIndex}] .. ', got ' .. currentVersion)
      end
      `);
      argvIndex++;
    }

    // Build XADD and SET operations using KEYS and ARGV
    const operationCommands: string[] = [];
    const keysOffset = 2 + this.versionChecks.size;
    for (let i = 0; i < this.operations.length; i++) {
      const operation = this.operations[i];
      if (!operation) continue;

      const keyIndex = keysOffset + i + 1;

      if (operation.type === "snapshot") {
        // For snapshots, use SET command
        const dataArgIndex = argvIndex;
        operationCommands.push(
          `redis.call('SET', KEYS[${keyIndex}], ARGV[${dataArgIndex}])`
        );
        argvIndex += 1;
      } else {
        // For event streams, use XADD command
        const versionArgIndex = argvIndex;
        const eventArgIndex = argvIndex + 1;

        // For aggregate-type streams, use "*" to auto-generate ID
        // For per-aggregate streams, use version as the ID
        if (operation.type === "aggregate-type") {
          operationCommands.push(
            `redis.call('XADD', KEYS[${keyIndex}], '*', 'event', ARGV[${eventArgIndex}])`
          );
          argvIndex += 2; // Still increment by 2 for consistency in ARGV indexing
        } else {
          operationCommands.push(
            `redis.call('XADD', KEYS[${keyIndex}], ARGV[${versionArgIndex}], 'event', ARGV[${eventArgIndex}])`
          );
          argvIndex += 2;
        }
      }
    }

    const luaScript = `${dedupCheck}
      ${versionCheckOps.join("\n")}
      ${operationCommands.join("\n")}
      return tostring(aggregateId)
    `;

    // Cache the script for reuse
    scriptCache.set(signature, luaScript);
    return luaScript;
  }

  private getKeysAndArgs(): { keys: string[]; args: (string | Buffer)[] } {
    const keys: string[] = [];
    const args: (string | Buffer)[] = [];

    // First, add deduplication keys
    keys.push(`${RedisPrefix.COMMANDS}${this.commandId}`); // KEYS[1]
    keys.push(`${RedisPrefix.AGGREGATE_TYPE_COUNTERS}${this.aggregateType}`); // KEYS[2]

    // Then, add version check KEYS and their expected versions to ARGV
    for (const [streamName, expectedVersion] of this.versionChecks) {
      keys.push(streamName);
      args.push(expectedVersion.toString());
    }

    // Finally, add operation KEYS and their arguments to ARGV
    for (const op of this.operations) {
      if (op.type === "snapshot") {
        keys.push(op.snapshotKey!);
        args.push(op.snapshotData!);
      } else {
        keys.push(op.streamName!);
        args.push(op.version.toString());
        args.push(op.eventBuffer!);
      }
    }

    return { keys, args };
  }

  async commit() {
    const script = this.constructScript();
    const { keys, args } = this.getKeysAndArgs();

    try {
      // Try using EVALSHA for better performance
      const scriptSha = require("crypto")
        .createHash("sha1")
        .update(script)
        .digest("hex");

      return await this.redis.evalsha(scriptSha, keys.length, ...keys, ...args);
    } catch (error: any) {
      // If script not cached in Redis, fall back to EVAL
      if (error.message?.includes("NOSCRIPT")) {
        return await this.redis.eval(script, keys.length, ...keys, ...args);
      }
      throw error;
    }
  }
}

interface ProjectionOperation {
  command: string; // Redis command like 'HSET', 'SADD', 'LPUSH', etc.
  args: (string | Buffer)[];
}

export class LuaProjectionTransaction {
  private redis: Redis;
  private operations: ProjectionOperation[];
  private versionCheck: { key: string; expectedVersion: number } | null;
  private aggregateId: string | null;
  private expectedVersion: number | null;

  constructor(redis: Redis) {
    this.redis = redis;
    this.operations = [];
    this.versionCheck = null;
    this.aggregateId = null;
    this.expectedVersion = null;
  }

  /**
   * Set up version checking for the given aggregate ID
   */
  private setupVersionCheck(aggregateId: string) {
    if (this.versionCheck) {
      return; // Already set up
    }

    if (this.expectedVersion !== null) {
      this.aggregateId = aggregateId;
      const versionKey = `${RedisPrefix.PROJECTION_VERSION}${aggregateId}`;
      this.versionCheck = {
        key: versionKey,
        expectedVersion: this.expectedVersion,
      };
    }
  }

  /**
   * Set the expected version for this transaction.
   * This will be used when the first operation is added.
   */
  setExpectedVersion(expectedVersion: number) {
    this.expectedVersion = expectedVersion;
  }

  /**
   * Add a hash set operation to the transaction
   */
  hset(
    aggregateId: string,
    key: string,
    field: string,
    value: string | Buffer
  ) {
    this.setupVersionCheck(aggregateId);
    this.operations.push({
      command: "HSET",
      args: [key, field, value],
    });
  }

  set(aggregateId: string, key: string, value: string | Buffer) {
    this.setupVersionCheck(aggregateId);
    this.operations.push({
      command: "SET",
      args: [key, value],
    });
  }

  /**
   * Add a hash multi-set operation to the transaction
   */
  hmset(
    aggregateId: string,
    key: string,
    fields: Record<string, string | Buffer>
  ) {
    this.setupVersionCheck(aggregateId);
    const args: (string | Buffer)[] = [key];
    for (const [field, value] of Object.entries(fields)) {
      args.push(field, value);
    }
    this.operations.push({
      command: "HSET",
      args,
    });
  }

  /**
   * Add a set member operation to the transaction
   */
  sadd(aggregateId: string, key: string, ...members: string[]) {
    this.setupVersionCheck(aggregateId);
    this.operations.push({
      command: "SADD",
      args: [key, ...members],
    });
  }

  /**
   * Add a list push operation to the transaction
   */
  lpush(aggregateId: string, key: string, ...values: string[]) {
    this.setupVersionCheck(aggregateId);
    this.operations.push({
      command: "LPUSH",
      args: [key, ...values],
    });
  }

  /**
   * Delete a key operation to the transaction
   */
  del(aggregateId: string, key: string) {
    this.setupVersionCheck(aggregateId);
    this.operations.push({
      command: "DEL",
      args: [key],
    });
  }

  /**
   * Add a sorted set operation to the transaction
   */
  zadd(aggregateId: string, key: string, score: number, member: string) {
    this.setupVersionCheck(aggregateId);
    this.operations.push({
      command: "ZADD",
      args: [key, score.toString(), member],
    });
  }

  private constructScript(): string {
    if (!this.versionCheck) {
      throw new Error(
        "Expected version must be set before committing projection transaction"
      );
    }

    // Create a signature for caching based on operation structure
    const opSignature = this.operations
      .map((op) => `${op.command}:${op.args.length}`)
      .join("|");
    const signature = `proj:v1:${opSignature}`;

    // Check cache first
    if (scriptCache.has(signature)) {
      return scriptCache.get(signature)!;
    }

    // Version check operation
    // KEYS[1] = version key
    // ARGV[1] = expected version
    const versionCheckOp = `
      local currentVersion = redis.call('GET', KEYS[1])
      if currentVersion == false then
        currentVersion = -1
      else
        currentVersion = tonumber(currentVersion)
      end
      if currentVersion ~= tonumber(ARGV[1]) then
        return redis.error_reply('Version mismatch for ' .. KEYS[1] .. ': expected ' .. ARGV[1] .. ', got ' .. currentVersion)
      end
    `;

    // Build projection operations
    const projectionOps: string[] = [];
    let keyIndex = 2; // Start after version key
    let argvIndex = 2; // Start after expected version

    for (const op of this.operations) {
      const keyPlaceholder = `KEYS[${keyIndex}]`;
      const argPlaceholders: string[] = [];

      // First arg is always the key
      for (let i = 1; i < op.args.length; i++) {
        argPlaceholders.push(`ARGV[${argvIndex}]`);
        argvIndex++;
      }

      const args =
        argPlaceholders.length > 0 ? `, ${argPlaceholders.join(", ")}` : "";

      projectionOps.push(
        `redis.call('${op.command}', ${keyPlaceholder}${args})`
      );
      keyIndex++;
    }

    // Update version after successful operations
    // The new version is the expected version + 1
    const updateVersionOp = `redis.call('SET', KEYS[1], ARGV[1] + 1)`;

    const luaScript = `
      ${versionCheckOp}
      ${projectionOps.join("\n      ")}
      ${updateVersionOp}
      return 'OK'
    `;

    // Cache the script for reuse
    scriptCache.set(signature, luaScript);
    return luaScript;
  }

  private getKeysAndArgs(): { keys: string[]; args: (string | Buffer)[] } {
    if (!this.versionCheck) {
      throw new Error(
        "Expected version must be set before committing projection transaction"
      );
    }

    const keys: string[] = [this.versionCheck.key];
    const args: (string | Buffer)[] = [
      this.versionCheck.expectedVersion.toString(),
    ];

    // Add operation keys and arguments
    for (const op of this.operations) {
      // First arg is the key
      const firstArg = op.args[0];
      if (!firstArg) {
        throw new Error("Operation must have at least one argument (the key)");
      }
      keys.push(firstArg.toString());
      // Rest are the arguments
      for (let i = 1; i < op.args.length; i++) {
        const arg = op.args[i];
        if (arg === undefined) {
          throw new Error(`Operation argument at index ${i} is undefined`);
        }
        args.push(arg);
      }
    }

    return { keys, args };
  }

  async commit() {
    if (!this.versionCheck) {
      throw new Error(
        "Expected version must be set before committing projection transaction"
      );
    }

    if (this.operations.length === 0) {
      // No operations to commit, just update version
      const newVersion = this.versionCheck.expectedVersion + 1;
      await this.redis.set(this.versionCheck.key, newVersion.toString());
      return "OK";
    }

    const script = this.constructScript();
    const { keys, args } = this.getKeysAndArgs();

    try {
      // Try using EVALSHA for better performance
      const scriptSha = require("crypto")
        .createHash("sha1")
        .update(script)
        .digest("hex");

      return await this.redis.evalsha(scriptSha, keys.length, ...keys, ...args);
    } catch (error: any) {
      // If script not cached in Redis, fall back to EVAL
      if (error.message?.includes("NOSCRIPT")) {
        return await this.redis.eval(script, keys.length, ...keys, ...args);
      }
      throw error;
    }
  }
}

// Alias for backwards compatibility
export type LuaTransaction = LuaCommandTransaction;
