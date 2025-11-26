import { Database } from 'bun:sqlite'
import { schemas } from '../../src/api/infrastructure/schemas'

/**
 * Creates a new in-memory SQLite database with all schemas applied.
 * Each test should create its own database using this helper.
 * 
 * @returns A configured Database instance ready to use
 */
export function createTestDatabase(): Database {
  const db = new Database(':memory:')
  for (const schema of schemas) {
    db.run(schema)
  }
  return db
}

/**
 * Closes a test database. Should be called at the end of each test
 * to ensure proper cleanup.
 * 
 * @param db The database to close
 */
export function closeTestDatabase(db: Database): void {
  db.close()
}

