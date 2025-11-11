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
    aggregate_id TEXT PRIMARY KEY,
    correlation_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    payload TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS outbox (
    id TEXT PRIMARY KEY,
    aggregate_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_attempt_at INTEGER,
    next_retry_at INTEGER,
    idempotency_key TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS outbox_processing (
    id TEXT PRIMARY KEY,
    outbox_id TEXT NOT NULL,
    handler_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending',
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_attempt_at INTEGER,
    next_retry_at INTEGER,
    processed_at INTEGER,
    FOREIGN KEY (outbox_id) REFERENCES outbox(id)
  )`,
  `CREATE TABLE IF NOT EXISTS outbox_dlq (
    id TEXT PRIMARY KEY,
    outbox_id TEXT NOT NULL,
    handler_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    error_message TEXT,
    final_retry_count INTEGER NOT NULL,
    failed_at INTEGER NOT NULL,
    original_occurred_at INTEGER,
    FOREIGN KEY (outbox_id) REFERENCES outbox(id)
  )`,
  `CREATE TABLE IF NOT EXISTS projections (
    id TEXT PRIMARY KEY,
    projection_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    correlation_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_projections_type ON projections(projection_type)`
]