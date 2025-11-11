export const schemas = [
  `CREATE TABLE IF NOT EXISTS events (
    event_type TEXT NOT NULL,
    version INTEGER NOT NULL,
    aggregate_id TEXT NOT NULL,
    correlation_id TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
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
    last_attempt_at TEXT,
    next_retry_at TEXT,
    idempotency_key TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS outbox_processing (
    id TEXT PRIMARY KEY,
    outbox_id TEXT NOT NULL,
    handler_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending',
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_attempt_at TEXT,
    next_retry_at TEXT,
    processed_at TEXT,
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
    failed_at TEXT NOT NULL,
    original_occurred_at TEXT,
    FOREIGN KEY (outbox_id) REFERENCES outbox(id)
  )`,
  `CREATE TABLE IF NOT EXISTS product_list_view (
    aggregate_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    vendor TEXT NOT NULL,
    product_type TEXT NOT NULL,
    short_description TEXT NOT NULL,
    tags TEXT NOT NULL,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    correlation_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_product_list_view_status ON product_list_view(status)`
]