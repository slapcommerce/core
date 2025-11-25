import type { Database } from "bun:sqlite";

export const schemas = [
  `CREATE TABLE IF NOT EXISTS events (
    event_type TEXT NOT NULL,
    version INTEGER NOT NULL,
    aggregate_id TEXT NOT NULL,
    correlation_id TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    user_id TEXT NOT NULL,
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
  `CREATE TABLE IF NOT EXISTS product_list_read_model (
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
    taxable INTEGER NOT NULL DEFAULT 1,
    page_layout_id TEXT,
    fulfillment_type TEXT NOT NULL DEFAULT 'digital' CHECK(fulfillment_type IN ('digital', 'dropship')),
    dropship_safety_buffer INTEGER,
    variant_options TEXT NOT NULL DEFAULT '[]',
    version INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    collection_ids TEXT NOT NULL,
    meta_title TEXT NOT NULL DEFAULT '',
    meta_description TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS idx_product_list_read_model_status ON product_list_read_model(status)`,
  `CREATE TABLE IF NOT EXISTS collections_list_read_model (
    aggregate_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    correlation_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    meta_title TEXT NOT NULL DEFAULT '',
    meta_description TEXT NOT NULL DEFAULT '',
    published_at TEXT,
    images TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_collections_list_read_model_status ON collections_list_read_model(status)`,
  `CREATE TABLE IF NOT EXISTS product_collections (
    aggregate_id TEXT NOT NULL,
    collection_id TEXT NOT NULL,
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
    updated_at TEXT NOT NULL,
    meta_title TEXT NOT NULL DEFAULT '',
    meta_description TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (aggregate_id, collection_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_product_collections_collection_id ON product_collections(collection_id)`,
  `CREATE TABLE IF NOT EXISTS slug_redirects (
    old_slug TEXT PRIMARY KEY,
    new_slug TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    product_id TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_slug_redirects_new_slug ON slug_redirects(new_slug)`,
  `CREATE INDEX IF NOT EXISTS idx_slug_redirects_entity ON slug_redirects(entity_id, entity_type)`,
  `CREATE TABLE IF NOT EXISTS product_variants (
    aggregate_id TEXT NOT NULL,
    variant_id TEXT NOT NULL,
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
    updated_at TEXT NOT NULL,
    meta_title TEXT NOT NULL DEFAULT '',
    meta_description TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (aggregate_id, variant_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_product_variants_variant_id ON product_variants(variant_id)`,
  `CREATE TABLE IF NOT EXISTS variant_details_read_model (
    aggregate_id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    sku TEXT NOT NULL,
    price REAL NOT NULL,
    inventory INTEGER NOT NULL,
    options TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    correlation_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    images TEXT,
    digital_asset TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_variant_details_read_model_product_id ON variant_details_read_model(product_id)`,
  `CREATE INDEX IF NOT EXISTS idx_variant_details_read_model_status ON variant_details_read_model(status)`,
  `CREATE INDEX IF NOT EXISTS idx_variant_details_read_model_sku ON variant_details_read_model(sku)`,
  // Better Auth tables
  `CREATE TABLE IF NOT EXISTS user (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    emailVerified INTEGER NOT NULL,
    image TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS session (
    id TEXT NOT NULL PRIMARY KEY,
    expiresAt TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS account (
    id TEXT NOT NULL PRIMARY KEY,
    accountId TEXT NOT NULL,
    providerId TEXT NOT NULL,
    userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    accessToken TEXT,
    refreshToken TEXT,
    idToken TEXT,
    accessTokenExpiresAt TEXT,
    refreshTokenExpiresAt TEXT,
    scope TEXT,
    password TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS verification (
    id TEXT NOT NULL PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS schedules_read_model (
    aggregate_id TEXT PRIMARY KEY,
    target_aggregate_id TEXT NOT NULL,
    target_aggregate_type TEXT NOT NULL,
    command_type TEXT NOT NULL,
    command_data TEXT,
    scheduled_for TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    retry_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at TEXT,
    created_by TEXT NOT NULL,
    error_message TEXT,
    correlation_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_schedules_read_model_status ON schedules_read_model(status)`,
  `CREATE INDEX IF NOT EXISTS idx_schedules_read_model_scheduled_for ON schedules_read_model(scheduled_for)`,
  `CREATE INDEX IF NOT EXISTS idx_schedules_read_model_status_scheduled_for ON schedules_read_model(status, scheduled_for)`,
  `CREATE INDEX IF NOT EXISTS idx_schedules_read_model_target_aggregate ON schedules_read_model(target_aggregate_id)`,
];

/**
 * Run database migrations to add missing columns to existing tables
 * This is safe to run multiple times - it checks if columns exist before adding them
 */
export function runMigrations(db: Database): void {
  // Migration: Add digital_asset column to variant_details_view if it doesn't exist
  try {
    const tableInfo = db.query("PRAGMA table_info(variant_details_read_model)").all() as Array<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>;

    const hasDigitalAssetColumn = tableInfo.some(col => col.name === "digital_asset");

    if (!hasDigitalAssetColumn) {
      console.log("⚙️  Running migration: Adding digital_asset column to variant_details_read_model");
      db.run("ALTER TABLE variant_details_read_model ADD COLUMN digital_asset TEXT");
      console.log("✅ Migration complete: digital_asset column added");
    }
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}
