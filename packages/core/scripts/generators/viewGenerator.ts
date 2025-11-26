import type { AggregateConfig } from "../utils/prompts";
import { writeFile } from "../utils/fileWriter";
import { toCamelCase } from "../utils/templates";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CORE_ROOT = join(__dirname, "../..");
const SRC_ROOT = join(CORE_ROOT, "src", "api");

export async function generateViewLayer(config: AggregateConfig): Promise<void> {
  const { name } = config;

  console.log("\n📦 Generating view layer...");

  // Generate queries file
  await generateQueriesFile(config);

  // Generate view file
  await generateViewFile(config);
}

async function generateQueriesFile(config: AggregateConfig): Promise<void> {
  const { name, includeStatus } = config;
  const camelName = toCamelCase(name);

  const statusField = includeStatus
    ? `    status: z.enum(["draft", "active", "archived"]).optional(),`
    : "";

  const content = `import { z } from "zod";

export const Get${name}Query = z.object({
    ${camelName}Id: z.string().optional(),
${statusField}
    limit: z.number().int().positive().optional(),
    offset: z.number().int().nonnegative().optional(),
});

export type Get${name}Query = z.infer<typeof Get${name}Query>;
`;

  const filePath = join(SRC_ROOT, "views", camelName, "queries.ts");
  await writeFile(filePath, content);
}

async function generateViewFile(config: AggregateConfig): Promise<void> {
  const { name, fields, includeStatus } = config;
  const camelName = toCamelCase(name);
  const tableName = `${camelName}ReadModel`;

  // Generate query conditions
  const queryConditions: string[] = [];
  queryConditions.push(`  if (params?.${camelName}Id) {
    query += \` AND aggregateId = ?\`
    queryParams.push(params.${camelName}Id)
  }`);

  if (includeStatus) {
    queryConditions.push(`
  if (params?.status) {
    query += \` AND status = ?\`
    queryParams.push(params.status)
  }`);
  }

  // Generate row type fields
  const rowTypeFields = [
    "    aggregateId: string",
    "    correlationId: string",
    "    version: number",
    "    createdAt: string",
    "    updatedAt: string",
  ];

  if (includeStatus) {
    rowTypeFields.push('    status: "draft" | "active" | "archived"');
  }

  fields.forEach((f) => {
    let type = f.type;
    if (type === "Date") {
      type = "string | null";
    } else if (type === "string[]" || type === "number[]" || type.startsWith("Record<")) {
      type = "string | null";
    } else if (f.optional) {
      type = `${type} | null`;
    }
    rowTypeFields.push(`    ${f.name}: ${type}`);
  });

  // Generate return mapping
  const returnMapping = [
    "    aggregateId: row.aggregateId,",
    "    correlationId: row.correlationId,",
    "    version: row.version,",
    "    createdAt: row.createdAt,",
    "    updatedAt: row.updatedAt,",
  ];

  if (includeStatus) {
    returnMapping.push("    status: row.status,");
  }

  fields.forEach((f) => {
    if (f.type === "string[]" || f.type === "number[]") {
      returnMapping.push(`    ${f.name}: safeJsonParse(row.${f.name}, []),`);
    } else if (f.type.startsWith("Record<")) {
      returnMapping.push(`    ${f.name}: safeJsonParse(row.${f.name}, {}),`);
    } else {
      returnMapping.push(`    ${f.name}: row.${f.name},`);
    }
  });

  const content = `import type { Database } from "bun:sqlite"
import { safeJsonParse } from "../../lib/utils"
import { Get${name}Query } from "./queries"

export function get${name}View(db: Database, params?: Get${name}Query) {
  let query = \`SELECT * FROM ${tableName} WHERE 1=1\`
  const queryParams: (string | number)[] = []

${queryConditions.join("\n")}

  if (params?.limit) {
    query += \` LIMIT ?\`
    queryParams.push(params.limit)
  }
  if (params?.offset) {
    if (!params?.limit) {
      query += \` LIMIT -1\`
    }
    query += \` OFFSET ?\`
    queryParams.push(params.offset)
  }

  const rows = db.query(query).all(...queryParams) as Array<{
${rowTypeFields.join("\n")}
  }>

  return rows.map(row => ({
${returnMapping.join("\n")}
  }))
}
`;

  const filePath = join(SRC_ROOT, "views", camelName, `${camelName}View.ts`);
  await writeFile(filePath, content);
}
