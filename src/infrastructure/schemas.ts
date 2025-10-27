export const schemas = [
  `CREATE TABLE IF NOT EXISTS events (
    event_type TEXT NOT NULL,
    version INTEGER NOT NULL,
    aggregate_id TEXT NOT NULL,
    correlation_id TEXT NOT NULL,
    occurred_at INTEGER NOT NULL,
    payload TEXT NOT NULL,
    PRIMARY KEY (aggregate_id, version)
  )`,
  `CREATE TABLE IF NOT EXISTS snapshots (
    aggregate_id PRIMARY KEY,
    correlation_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    payload TEXT NOT NULL
  )`
]