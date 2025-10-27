import { Database } from "bun:sqlite";
import { createClient } from "@libsql/client";
import type { Client } from "@libsql/client";

/**
 * Result of an INSERT, UPDATE, or DELETE operation
 */
export interface ExecuteResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

/**
 * Prepared statement interface for reusable queries
 */
export interface PreparedStatement {
  execute(params?: any[]): Promise<ExecuteResult>;
  query<T = any>(params?: any[]): Promise<T[]>;
  finalize(): Promise<void>;
}

/**
 * Common database adapter interface
 */
export interface DatabaseAdapter {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<ExecuteResult>;
  prepare(sql: string): Promise<PreparedStatement>;
  transaction<T>(callback: (adapter: DatabaseAdapter) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/**
 * Bun SQLite adapter using bun:sqlite
 */
export class BunSqliteAdapter implements DatabaseAdapter {
  private client: Database;

  constructor(connectionString: string, schemas: string[]) {
    this.client = new Database(connectionString, { create: true });

    // Enable WAL mode
    this.client.run("PRAGMA journal_mode = WAL;");

    // Execute schemas
    for (const sql of schemas) {
      this.client.run(sql);
    }
  }

  /**
   * Execute a SELECT query and return results as plain objects
   */
  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const stmt = this.client.query(sql);
    const results = params ? stmt.all(...params) : stmt.all();
    return results as T[];
  }

  /**
   * Execute an INSERT, UPDATE, or DELETE statement
   */
  async execute(sql: string, params?: any[]): Promise<ExecuteResult> {
    const stmt = this.client.query(sql);
    const result = params ? stmt.run(...params) : stmt.run();

    return {
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid,
    };
  }

  /**
   * Prepare a statement for reuse
   */
  async prepare(sql: string): Promise<PreparedStatement> {
    const stmt = this.client.query(sql);

    return {
      execute: async (params?: any[]): Promise<ExecuteResult> => {
        const result = params ? stmt.run(...params) : stmt.run();
        return {
          changes: result.changes,
          lastInsertRowid: result.lastInsertRowid,
        };
      },
      query: async <T = any>(params?: any[]): Promise<T[]> => {
        const results = params ? stmt.all(...params) : stmt.all();
        return results as T[];
      },
      finalize: async (): Promise<void> => {
        stmt.finalize();
      },
    };
  }

  /**
   * Execute multiple operations in a transaction
   * Automatically rolls back on error
   */
  async transaction<T>(callback: (adapter: DatabaseAdapter) => Promise<T>): Promise<T> {
    try {
      this.client.run("BEGIN");
      const result = await callback(this);
      this.client.run("COMMIT");
      return result;
    } catch (error) {
      this.client.run("ROLLBACK");
      throw error;
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    this.client.close();
  }

  /**
   * Get the underlying client (for advanced use cases)
   */
  getClient(): Database {
    return this.client;
  }
}

/**
 * LibSQL adapter using @libsql/client
 */
export class LibsqlAdapter implements DatabaseAdapter {
  private client: Client;
  private activeTransaction?: any;

  constructor(connectionString: string, schemas: string[]) {
    this.client = createClient({
      url: connectionString.startsWith("file:") ? connectionString : `file:${connectionString}`,
    });

    // Initialize asynchronously
    this.initialize(schemas);
  }

  private async initialize(schemas: string[]): Promise<void> {
    // Enable WAL mode
    await this.client.execute("PRAGMA journal_mode = WAL;");

    // Execute schemas
    for (const sql of schemas) {
      await this.client.execute(sql);
    }
  }

  /**
   * Execute a SELECT query and return results as plain objects
   */
  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    // Use active transaction if available, otherwise use client
    const executor = this.activeTransaction || this.client;
    const result = await executor.execute({
      sql,
      args: params || [],
    });

    // Normalize libsql rows to plain objects (remove array-like properties)
    return result.rows.map((row: any) => this.normalizeRow(row)) as T[];
  }

  /**
   * Execute an INSERT, UPDATE, or DELETE statement
   */
  async execute(sql: string, params?: any[]): Promise<ExecuteResult> {
    // Use active transaction if available, otherwise use client
    const executor = this.activeTransaction || this.client;
    const result = await executor.execute({
      sql,
      args: params || [],
    });

    return {
      changes: result.rowsAffected,
      lastInsertRowid: result.lastInsertRowid || 0n,
    };
  }

  /**
   * Prepare a statement for reuse
   */
  async prepare(sql: string): Promise<PreparedStatement> {
    return {
      execute: async (params?: any[]): Promise<ExecuteResult> => {
        const executor = this.activeTransaction || this.client;
        const result = await executor.execute({
          sql,
          args: params || [],
        });
        return {
          changes: result.rowsAffected,
          lastInsertRowid: result.lastInsertRowid || 0n,
        };
      },
      query: async <T = any>(params?: any[]): Promise<T[]> => {
        const executor = this.activeTransaction || this.client;
        const result = await executor.execute({
          sql,
          args: params || [],
        });
        // Normalize libsql rows to plain objects
        return result.rows.map((row: any) => this.normalizeRow(row)) as T[];
      },
      finalize: async (): Promise<void> => {
        // libsql doesn't require explicit finalization
      },
    };
  }

  /**
   * Execute multiple operations in a transaction
   * Automatically rolls back on error
   */
  async transaction<T>(callback: (adapter: DatabaseAdapter) => Promise<T>): Promise<T> {
    const tx = await this.client.transaction("write");

    try {
      // Set active transaction so queries use it
      this.activeTransaction = tx;
      const result = await callback(this);
      await tx.commit();
      return result;
    } catch (error) {
      await tx.rollback();
      throw error;
    } finally {
      // Clear active transaction
      this.activeTransaction = undefined;
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    this.client.close();
  }

  /**
   * Get the underlying client (for advanced use cases)
   */
  getClient(): Client {
    return this.client;
  }

  /**
   * Normalize libsql row to plain object
   * Removes array-like properties (numeric indices, length)
   */
  private normalizeRow(row: any): any {
    const plainObj: any = {};
    for (const key in row) {
      // Only include named columns, not numeric indices or 'length'
      if (isNaN(Number(key)) && key !== "length") {
        plainObj[key] = row[key];
      }
    }
    return plainObj;
  }
}
