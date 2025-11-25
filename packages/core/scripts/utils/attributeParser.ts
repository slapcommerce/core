import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { Glob } from "bun";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CORE_ROOT = join(__dirname, "../..");
const DOMAIN_DIR = join(CORE_ROOT, "src", "api", "domain");

export interface ParsedAttribute {
  name: string;
  type: string;
  optional: boolean;
}

// Reserved fields that should not be modified
export const RESERVED_FIELDS = [
  "id",
  "version",
  "events",
  "uncommittedEvents",
  "correlationId",
  "createdAt",
  "updatedAt",
  "status",
  "publishedAt",
];

/**
 * Discover all aggregates by scanning the domain directory
 */
export async function discoverAggregates(): Promise<string[]> {
  const glob = new Glob("*/events.ts");
  const aggregates: string[] = [];

  for await (const file of glob.scan({ cwd: DOMAIN_DIR })) {
    const aggregateName = file.split("/")[0];
    if (aggregateName && aggregateName !== "_base") {
      // Convert to PascalCase (e.g., "product" -> "Product")
      const pascalName = aggregateName.charAt(0).toUpperCase() + aggregateName.slice(1);
      aggregates.push(pascalName);
    }
  }

  return aggregates.sort();
}

/**
 * Get the path to the events.ts file for an aggregate
 */
export function getEventsPath(aggregateName: string): string {
  const camelName = aggregateName.charAt(0).toLowerCase() + aggregateName.slice(1);
  return join(DOMAIN_DIR, camelName, "events.ts");
}

/**
 * Get the path to the aggregate.ts file for an aggregate
 */
export function getAggregatePath(aggregateName: string): string {
  const camelName = aggregateName.charAt(0).toLowerCase() + aggregateName.slice(1);
  return join(DOMAIN_DIR, camelName, "aggregate.ts");
}

/**
 * Parse the State type from events.ts to discover attributes
 */
export async function parseStateType(aggregateName: string): Promise<ParsedAttribute[]> {
  const eventsPath = getEventsPath(aggregateName);
  const file = Bun.file(eventsPath);

  if (!await file.exists()) {
    throw new Error(`Events file not found: ${eventsPath}`);
  }

  const content = await file.text();
  const stateTypeName = `${aggregateName}State`;

  // Find the State type definition
  // Match: export type ProductState = { ... }
  const stateTypeRegex = new RegExp(
    `export\\s+type\\s+${stateTypeName}\\s*=\\s*\\{([^}]+(?:\\{[^}]*\\}[^}]*)*)\\}`,
    "s"
  );

  const match = content.match(stateTypeRegex);
  if (!match || !match[1]) {
    throw new Error(`Could not find ${stateTypeName} type in ${eventsPath}`);
  }

  const typeBody = match[1];
  return parseTypeBody(typeBody);
}

/**
 * Parse the body of a type definition to extract fields
 */
function parseTypeBody(typeBody: string): ParsedAttribute[] {
  const attributes: ParsedAttribute[] = [];

  // Split by lines and process each field
  const lines = typeBody.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines, comments, and index signatures
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*")) {
      continue;
    }

    // Skip index signature: [key: string]: any
    if (trimmed.startsWith("[")) {
      continue;
    }

    // Parse field: name?: type; or name: type;
    const fieldMatch = trimmed.match(/^(\w+)(\?)?:\s*(.+?);?\s*$/);

    if (fieldMatch) {
      const [, name, optionalMarker, type] = fieldMatch;

      if (name && type) {
        // Skip reserved fields
        if (RESERVED_FIELDS.includes(name)) {
          continue;
        }

        attributes.push({
          name,
          type: type.trim().replace(/;$/, ""),
          optional: optionalMarker === "?",
        });
      }
    }
  }

  return attributes;
}

/**
 * Check if an attribute name already exists
 */
export async function attributeExists(aggregateName: string, attributeName: string): Promise<boolean> {
  const attributes = await parseStateType(aggregateName);
  return attributes.some(attr => attr.name === attributeName);
}

/**
 * Get all file paths that may need modification for an aggregate
 */
export function getAggregateFilePaths(aggregateName: string): {
  events: string;
  aggregate: string;
  commands: string;
  schemas: string;
  repository?: string;
  projection?: string;
  queries?: string;
} {
  const camelName = aggregateName.charAt(0).toLowerCase() + aggregateName.slice(1);
  const srcApi = join(CORE_ROOT, "src", "api");

  return {
    events: join(srcApi, "domain", camelName, "events.ts"),
    aggregate: join(srcApi, "domain", camelName, "aggregate.ts"),
    commands: join(srcApi, "app", camelName, "commands.ts"),
    schemas: join(srcApi, "infrastructure", "schemas.ts"),
    repository: join(srcApi, "infrastructure", "repositories", `${camelName}ListViewRepository.ts`),
    projection: join(srcApi, "projections", camelName, `${camelName}ListViewProjection.ts`),
    queries: join(srcApi, "views", camelName, "queries.ts"),
  };
}

// TypeScript to Zod type mapping
export const TS_TO_ZOD: Record<string, string> = {
  "string": "z.string()",
  "number": "z.number()",
  "boolean": "z.boolean()",
  "Date": "z.date()",
  "string[]": "z.array(z.string())",
  "number[]": "z.array(z.number())",
  "boolean[]": "z.array(z.boolean())",
};

// TypeScript to SQLite type mapping
export const TS_TO_SQLITE: Record<string, string> = {
  "string": "TEXT",
  "number": "REAL",
  "boolean": "INTEGER",
  "Date": "TEXT",
  "string[]": "TEXT",
  "number[]": "TEXT",
  "boolean[]": "TEXT",
};

/**
 * Convert TypeScript type to Zod schema
 */
export function tsToZod(tsType: string, optional: boolean): string {
  const baseZod = TS_TO_ZOD[tsType] || "z.unknown()";
  return optional ? `${baseZod}.optional()` : baseZod;
}

/**
 * Convert TypeScript type to SQLite column type
 */
export function tsToSqlite(tsType: string): string {
  return TS_TO_SQLITE[tsType] || "TEXT";
}

/**
 * Get default value for a TypeScript type
 */
export function getDefaultValue(tsType: string, optional: boolean): string {
  if (optional) return "undefined";

  const defaults: Record<string, string> = {
    "string": '""',
    "number": "0",
    "boolean": "false",
    "Date": "new Date()",
    "string[]": "[]",
    "number[]": "[]",
    "boolean[]": "[]",
  };

  return defaults[tsType] || "undefined";
}
