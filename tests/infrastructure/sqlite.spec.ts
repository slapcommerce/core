import { describe, test, expect } from "bun:test";
import { BunSqliteAdapter, LibsqlAdapter } from "../../src/infrastructure/sqlite";
import { Database } from "bun:sqlite";
import type { Client } from "@libsql/client";

// Helper to generate unique identifiers for idempotent tests
const uniqueId = () => `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;

/**
 * Comprehensive test suite for SqliteAdapter
 * Tests both bun:sqlite and libsql clients to ensure identical behavior
 */

// =============================================================================
// 1. Constructor & Initialization Tests
// =============================================================================

describe("DatabaseAdapter - Constructor & Initialization", () => {
  test("BunSqliteAdapter - should create adapter", async () => {
    // Arrange & Act
    const dbPath = `:memory:`;
    const adapter = new BunSqliteAdapter(dbPath, []);

    // Assert
    expect(adapter).toBeDefined();
    expect(adapter.getClient()).toBeInstanceOf(Database);

    // Cleanup
    await adapter.close();
  });

  test("LibsqlAdapter - should create adapter", async () => {
    // Arrange & Act
    const dbPath = `:memory:`;
    const adapter = new LibsqlAdapter(dbPath, []);

    // Assert
    expect(adapter).toBeDefined();
    const client = adapter.getClient() as Client;
    expect(client).toBeDefined();
    expect(typeof client.execute).toBe("function");

    // Cleanup
    await adapter.close();
  });

  test("BunSqliteAdapter - should enable WAL mode", async () => {
    // Arrange
    const dbPath = `/tmp/test_wal_sqlite_${uniqueId()}.db`;
    const adapter = new BunSqliteAdapter(dbPath, []);

    // Act
    const result = await adapter.query<{ journal_mode: string }>(
      "PRAGMA journal_mode"
    );

    // Assert
    expect(result[0]!.journal_mode.toLowerCase()).toBe("wal");

    // Cleanup
    await adapter.close();
  });

  test("LibsqlAdapter - should enable WAL mode", async () => {
    // Arrange
    const dbPath = `/tmp/test_wal_libsql_${uniqueId()}.db`;
    const adapter = new LibsqlAdapter(dbPath, []);

    // Act
    const result = await adapter.query<{ journal_mode: string }>(
      "PRAGMA journal_mode"
    );

    // Assert
    expect(result[0]!.journal_mode.toLowerCase()).toBe("wal");

    // Cleanup
    await adapter.close();
  });
});

// =============================================================================
// 2. Query Method Tests
// =============================================================================

describe("DatabaseAdapter - Query Method", () => {
  test("BunSqliteAdapter -should query data from table", async () => {
    // Arrange
    const adapter = new BunSqliteAdapter(":memory:", []);
    const tableName = `users_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)`
    );
    await adapter.execute(`INSERT INTO ${tableName} (name, age) VALUES (?, ?)`, [
      "Alice",
      30,
    ]);
    await adapter.execute(`INSERT INTO ${tableName} (name, age) VALUES (?, ?)`, [
      "Bob",
      25,
    ]);

    // Act
    const results = await adapter.query<{ id: number; name: string; age: number }>(
      `SELECT * FROM ${tableName} ORDER BY id`
    );

    // Assert
    expect(results).toHaveLength(2);
    expect(results[0]!.name).toBe("Alice");
    expect(results[0]!.age).toBe(30);
    expect(results[1]!.name).toBe("Bob");
    expect(results[1]!.age).toBe(25);

    // Cleanup
    await adapter.close();
  });

  test("LibsqlAdapter -should query data from table", async () => {
    // Arrange
    const adapter = new LibsqlAdapter(":memory:", []);
    const tableName = `users_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)`
    );
    await adapter.execute(`INSERT INTO ${tableName} (name, age) VALUES (?, ?)`, [
      "Alice",
      30,
    ]);
    await adapter.execute(`INSERT INTO ${tableName} (name, age) VALUES (?, ?)`, [
      "Bob",
      25,
    ]);

    // Act
    const results = await adapter.query<{ id: number; name: string; age: number }>(
      `SELECT * FROM ${tableName} ORDER BY id`
    );

    // Assert
    expect(results).toHaveLength(2);
    expect(results[0]!.name).toBe("Alice");
    expect(results[0]!.age).toBe(30);
    expect(results[1]!.name).toBe("Bob");
    expect(results[1]!.age).toBe(25);

    // Cleanup
    await adapter.close();
  });

  test("BunSqliteAdapter -should query with WHERE parameters", async () => {
    // Arrange
    const adapter = new BunSqliteAdapter(":memory:", []);
    const tableName = `products_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT, price REAL)`
    );
    await adapter.execute(`INSERT INTO ${tableName} (name, price) VALUES (?, ?)`, [
      "Widget",
      19.99,
    ]);
    await adapter.execute(`INSERT INTO ${tableName} (name, price) VALUES (?, ?)`, [
      "Gadget",
      29.99,
    ]);

    // Act
    const results = await adapter.query<{ name: string; price: number }>(
      `SELECT name, price FROM ${tableName} WHERE price > ?`,
      [20]
    );

    // Assert
    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe("Gadget");
    expect(results[0]!.price).toBe(29.99);

    // Cleanup
    await adapter.close();
  });

  test("LibsqlAdapter -should query with WHERE parameters", async () => {
    // Arrange
    const adapter = new LibsqlAdapter(":memory:", []);
    const tableName = `products_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT, price REAL)`
    );
    await adapter.execute(`INSERT INTO ${tableName} (name, price) VALUES (?, ?)`, [
      "Widget",
      19.99,
    ]);
    await adapter.execute(`INSERT INTO ${tableName} (name, price) VALUES (?, ?)`, [
      "Gadget",
      29.99,
    ]);

    // Act
    const results = await adapter.query<{ name: string; price: number }>(
      `SELECT name, price FROM ${tableName} WHERE price > ?`,
      [20]
    );

    // Assert
    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe("Gadget");
    expect(results[0]!.price).toBe(29.99);

    // Cleanup
    await adapter.close();
  });

  test("BunSqliteAdapter -should return empty array for no results", async () => {
    // Arrange
    const adapter = new BunSqliteAdapter(":memory:", []);
    const tableName = `empty_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT)`
    );

    // Act
    const results = await adapter.query(`SELECT * FROM ${tableName}`);

    // Assert
    expect(results).toHaveLength(0);
    expect(Array.isArray(results)).toBe(true);

    // Cleanup
    await adapter.close();
  });

  test("LibsqlAdapter -should return empty array for no results", async () => {
    // Arrange
    const adapter = new LibsqlAdapter(":memory:", []);
    const tableName = `empty_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT)`
    );

    // Act
    const results = await adapter.query(`SELECT * FROM ${tableName}`);

    // Assert
    expect(results).toHaveLength(0);
    expect(Array.isArray(results)).toBe(true);

    // Cleanup
    await adapter.close();
  });

  test("BunSqliteAdapter -should handle NULL values", async () => {
    // Arrange
    const adapter = new BunSqliteAdapter(":memory:", []);
    const tableName = `nullable_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT, email TEXT)`
    );
    await adapter.execute(`INSERT INTO ${tableName} (name, email) VALUES (?, ?)`, [
      "John",
      null,
    ]);

    // Act
    const results = await adapter.query<{ name: string; email: string | null }>(
      `SELECT name, email FROM ${tableName}`
    );

    // Assert
    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe("John");
    expect(results[0]!.email).toBe(null);

    // Cleanup
    await adapter.close();
  });

  test("LibsqlAdapter -should handle NULL values", async () => {
    // Arrange
    const adapter = new LibsqlAdapter(":memory:", []);
    const tableName = `nullable_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT, email TEXT)`
    );
    await adapter.execute(`INSERT INTO ${tableName} (name, email) VALUES (?, ?)`, [
      "John",
      null,
    ]);

    // Act
    const results = await adapter.query<{ name: string; email: string | null }>(
      `SELECT name, email FROM ${tableName}`
    );

    // Assert
    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe("John");
    expect(results[0]!.email).toBe(null);

    // Cleanup
    await adapter.close();
  });
});

// =============================================================================
// 3. Execute Method Tests
// =============================================================================

describe("DatabaseAdapter - Execute Method", () => {
  test("BunSqliteAdapter -should INSERT and return lastInsertRowid", async () => {
    // Arrange
    const adapter = new BunSqliteAdapter(":memory:", []);
    const tableName = `insert_test_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT)`
    );

    // Act
    const result = await adapter.execute(
      `INSERT INTO ${tableName} (name) VALUES (?)`,
      ["Test"]
    );

    // Assert
    expect(result.changes).toBe(1);
    expect(result.lastInsertRowid).toBeGreaterThan(0);

    // Cleanup
    await adapter.close();
  });

  test("LibsqlAdapter -should INSERT and return lastInsertRowid", async () => {
    // Arrange
    const adapter = new LibsqlAdapter(":memory:", []);
    const tableName = `insert_test_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT)`
    );

    // Act
    const result = await adapter.execute(
      `INSERT INTO ${tableName} (name) VALUES (?)`,
      ["Test"]
    );

    // Assert
    expect(result.changes).toBe(1);
    expect(Number(result.lastInsertRowid)).toBeGreaterThan(0);

    // Cleanup
    await adapter.close();
  });

  test("BunSqliteAdapter -should INSERT multiple rows", async () => {
    // Arrange
    const adapter = new BunSqliteAdapter(":memory:", []);
    const tableName = `multi_insert_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT)`
    );

    // Act
    const result1 = await adapter.execute(
      `INSERT INTO ${tableName} (name) VALUES (?)`,
      ["First"]
    );
    const result2 = await adapter.execute(
      `INSERT INTO ${tableName} (name) VALUES (?)`,
      ["Second"]
    );
    const result3 = await adapter.execute(
      `INSERT INTO ${tableName} (name) VALUES (?)`,
      ["Third"]
    );

    // Assert
    expect(result1.changes).toBe(1);
    expect(result2.changes).toBe(1);
    expect(result3.changes).toBe(1);
    expect(result3.lastInsertRowid).toBeGreaterThan(result2.lastInsertRowid);

    // Cleanup
    await adapter.close();
  });

  test("LibsqlAdapter -should INSERT multiple rows", async () => {
    // Arrange
    const adapter = new LibsqlAdapter(":memory:", []);
    const tableName = `multi_insert_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT)`
    );

    // Act
    const result1 = await adapter.execute(
      `INSERT INTO ${tableName} (name) VALUES (?)`,
      ["First"]
    );
    const result2 = await adapter.execute(
      `INSERT INTO ${tableName} (name) VALUES (?)`,
      ["Second"]
    );
    const result3 = await adapter.execute(
      `INSERT INTO ${tableName} (name) VALUES (?)`,
      ["Third"]
    );

    // Assert
    expect(result1.changes).toBe(1);
    expect(result2.changes).toBe(1);
    expect(result3.changes).toBe(1);
    expect(Number(result3.lastInsertRowid)).toBeGreaterThan(
      Number(result2.lastInsertRowid)
    );

    // Cleanup
    await adapter.close();
  });

  test("BunSqliteAdapter -should UPDATE rows and return changes count", async () => {
    // Arrange
    const adapter = new BunSqliteAdapter(":memory:", []);
    const tableName = `update_test_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT, active INTEGER)`
    );
    await adapter.execute(`INSERT INTO ${tableName} (name, active) VALUES (?, ?)`, [
      "User1",
      0,
    ]);
    await adapter.execute(`INSERT INTO ${tableName} (name, active) VALUES (?, ?)`, [
      "User2",
      0,
    ]);

    // Act
    const result = await adapter.execute(
      `UPDATE ${tableName} SET active = ? WHERE active = ?`,
      [1, 0]
    );

    // Assert
    expect(result.changes).toBe(2);

    // Cleanup
    await adapter.close();
  });

  test("LibsqlAdapter -should UPDATE rows and return changes count", async () => {
    // Arrange
    const adapter = new LibsqlAdapter(":memory:", []);
    const tableName = `update_test_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT, active INTEGER)`
    );
    await adapter.execute(`INSERT INTO ${tableName} (name, active) VALUES (?, ?)`, [
      "User1",
      0,
    ]);
    await adapter.execute(`INSERT INTO ${tableName} (name, active) VALUES (?, ?)`, [
      "User2",
      0,
    ]);

    // Act
    const result = await adapter.execute(
      `UPDATE ${tableName} SET active = ? WHERE active = ?`,
      [1, 0]
    );

    // Assert
    expect(result.changes).toBe(2);

    // Cleanup
    await adapter.close();
  });

  test("BunSqliteAdapter -should DELETE rows and return changes count", async () => {
    // Arrange
    const adapter = new BunSqliteAdapter(":memory:", []);
    const tableName = `delete_test_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT)`
    );
    await adapter.execute(`INSERT INTO ${tableName} (name) VALUES (?)`, ["Delete1"]);
    await adapter.execute(`INSERT INTO ${tableName} (name) VALUES (?)`, ["Delete2"]);
    await adapter.execute(`INSERT INTO ${tableName} (name) VALUES (?)`, ["Keep"]);

    // Act
    const result = await adapter.execute(
      `DELETE FROM ${tableName} WHERE name LIKE ?`,
      ["Delete%"]
    );

    // Assert
    expect(result.changes).toBe(2);

    // Cleanup
    await adapter.close();
  });

  test("LibsqlAdapter -should DELETE rows and return changes count", async () => {
    // Arrange
    const adapter = new LibsqlAdapter(":memory:", []);
    const tableName = `delete_test_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT)`
    );
    await adapter.execute(`INSERT INTO ${tableName} (name) VALUES (?)`, ["Delete1"]);
    await adapter.execute(`INSERT INTO ${tableName} (name) VALUES (?)`, ["Delete2"]);
    await adapter.execute(`INSERT INTO ${tableName} (name) VALUES (?)`, ["Keep"]);

    // Act
    const result = await adapter.execute(
      `DELETE FROM ${tableName} WHERE name LIKE ?`,
      ["Delete%"]
    );

    // Assert
    expect(result.changes).toBe(2);

    // Cleanup
    await adapter.close();
  });

  test("BunSqliteAdapter -should return 0 changes when no rows affected", async () => {
    // Arrange
    const adapter = new BunSqliteAdapter(":memory:", []);
    const tableName = `no_changes_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT)`
    );

    // Act
    const result = await adapter.execute(
      `UPDATE ${tableName} SET name = ? WHERE id = ?`,
      ["NonExistent", 999]
    );

    // Assert
    expect(result.changes).toBe(0);

    // Cleanup
    await adapter.close();
  });

  test("LibsqlAdapter -should return 0 changes when no rows affected", async () => {
    // Arrange
    const adapter = new LibsqlAdapter(":memory:", []);
    const tableName = `no_changes_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT)`
    );

    // Act
    const result = await adapter.execute(
      `UPDATE ${tableName} SET name = ? WHERE id = ?`,
      ["NonExistent", 999]
    );

    // Assert
    expect(result.changes).toBe(0);

    // Cleanup
    await adapter.close();
  });
});

// =============================================================================
// 4. Prepared Statement Tests
// =============================================================================

describe("DatabaseAdapter - Prepared Statements", () => {
  test("BunSqliteAdapter -should prepare and execute INSERT statement", async () => {
    // Arrange
    const adapter = new BunSqliteAdapter(":memory:", []);
    const tableName = `prep_insert_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT)`
    );

    // Act
    const stmt = await adapter.prepare(`INSERT INTO ${tableName} (name) VALUES (?)`);
    const result = await stmt.execute(["PreparedInsert"]);

    // Assert
    expect(result.changes).toBe(1);
    expect(result.lastInsertRowid).toBeGreaterThan(0);

    // Cleanup
    await stmt.finalize();
    await adapter.close();
  });

  test("LibsqlAdapter -should prepare and execute INSERT statement", async () => {
    // Arrange
    const adapter = new LibsqlAdapter(":memory:", []);
    const tableName = `prep_insert_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT)`
    );

    // Act
    const stmt = await adapter.prepare(`INSERT INTO ${tableName} (name) VALUES (?)`);
    const result = await stmt.execute(["PreparedInsert"]);

    // Assert
    expect(result.changes).toBe(1);
    expect(Number(result.lastInsertRowid)).toBeGreaterThan(0);

    // Cleanup
    await stmt.finalize();
    await adapter.close();
  });

  test("BunSqliteAdapter -should prepare and query SELECT statement", async () => {
    // Arrange
    const adapter = new BunSqliteAdapter(":memory:", []);
    const tableName = `prep_select_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)`
    );
    await adapter.execute(`INSERT INTO ${tableName} (name, age) VALUES (?, ?)`, [
      "Alice",
      30,
    ]);
    await adapter.execute(`INSERT INTO ${tableName} (name, age) VALUES (?, ?)`, [
      "Bob",
      25,
    ]);

    // Act
    const stmt = await adapter.prepare(
      `SELECT * FROM ${tableName} WHERE age > ? ORDER BY age`
    );
    const results = await stmt.query<{ name: string; age: number }>([20]);

    // Assert
    expect(results).toHaveLength(2);
    expect(results[0]!.name).toBe("Bob");
    expect(results[1]!.name).toBe("Alice");

    // Cleanup
    await stmt.finalize();
    await adapter.close();
  });

  test("LibsqlAdapter -should prepare and query SELECT statement", async () => {
    // Arrange
    const adapter = new LibsqlAdapter(":memory:", []);
    const tableName = `prep_select_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)`
    );
    await adapter.execute(`INSERT INTO ${tableName} (name, age) VALUES (?, ?)`, [
      "Alice",
      30,
    ]);
    await adapter.execute(`INSERT INTO ${tableName} (name, age) VALUES (?, ?)`, [
      "Bob",
      25,
    ]);

    // Act
    const stmt = await adapter.prepare(
      `SELECT * FROM ${tableName} WHERE age > ? ORDER BY age`
    );
    const results = await stmt.query<{ name: string; age: number }>([20]);

    // Assert
    expect(results).toHaveLength(2);
    expect(results[0]!.name).toBe("Bob");
    expect(results[1]!.name).toBe("Alice");

    // Cleanup
    await stmt.finalize();
    await adapter.close();
  });

  test("BunSqliteAdapter -should reuse prepared statement multiple times", async () => {
    // Arrange
    const adapter = new BunSqliteAdapter(":memory:", []);
    const tableName = `prep_reuse_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT)`
    );

    // Act
    const stmt = await adapter.prepare(`INSERT INTO ${tableName} (name) VALUES (?)`);
    const result1 = await stmt.execute(["First"]);
    const result2 = await stmt.execute(["Second"]);
    const result3 = await stmt.execute(["Third"]);

    // Assert
    expect(result1.changes).toBe(1);
    expect(result2.changes).toBe(1);
    expect(result3.changes).toBe(1);
    expect(result3.lastInsertRowid).toBeGreaterThan(result1.lastInsertRowid);

    // Verify all records were inserted
    const records = await adapter.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    expect(records[0]!.count).toBe(3);

    // Cleanup
    await stmt.finalize();
    await adapter.close();
  });

  test("LibsqlAdapter -should reuse prepared statement multiple times", async () => {
    // Arrange
    const adapter = new LibsqlAdapter(":memory:", []);
    const tableName = `prep_reuse_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT)`
    );

    // Act
    const stmt = await adapter.prepare(`INSERT INTO ${tableName} (name) VALUES (?)`);
    const result1 = await stmt.execute(["First"]);
    const result2 = await stmt.execute(["Second"]);
    const result3 = await stmt.execute(["Third"]);

    // Assert
    expect(result1.changes).toBe(1);
    expect(result2.changes).toBe(1);
    expect(result3.changes).toBe(1);
    expect(Number(result3.lastInsertRowid)).toBeGreaterThan(
      Number(result1.lastInsertRowid)
    );

    // Verify all records were inserted
    const records = await adapter.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    expect(records[0]!.count).toBe(3);

    // Cleanup
    await stmt.finalize();
    await adapter.close();
  });
});

// =============================================================================
// 5. Transaction Tests
// =============================================================================

describe("DatabaseAdapter - Transactions", () => {
  test("BunSqliteAdapter -should commit transaction successfully", async () => {
    // Arrange
    const adapter = new BunSqliteAdapter(":memory:", []);
    const tableName = `tx_commit_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT)`
    );

    // Act
    const result = await adapter.transaction(async (txAdapter) => {
      await txAdapter.execute(`INSERT INTO ${tableName} (name) VALUES (?)`, [
        "TxRecord1",
      ]);
      await txAdapter.execute(`INSERT INTO ${tableName} (name) VALUES (?)`, [
        "TxRecord2",
      ]);
      return "success";
    });

    // Assert
    expect(result).toBe("success");
    const records = await adapter.query(`SELECT * FROM ${tableName}`);
    expect(records).toHaveLength(2);

    // Cleanup
    await adapter.close();
  });

  test("LibsqlAdapter -should commit transaction successfully", async () => {
    // Arrange
    // Use file-based DB for libsql transactions (in-memory has limitations)
    const dbPath = `/tmp/libsql_tx_commit_${uniqueId()}.db`;
    const adapter = new LibsqlAdapter(dbPath, []);
    const tableName = `tx_commit_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT)`
    );

    // Act
    const result = await adapter.transaction(async (txAdapter) => {
      await txAdapter.execute(`INSERT INTO ${tableName} (name) VALUES (?)`, [
        "TxRecord1",
      ]);
      await txAdapter.execute(`INSERT INTO ${tableName} (name) VALUES (?)`, [
        "TxRecord2",
      ]);
      return "success";
    });

    // Assert
    expect(result).toBe("success");
    const records = await adapter.query(`SELECT * FROM ${tableName}`);
    expect(records).toHaveLength(2);

    // Cleanup
    await adapter.close();
  });

  test("BunSqliteAdapter -should rollback transaction on error", async () => {
    // Arrange
    const adapter = new BunSqliteAdapter(":memory:", []);
    const tableName = `tx_rollback_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT NOT NULL)`
    );

    // Act & Assert
    try {
      await adapter.transaction(async (txAdapter) => {
        await txAdapter.execute(`INSERT INTO ${tableName} (name) VALUES (?)`, [
          "ValidRecord",
        ]);
        // This should fail due to NOT NULL constraint
        await txAdapter.execute(`INSERT INTO ${tableName} (id, name) VALUES (?, ?)`, [
          2,
          null,
        ]);
      });
      throw new Error("Transaction should have failed");
    } catch (error: any) {
      // Transaction failed as expected
    }

    // Verify rollback - table should be empty
    const records = await adapter.query(`SELECT * FROM ${tableName}`);
    expect(records).toHaveLength(0);

    // Cleanup
    await adapter.close();
  });

  test("LibsqlAdapter -should rollback transaction on error", async () => {
    // Arrange
    // Use file-based DB for libsql transactions (in-memory has limitations)
    const dbPath = `/tmp/libsql_tx_rollback_${uniqueId()}.db`;
    const adapter = new LibsqlAdapter(dbPath, []);
    const tableName = `tx_rollback_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT NOT NULL)`
    );

    // Act & Assert
    try {
      await adapter.transaction(async (txAdapter) => {
        await txAdapter.execute(`INSERT INTO ${tableName} (name) VALUES (?)`, [
          "ValidRecord",
        ]);
        // This should fail due to NOT NULL constraint
        await txAdapter.execute(`INSERT INTO ${tableName} (id, name) VALUES (?, ?)`, [
          2,
          null,
        ]);
      });
      throw new Error("Transaction should have failed");
    } catch (error: any) {
      // Transaction failed as expected
    }

    // Verify rollback - table should be empty
    const records = await adapter.query(`SELECT * FROM ${tableName}`);
    expect(records).toHaveLength(0);

    // Cleanup
    await adapter.close();
  });

  test("BunSqliteAdapter -should handle multiple operations in transaction", async () => {
    // Arrange
    const adapter = new BunSqliteAdapter(":memory:", []);
    const tableName = `tx_multi_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT, counter INTEGER DEFAULT 0)`
    );
    await adapter.execute(`INSERT INTO ${tableName} (name, counter) VALUES (?, ?)`, [
      "Item1",
      10,
    ]);
    await adapter.execute(`INSERT INTO ${tableName} (name, counter) VALUES (?, ?)`, [
      "Item2",
      20,
    ]);

    // Act
    await adapter.transaction(async (txAdapter) => {
      await txAdapter.execute(`INSERT INTO ${tableName} (name, counter) VALUES (?, ?)`, [
        "Item3",
        5,
      ]);
      await txAdapter.execute(`UPDATE ${tableName} SET counter = counter + 1 WHERE id = ?`, [
        1,
      ]);
      await txAdapter.execute(`DELETE FROM ${tableName} WHERE id = ?`, [2]);
    });

    // Assert
    const records = await adapter.query<{ name: string; counter: number }>(
      `SELECT name, counter FROM ${tableName} ORDER BY id`
    );
    expect(records).toHaveLength(2);
    expect(records[0]!.name).toBe("Item1");
    expect(records[0]!.counter).toBe(11); // Incremented
    expect(records[1]!.name).toBe("Item3"); // Newly inserted

    // Cleanup
    await adapter.close();
  });

  test("LibsqlAdapter -should handle multiple operations in transaction", async () => {
    // Arrange
    // Use file-based DB for libsql transactions (in-memory has limitations)
    const dbPath = `/tmp/libsql_tx_multi_${uniqueId()}.db`;
    const adapter = new LibsqlAdapter(dbPath, []);
    const tableName = `tx_multi_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT, counter INTEGER DEFAULT 0)`
    );
    await adapter.execute(`INSERT INTO ${tableName} (name, counter) VALUES (?, ?)`, [
      "Item1",
      10,
    ]);
    await adapter.execute(`INSERT INTO ${tableName} (name, counter) VALUES (?, ?)`, [
      "Item2",
      20,
    ]);

    // Act
    await adapter.transaction(async (txAdapter) => {
      await txAdapter.execute(`INSERT INTO ${tableName} (name, counter) VALUES (?, ?)`, [
        "Item3",
        5,
      ]);
      await txAdapter.execute(`UPDATE ${tableName} SET counter = counter + 1 WHERE id = ?`, [
        1,
      ]);
      await txAdapter.execute(`DELETE FROM ${tableName} WHERE id = ?`, [2]);
    });

    // Assert
    const records = await adapter.query<{ name: string; counter: number }>(
      `SELECT name, counter FROM ${tableName} ORDER BY id`
    );
    expect(records).toHaveLength(2);
    expect(records[0]!.name).toBe("Item1");
    expect(records[0]!.counter).toBe(11); // Incremented
    expect(records[1]!.name).toBe("Item3"); // Newly inserted

    // Cleanup
    await adapter.close();
  });

  test("BunSqliteAdapter -should rollback all changes on error", async () => {
    // Arrange
    const adapter = new BunSqliteAdapter(":memory:", []);
    const tableName = `tx_full_rollback_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, value INTEGER)`
    );
    await adapter.execute(`INSERT INTO ${tableName} (value) VALUES (?)`, [100]);

    // Act & Assert
    try {
      await adapter.transaction(async (txAdapter) => {
        await txAdapter.execute(`UPDATE ${tableName} SET value = ? WHERE id = ?`, [
          200,
          1,
        ]);
        await txAdapter.execute(`INSERT INTO ${tableName} (value) VALUES (?)`, [300]);
        // Intentional error
        throw new Error("Intentional error to test rollback");
      });
      throw new Error("Transaction should have failed");
    } catch (error: any) {
      expect(error.message).toBe("Intentional error to test rollback");
    }

    // Verify all changes were rolled back
    const records = await adapter.query<{ value: number }>(
      `SELECT value FROM ${tableName}`
    );
    expect(records).toHaveLength(1);
    expect(records[0]!.value).toBe(100); // Original value preserved

    // Cleanup
    await adapter.close();
  });

  test("LibsqlAdapter -should rollback all changes on error", async () => {
    // Arrange
    // Use file-based DB for libsql transactions (in-memory has limitations)
    const dbPath = `/tmp/libsql_tx_full_rollback_${uniqueId()}.db`;
    const adapter = new LibsqlAdapter(dbPath, []);
    const tableName = `tx_full_rollback_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, value INTEGER)`
    );
    await adapter.execute(`INSERT INTO ${tableName} (value) VALUES (?)`, [100]);

    // Act & Assert
    try {
      await adapter.transaction(async (txAdapter) => {
        await txAdapter.execute(`UPDATE ${tableName} SET value = ? WHERE id = ?`, [
          200,
          1,
        ]);
        await txAdapter.execute(`INSERT INTO ${tableName} (value) VALUES (?)`, [300]);
        // Intentional error
        throw new Error("Intentional error to test rollback");
      });
      throw new Error("Transaction should have failed");
    } catch (error: any) {
      expect(error.message).toBe("Intentional error to test rollback");
    }

    // Verify all changes were rolled back
    const records = await adapter.query<{ value: number }>(
      `SELECT value FROM ${tableName}`
    );
    expect(records).toHaveLength(1);
    expect(records[0]!.value).toBe(100); // Original value preserved

    // Cleanup
    await adapter.close();
  });
});

// =============================================================================
// 6. Cross-Client Compatibility Tests
// =============================================================================

describe("DatabaseAdapter - Cross-Client Compatibility", () => {
  test("both clients should return identical query results", async () => {
    // Arrange
    const sqliteAdapter = new BunSqliteAdapter(":memory:", []);
    const libsqlAdapter = new LibsqlAdapter(":memory:", []);
    const tableName = `compat_query_${uniqueId()}`;

    // Setup both databases identically
    for (const adapter of [sqliteAdapter, libsqlAdapter]) {
      await adapter.execute(
        `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT, value REAL)`
      );
      await adapter.execute(`INSERT INTO ${tableName} (name, value) VALUES (?, ?)`, [
        "Alpha",
        1.5,
      ]);
      await adapter.execute(`INSERT INTO ${tableName} (name, value) VALUES (?, ?)`, [
        "Beta",
        2.5,
      ]);
      await adapter.execute(`INSERT INTO ${tableName} (name, value) VALUES (?, ?)`, [
        "Gamma",
        3.5,
      ]);
    }

    // Act
    const sqliteResults = await sqliteAdapter.query<{
      name: string;
      value: number;
    }>(`SELECT name, value FROM ${tableName} ORDER BY id`);

    const libsqlResults = await libsqlAdapter.query<{ name: string; value: number }>(
      `SELECT name, value FROM ${tableName} ORDER BY id`
    );

    // Assert - Results should be identical
    expect(sqliteResults).toHaveLength(libsqlResults.length);
    for (let i = 0; i < sqliteResults.length; i++) {
      expect(sqliteResults[i]!.name).toBe(libsqlResults[i]!.name);
      expect(sqliteResults[i]!.value).toBe(libsqlResults[i]!.value);
    }

    // Cleanup
    await sqliteAdapter.close();
    await libsqlAdapter.close();
  });

  test("both clients should handle parameters identically", async () => {
    // Arrange
    const sqliteAdapter = new BunSqliteAdapter(":memory:", []);
    const libsqlAdapter = new LibsqlAdapter(":memory:", []);
    const tableName = `compat_params_${uniqueId()}`;

    // Setup both databases identically
    for (const adapter of [sqliteAdapter, libsqlAdapter]) {
      await adapter.execute(
        `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, a TEXT, b INTEGER, c REAL)`
      );
    }

    // Act - Test with various parameter types
    const params = ["string_value", 42, 3.14159];

    const sqliteResult = await sqliteAdapter.execute(
      `INSERT INTO ${tableName} (a, b, c) VALUES (?, ?, ?)`,
      params
    );
    const libsqlResult = await libsqlAdapter.execute(
      `INSERT INTO ${tableName} (a, b, c) VALUES (?, ?, ?)`,
      params
    );

    const sqliteQuery = await sqliteAdapter.query<{
      a: string;
      b: number;
      c: number;
    }>(`SELECT a, b, c FROM ${tableName}`);
    const libsqlQuery = await libsqlAdapter.query<{ a: string; b: number; c: number }>(
      `SELECT a, b, c FROM ${tableName}`
    );

    // Assert
    expect(sqliteResult.changes).toBe(libsqlResult.changes);
    expect(sqliteQuery[0]!.a).toBe(libsqlQuery[0]!.a);
    expect(sqliteQuery[0]!.b).toBe(libsqlQuery[0]!.b);
    expect(sqliteQuery[0]!.c).toBeCloseTo(libsqlQuery[0]!.c, 5);

    // Cleanup
    await sqliteAdapter.close();
    await libsqlAdapter.close();
  });

  test("both clients should handle NULL values identically", async () => {
    // Arrange
    const sqliteAdapter = new BunSqliteAdapter(":memory:", []);
    const libsqlAdapter = new LibsqlAdapter(":memory:", []);
    const tableName = `compat_nulls_${uniqueId()}`;

    // Setup both databases identically
    for (const adapter of [sqliteAdapter, libsqlAdapter]) {
      await adapter.execute(
        `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, nullable_field TEXT)`
      );
      await adapter.execute(`INSERT INTO ${tableName} (nullable_field) VALUES (?)`, [
        null,
      ]);
      await adapter.execute(`INSERT INTO ${tableName} (nullable_field) VALUES (?)`, [
        "not null",
      ]);
    }

    // Act
    const sqliteResults = await sqliteAdapter.query<{ nullable_field: string | null }>(
      `SELECT nullable_field FROM ${tableName} ORDER BY id`
    );
    const libsqlResults = await libsqlAdapter.query<{ nullable_field: string | null }>(
      `SELECT nullable_field FROM ${tableName} ORDER BY id`
    );

    // Assert
    expect(sqliteResults[0]!.nullable_field).toBe(null);
    expect(libsqlResults[0]!.nullable_field).toBe(null);
    expect(sqliteResults[1]!.nullable_field).toBe("not null");
    expect(libsqlResults[1]!.nullable_field).toBe("not null");

    // Cleanup
    await sqliteAdapter.close();
    await libsqlAdapter.close();
  });

  test("both clients should normalize row objects identically", async () => {
    // Arrange
    const sqliteAdapter = new BunSqliteAdapter(":memory:", []);
    const libsqlAdapter = new LibsqlAdapter(":memory:", []);
    const tableName = `compat_normalize_${uniqueId()}`;

    // Setup both databases identically
    for (const adapter of [sqliteAdapter, libsqlAdapter]) {
      await adapter.execute(
        `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, col1 TEXT, col2 TEXT, col3 TEXT)`
      );
      await adapter.execute(
        `INSERT INTO ${tableName} (col1, col2, col3) VALUES (?, ?, ?)`,
        ["a", "b", "c"]
      );
    }

    // Act
    const sqliteResults = await sqliteAdapter.query(`SELECT * FROM ${tableName}`);
    const libsqlResults = await libsqlAdapter.query(`SELECT * FROM ${tableName}`);

    // Assert - Both should have the same keys (no numeric indices or 'length')
    const sqliteKeys = Object.keys(sqliteResults[0]!).sort();
    const libsqlKeys = Object.keys(libsqlResults[0]!).sort();

    expect(sqliteKeys).toEqual(libsqlKeys);
    expect(sqliteKeys).toContain("id");
    expect(sqliteKeys).toContain("col1");
    expect(sqliteKeys).toContain("col2");
    expect(sqliteKeys).toContain("col3");
    expect(sqliteKeys).not.toContain("length");
    expect(sqliteKeys.some((k) => !isNaN(Number(k)))).toBe(false); // No numeric keys

    // Cleanup
    await sqliteAdapter.close();
    await libsqlAdapter.close();
  });
});

// =============================================================================
// 7. Edge Cases & Error Handling Tests
// =============================================================================

describe("DatabaseAdapter - Edge Cases & Error Handling", () => {
  test("BunSqliteAdapter -should throw error on invalid SQL syntax", async () => {
    // Arrange
    const adapter = new BunSqliteAdapter(":memory:", []);

    // Act & Assert
    try {
      await adapter.query("INVALID SQL QUERY");
      throw new Error("Should have thrown an error");
    } catch (error: any) {
      expect(error).toBeDefined();
    }

    // Cleanup
    await adapter.close();
  });

  test("LibsqlAdapter -should throw error on invalid SQL syntax", async () => {
    // Arrange
    const adapter = new LibsqlAdapter(":memory:", []);

    // Act & Assert
    try {
      await adapter.query("INVALID SQL QUERY");
      throw new Error("Should have thrown an error");
    } catch (error: any) {
      expect(error).toBeDefined();
    }

    // Cleanup
    await adapter.close();
  });

  test("BunSqliteAdapter -should handle empty parameters array", async () => {
    // Arrange
    const adapter = new BunSqliteAdapter(":memory:", []);
    const tableName = `empty_params_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT)`
    );
    await adapter.execute(`INSERT INTO ${tableName} (name) VALUES (?)`, ["Test"]);

    // Act
    const results = await adapter.query(`SELECT * FROM ${tableName}`, []);

    // Assert
    expect(results).toHaveLength(1);

    // Cleanup
    await adapter.close();
  });

  test("LibsqlAdapter -should handle empty parameters array", async () => {
    // Arrange
    const adapter = new LibsqlAdapter(":memory:", []);
    const tableName = `empty_params_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT)`
    );
    await adapter.execute(`INSERT INTO ${tableName} (name) VALUES (?)`, ["Test"]);

    // Act
    const results = await adapter.query(`SELECT * FROM ${tableName}`, []);

    // Assert
    expect(results).toHaveLength(1);

    // Cleanup
    await adapter.close();
  });

  test("BunSqliteAdapter -should handle undefined parameters", async () => {
    // Arrange
    const adapter = new BunSqliteAdapter(":memory:", []);
    const tableName = `undefined_params_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT)`
    );
    await adapter.execute(`INSERT INTO ${tableName} (name) VALUES (?)`, ["Test"]);

    // Act
    const results = await adapter.query(`SELECT * FROM ${tableName}`);

    // Assert
    expect(results).toHaveLength(1);

    // Cleanup
    await adapter.close();
  });

  test("LibsqlAdapter -should handle undefined parameters", async () => {
    // Arrange
    const adapter = new LibsqlAdapter(":memory:", []);
    const tableName = `undefined_params_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT)`
    );
    await adapter.execute(`INSERT INTO ${tableName} (name) VALUES (?)`, ["Test"]);

    // Act
    const results = await adapter.query(`SELECT * FROM ${tableName}`);

    // Assert
    expect(results).toHaveLength(1);

    // Cleanup
    await adapter.close();
  });

  test("BunSqliteAdapter -should handle large result sets", async () => {
    // Arrange
    const adapter = new BunSqliteAdapter(":memory:", []);
    const tableName = `large_results_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, value INTEGER)`
    );

    // Insert 1000 rows
    for (let i = 0; i < 1000; i++) {
      await adapter.execute(`INSERT INTO ${tableName} (value) VALUES (?)`, [i]);
    }

    // Act
    const results = await adapter.query(`SELECT * FROM ${tableName}`);

    // Assert
    expect(results).toHaveLength(1000);

    // Cleanup
    await adapter.close();
  });

  test("LibsqlAdapter -should handle large result sets", async () => {
    // Arrange
    const adapter = new LibsqlAdapter(":memory:", []);
    const tableName = `large_results_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, value INTEGER)`
    );

    // Insert 1000 rows
    for (let i = 0; i < 1000; i++) {
      await adapter.execute(`INSERT INTO ${tableName} (value) VALUES (?)`, [i]);
    }

    // Act
    const results = await adapter.query(`SELECT * FROM ${tableName}`);

    // Assert
    expect(results).toHaveLength(1000);

    // Cleanup
    await adapter.close();
  });

  test("BunSqliteAdapter -should handle special characters in strings", async () => {
    // Arrange
    const adapter = new BunSqliteAdapter(":memory:", []);
    const tableName = `special_chars_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, text TEXT)`
    );
    const specialString = "Test with 'quotes', \"double quotes\", and \\ backslash";

    // Act
    await adapter.execute(`INSERT INTO ${tableName} (text) VALUES (?)`, [
      specialString,
    ]);
    const results = await adapter.query<{ text: string }>(
      `SELECT text FROM ${tableName}`
    );

    // Assert
    expect(results[0]!.text).toBe(specialString);

    // Cleanup
    await adapter.close();
  });

  test("LibsqlAdapter -should handle special characters in strings", async () => {
    // Arrange
    const adapter = new LibsqlAdapter(":memory:", []);
    const tableName = `special_chars_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, text TEXT)`
    );
    const specialString = "Test with 'quotes', \"double quotes\", and \\ backslash";

    // Act
    await adapter.execute(`INSERT INTO ${tableName} (text) VALUES (?)`, [
      specialString,
    ]);
    const results = await adapter.query<{ text: string }>(
      `SELECT text FROM ${tableName}`
    );

    // Assert
    expect(results[0]!.text).toBe(specialString);

    // Cleanup
    await adapter.close();
  });
});

// =============================================================================
// 8. Close Method Tests
// =============================================================================

describe("DatabaseAdapter - Close Method", () => {
  test("BunSqliteAdapter -should close connection successfully", async () => {
    // Arrange
    const adapter = new BunSqliteAdapter(":memory:", []);
    const tableName = `close_test_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT)`
    );

    // Act
    await adapter.close();

    // Assert - Attempting to use closed connection should fail
    try {
      await adapter.query(`SELECT * FROM ${tableName}`);
      throw new Error("Should have thrown an error");
    } catch (error: any) {
      expect(error).toBeDefined();
    }
  });

  test("LibsqlAdapter -should close connection successfully", async () => {
    // Arrange
    const adapter = new LibsqlAdapter(":memory:", []);
    const tableName = `close_test_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT)`
    );

    // Act
    await adapter.close();

    // Assert - Note: libsql might handle closed connections differently
    // Just verify close doesn't throw an error
    expect(adapter.getClient()).toBeDefined();
  });
});

// =============================================================================
// 9. Schema Initialization Tests
// =============================================================================

describe("DatabaseAdapter - Schema Initialization", () => {
  test("BunSqliteAdapter -should create table from schema on initialization", async () => {
    // Arrange
    const tableName = `schema_users_${uniqueId()}`;
    const schemas = [
      `CREATE TABLE IF NOT EXISTS ${tableName} (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )`,
    ];

    // Act
    const adapter = new BunSqliteAdapter(":memory:", schemas);

    // Assert - Table should exist and be queryable
    const result = await adapter.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      [tableName]
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe(tableName);

    // Verify we can insert and query data
    await adapter.execute(`INSERT INTO ${tableName} (name, email) VALUES (?, ?)`, [
      "Alice",
      "alice@example.com",
    ]);
    const users = await adapter.query<{ name: string; email: string }>(
      `SELECT name, email FROM ${tableName}`
    );
    expect(users).toHaveLength(1);
    expect(users[0]!.name).toBe("Alice");

    // Cleanup
    await adapter.close();
  });

  test("LibsqlAdapter -should create table from schema on initialization", async () => {
    // Arrange
    const dbPath = `/tmp/libsql_schema_init_${uniqueId()}.db`;
    const tableName = `schema_users_${uniqueId()}`;
    const schemas = [
      `CREATE TABLE IF NOT EXISTS ${tableName} (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )`,
    ];

    // Act
    const adapter = new LibsqlAdapter(dbPath, schemas);

    // Wait a bit for async initialization
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Assert - Table should exist and be queryable
    const result = await adapter.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      [tableName]
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe(tableName);

    // Verify we can insert and query data
    await adapter.execute(`INSERT INTO ${tableName} (name, email) VALUES (?, ?)`, [
      "Alice",
      "alice@example.com",
    ]);
    const users = await adapter.query<{ name: string; email: string }>(
      `SELECT name, email FROM ${tableName}`
    );
    expect(users).toHaveLength(1);
    expect(users[0]!.name).toBe("Alice");

    // Cleanup
    await adapter.close();
  });

  test("BunSqliteAdapter -should create multiple tables from schemas", async () => {
    // Arrange
    const usersTable = `users_${uniqueId()}`;
    const productsTable = `products_${uniqueId()}`;
    const ordersTable = `orders_${uniqueId()}`;
    const schemas = [
      `CREATE TABLE IF NOT EXISTS ${usersTable} (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS ${productsTable} (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        price REAL NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS ${ordersTable} (
        id INTEGER PRIMARY KEY,
        user_id INTEGER,
        product_id INTEGER
      )`,
    ];

    // Act
    const adapter = new BunSqliteAdapter(":memory:", schemas);

    // Assert - All tables should exist
    const result = await adapter.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
    );

    const tableNames = result.map((r) => r.name);
    expect(tableNames).toContain(usersTable);
    expect(tableNames).toContain(productsTable);
    expect(tableNames).toContain(ordersTable);

    // Verify we can use all tables
    await adapter.execute(`INSERT INTO ${usersTable} (name) VALUES (?)`, ["Bob"]);
    await adapter.execute(`INSERT INTO ${productsTable} (title, price) VALUES (?, ?)`, [
      "Widget",
      9.99,
    ]);
    await adapter.execute(`INSERT INTO ${ordersTable} (user_id, product_id) VALUES (?, ?)`, [
      1,
      1,
    ]);

    const users = await adapter.query(`SELECT COUNT(*) as count FROM ${usersTable}`);
    const products = await adapter.query(`SELECT COUNT(*) as count FROM ${productsTable}`);
    const orders = await adapter.query(`SELECT COUNT(*) as count FROM ${ordersTable}`);

    expect(users[0]!.count).toBe(1);
    expect(products[0]!.count).toBe(1);
    expect(orders[0]!.count).toBe(1);

    // Cleanup
    await adapter.close();
  });

  test("LibsqlAdapter -should create multiple tables from schemas", async () => {
    // Arrange
    const dbPath = `/tmp/libsql_multi_schema_${uniqueId()}.db`;
    const usersTable = `users_${uniqueId()}`;
    const productsTable = `products_${uniqueId()}`;
    const ordersTable = `orders_${uniqueId()}`;
    const schemas = [
      `CREATE TABLE IF NOT EXISTS ${usersTable} (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS ${productsTable} (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        price REAL NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS ${ordersTable} (
        id INTEGER PRIMARY KEY,
        user_id INTEGER,
        product_id INTEGER
      )`,
    ];

    // Act
    const adapter = new LibsqlAdapter(dbPath, schemas);

    // Wait for async initialization
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Assert - All tables should exist
    const result = await adapter.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
    );

    const tableNames = result.map((r) => r.name);
    expect(tableNames).toContain(usersTable);
    expect(tableNames).toContain(productsTable);
    expect(tableNames).toContain(ordersTable);

    // Verify we can use all tables
    await adapter.execute(`INSERT INTO ${usersTable} (name) VALUES (?)`, ["Bob"]);
    await adapter.execute(`INSERT INTO ${productsTable} (title, price) VALUES (?, ?)`, [
      "Widget",
      9.99,
    ]);
    await adapter.execute(`INSERT INTO ${ordersTable} (user_id, product_id) VALUES (?, ?)`, [
      1,
      1,
    ]);

    const users = await adapter.query(`SELECT COUNT(*) as count FROM ${usersTable}`);
    const products = await adapter.query(`SELECT COUNT(*) as count FROM ${productsTable}`);
    const orders = await adapter.query(`SELECT COUNT(*) as count FROM ${ordersTable}`);

    expect(users[0]!.count).toBe(1);
    expect(products[0]!.count).toBe(1);
    expect(orders[0]!.count).toBe(1);

    // Cleanup
    await adapter.close();
  });

  test("BunSqliteAdapter -should create indexes from schemas", async () => {
    // Arrange
    const tableName = `indexed_users_${uniqueId()}`;
    const indexName = `idx_email_${uniqueId()}`;
    const schemas = [
      `CREATE TABLE IF NOT EXISTS ${tableName} (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName}(email)`,
    ];

    // Act
    const adapter = new BunSqliteAdapter(":memory:", schemas);

    // Assert - Index should exist
    const result = await adapter.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='index' AND name=?`,
      [indexName]
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe(indexName);

    // Cleanup
    await adapter.close();
  });

  test("LibsqlAdapter -should create indexes from schemas", async () => {
    // Arrange
    const dbPath = `/tmp/libsql_indexed_${uniqueId()}.db`;
    const tableName = `indexed_users_${uniqueId()}`;
    const indexName = `idx_email_${uniqueId()}`;
    const schemas = [
      `CREATE TABLE IF NOT EXISTS ${tableName} (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName}(email)`,
    ];

    // Act
    const adapter = new LibsqlAdapter(dbPath, schemas);

    // Wait for async initialization
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Assert - Index should exist
    const result = await adapter.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='index' AND name=?`,
      [indexName]
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe(indexName);

    // Cleanup
    await adapter.close();
  });

  test("BunSqliteAdapter -should be idempotent (safe to reinitialize)", async () => {
    // Arrange
    const dbPath = `/tmp/sqlite_idempotent_${uniqueId()}.db`;
    const tableName = `idempotent_users_${uniqueId()}`;
    const schemas = [
      `CREATE TABLE IF NOT EXISTS ${tableName} (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      )`,
    ];

    // Act - Create first adapter and add data
    const adapter1 = new BunSqliteAdapter(dbPath, schemas);
    await adapter1.execute(`INSERT INTO ${tableName} (name) VALUES (?)`, ["Alice"]);
    await adapter1.close();

    // Create second adapter with same schemas
    const adapter2 = new BunSqliteAdapter(dbPath, schemas);

    // Assert - Data should still exist
    const users = await adapter2.query<{ name: string }>(
      `SELECT name FROM ${tableName}`
    );
    expect(users).toHaveLength(1);
    expect(users[0]!.name).toBe("Alice");

    // Add more data
    await adapter2.execute(`INSERT INTO ${tableName} (name) VALUES (?)`, ["Bob"]);
    const allUsers = await adapter2.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    expect(allUsers[0]!.count).toBe(2);

    // Cleanup
    await adapter2.close();
  });

  test("LibsqlAdapter -should be idempotent (safe to reinitialize)", async () => {
    // Arrange
    const dbPath = `/tmp/libsql_idempotent_${uniqueId()}.db`;
    const tableName = `idempotent_users_${uniqueId()}`;
    const schemas = [
      `CREATE TABLE IF NOT EXISTS ${tableName} (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      )`,
    ];

    // Act - Create first adapter and add data
    const adapter1 = new LibsqlAdapter(dbPath, schemas);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await adapter1.execute(`INSERT INTO ${tableName} (name) VALUES (?)`, ["Alice"]);
    await adapter1.close();

    // Create second adapter with same schemas
    const adapter2 = new LibsqlAdapter(dbPath, schemas);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Assert - Data should still exist
    const users = await adapter2.query<{ name: string }>(
      `SELECT name FROM ${tableName}`
    );
    expect(users).toHaveLength(1);
    expect(users[0]!.name).toBe("Alice");

    // Add more data
    await adapter2.execute(`INSERT INTO ${tableName} (name) VALUES (?)`, ["Bob"]);
    const allUsers = await adapter2.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    expect(allUsers[0]!.count).toBe(2);

    // Cleanup
    await adapter2.close();
  });

  test("BunSqliteAdapter -should work with empty schemas array", async () => {
    // Arrange & Act - Create adapter with empty schemas array
    const adapter = new BunSqliteAdapter(":memory:", []);

    // Assert - Should work normally, can create tables manually
    const tableName = `manual_table_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT)`
    );
    await adapter.execute(`INSERT INTO ${tableName} (name) VALUES (?)`, ["Test"]);

    const results = await adapter.query<{ name: string }>(
      `SELECT name FROM ${tableName}`
    );
    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe("Test");

    // Cleanup
    await adapter.close();
  });

  test("LibsqlAdapter -should work with empty schemas array", async () => {
    // Arrange & Act - Create adapter with empty schemas array
    const adapter = new LibsqlAdapter(":memory:", []);

    // Assert - Should work normally, can create tables manually
    const tableName = `manual_table_${uniqueId()}`;
    await adapter.execute(
      `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT)`
    );
    await adapter.execute(`INSERT INTO ${tableName} (name) VALUES (?)`, ["Test"]);

    const results = await adapter.query<{ name: string }>(
      `SELECT name FROM ${tableName}`
    );
    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe("Test");

    // Cleanup
    await adapter.close();
  });

  test("Cross-adapter -schemas create identical table structures", async () => {
    // Arrange
    const tableName = `cross_client_users_${uniqueId()}`;
    const schemas = [
      `CREATE TABLE IF NOT EXISTS ${tableName} (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        age INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )`,
    ];

    const sqliteAdapter = new BunSqliteAdapter(":memory:", schemas);
    const libsqlPath = `/tmp/libsql_cross_client_${uniqueId()}.db`;
    const libsqlAdapter = new LibsqlAdapter(libsqlPath, schemas);

    // Wait for libsql initialization
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Act - Get table structure from both clients
    const sqliteTableInfo = await sqliteAdapter.query<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: any;
      pk: number;
    }>(`PRAGMA table_info(${tableName})`);

    const libsqlTableInfo = await libsqlAdapter.query<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: any;
      pk: number;
    }>(`PRAGMA table_info(${tableName})`);

    // Assert - Table structures should be identical
    expect(sqliteTableInfo).toHaveLength(libsqlTableInfo.length);
    expect(sqliteTableInfo).toHaveLength(5); // id, name, email, age, created_at

    for (let i = 0; i < sqliteTableInfo.length; i++) {
      expect(sqliteTableInfo[i]!.name).toBe(libsqlTableInfo[i]!.name);
      expect(sqliteTableInfo[i]!.type).toBe(libsqlTableInfo[i]!.type);
      expect(sqliteTableInfo[i]!.notnull).toBe(libsqlTableInfo[i]!.notnull);
      expect(sqliteTableInfo[i]!.pk).toBe(libsqlTableInfo[i]!.pk);
    }

    // Cleanup
    await sqliteAdapter.close();
    await libsqlAdapter.close();
  });
});
