import { Database } from "bun:sqlite";
import { createClient } from "@libsql/client";
import type { Client } from "@libsql/client";

type ClientType = "sqlite" | "libsql";

interface ExecuteResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

interface PreparedStatement {
  execute(params?: any[]): Promise<ExecuteResult>;
  query<T = any>(params?: any[]): Promise<T[]>;
  finalize(): Promise<void>;
}

export class SqliteAdapter {
  private client: Database | Client;
  private clientType: ClientType;

  constructor(clientType: ClientType, connectionString: string = "local.db") {
    this.clientType = clientType;

    if (clientType === "sqlite") {
      this.client = new Database(connectionString, { create: true });
      // Enable WAL mode for bun:sqlite
      (this.client as Database).run("PRAGMA journal_mode = WAL;");
    } else {
      this.client = createClient({
        url: connectionString.startsWith("file:") ? connectionString : `file:${connectionString}`,
      });
      // WAL mode will be set after initialization
      this.initializeLibsql();
    }
  }

  private async initializeLibsql(): Promise<void> {
    if (this.clientType === "libsql") {
      await (this.client as Client).execute("PRAGMA journal_mode = WAL;");
    }
  }

  /**
   * Execute a SELECT query and return results as plain objects
   */
  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    if (this.clientType === "sqlite") {
      const db = this.client as Database;
      const stmt = db.query(sql);
      const results = params ? stmt.all(...params) : stmt.all();
      return results as T[];
    } else {
      const client = this.client as Client;
      const result = await client.execute({
        sql,
        args: params || [],
      });
      // Normalize libsql rows to plain objects (remove array-like properties)
      return result.rows.map(row => {
        const plainObj: any = {};
        for (const key in row) {
          // Only include named columns, not numeric indices or 'length'
          if (isNaN(Number(key)) && key !== 'length') {
            plainObj[key] = row[key];
          }
        }
        return plainObj;
      }) as T[];
    }
  }

  /**
   * Execute an INSERT, UPDATE, or DELETE statement
   */
  async execute(sql: string, params?: any[]): Promise<ExecuteResult> {
    if (this.clientType === "sqlite") {
      const db = this.client as Database;
      const stmt = db.query(sql);
      const result = params ? stmt.run(...params) : stmt.run();

      return {
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid,
      };
    } else {
      const client = this.client as Client;
      const result = await client.execute({
        sql,
        args: params || [],
      });

      return {
        changes: result.rowsAffected,
        lastInsertRowid: result.lastInsertRowid || 0n,
      };
    }
  }

  /**
   * Prepare a statement for reuse
   */
  async prepare(sql: string): Promise<PreparedStatement> {
    if (this.clientType === "sqlite") {
      const db = this.client as Database;
      const stmt = db.query(sql);

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
    } else {
      const client = this.client as Client;

      return {
        execute: async (params?: any[]): Promise<ExecuteResult> => {
          const result = await client.execute({
            sql,
            args: params || [],
          });
          return {
            changes: result.rowsAffected,
            lastInsertRowid: result.lastInsertRowid || 0n,
          };
        },
        query: async <T = any>(params?: any[]): Promise<T[]> => {
          const result = await client.execute({
            sql,
            args: params || [],
          });
          // Normalize libsql rows to plain objects
          return result.rows.map(row => {
            const plainObj: any = {};
            for (const key in row) {
              if (isNaN(Number(key)) && key !== 'length') {
                plainObj[key] = row[key];
              }
            }
            return plainObj;
          }) as T[];
        },
        finalize: async (): Promise<void> => {
          // libsql doesn't require explicit finalization
        },
      };
    }
  }

  /**
   * Execute multiple operations in a transaction
   * Automatically rolls back on error
   */
  async transaction<T>(callback: (adapter: SqliteAdapter) => Promise<T>): Promise<T> {
    if (this.clientType === "sqlite") {
      const db = this.client as Database;

      try {
        db.run("BEGIN");
        const result = await callback(this);
        db.run("COMMIT");
        return result;
      } catch (error) {
        db.run("ROLLBACK");
        throw error;
      }
    } else {
      const client = this.client as Client;
      const tx = await client.transaction("write");

      try {
        const result = await callback(this);
        await tx.commit();
        return result;
      } catch (error) {
        await tx.rollback();
        throw error;
      }
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.clientType === "sqlite") {
      (this.client as Database).close();
    } else {
      (this.client as Client).close();
    }
  }

  /**
   * Get the underlying client (for advanced use cases)
   */
  getClient(): Database | Client {
    return this.client;
  }
}

// Export a default instance (can be replaced with your own)
export let db: SqliteAdapter;

export function initializeDatabase(clientType: ClientType, connectionString?: string): SqliteAdapter {
  db = new SqliteAdapter(clientType, connectionString);
  return db;
}
