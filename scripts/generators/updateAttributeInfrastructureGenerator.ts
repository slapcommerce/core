import type { AttributeUpdateConfig, AttributeOperation } from "../utils/attributePrompts";
import { toSnakeCase, typeToSQLiteType } from "../utils/attributeTemplates";

export async function updateInfrastructureLayer(config: AttributeUpdateConfig): Promise<void> {
  console.log("\n🔌 Updating infrastructure layer...");

  await updateSchemasFile(config);
}

async function updateSchemasFile(config: AttributeUpdateConfig): Promise<void> {
  const schemasPath = `/Users/ryanwible/projects/core/src/infrastructure/schemas.ts`;
  const file = Bun.file(schemasPath);
  let content = await file.text();

  // Find the view table schema (e.g., product_list_view)
  const viewTableName = `${config.aggregateCamelName}_list_view`;
  const tableSchemaRegex = new RegExp(
    `CREATE TABLE IF NOT EXISTS ${viewTableName} \\([\\s\\S]*?\\);`,
    "m"
  );

  const tableMatch = content.match(tableSchemaRegex);
  if (!tableMatch) {
    console.log(`  ⚠️  Table schema for ${viewTableName} not found, skipping`);
    return;
  }

  let tableSchema = tableMatch[0];

  // Process each operation
  for (const op of config.operations) {
    if (op.type === "add") {
      tableSchema = addColumnToSchema(tableSchema, op);
    } else if (op.type === "rename") {
      tableSchema = renameColumnInSchema(tableSchema, op);
    } else if (op.type === "changeType") {
      tableSchema = changeColumnTypeInSchema(tableSchema, op);
    } else if (op.type === "delete") {
      tableSchema = deleteColumnFromSchema(tableSchema, op);
    }
  }

  // Replace the table schema in content
  content = content.replace(tableMatch[0], tableSchema);

  await Bun.write(schemasPath, content);
  console.log(`  ✅ Updated ${viewTableName} schema`);
}

function addColumnToSchema(
  tableSchema: string,
  op: Extract<AttributeOperation, { type: "add" }>
): string {
  const columnName = toSnakeCase(op.name);
  const sqlType = typeToSQLiteType(op.fieldType);
  const nullable = op.optional ? "" : " NOT NULL";

  const columnLine = `    ${columnName} ${sqlType}${nullable},`;

  // Add before the closing );
  const closingIndex = tableSchema.lastIndexOf(");");
  return (
    tableSchema.substring(0, closingIndex) +
    `${columnLine}\n  ` +
    tableSchema.substring(closingIndex)
  );
}

function renameColumnInSchema(
  tableSchema: string,
  op: Extract<AttributeOperation, { type: "rename" }>
): string {
  const oldColumnName = toSnakeCase(op.oldName);
  const newColumnName = toSnakeCase(op.newName);

  // Replace the column name
  const columnRegex = new RegExp(
    `(\\s+)${oldColumnName}(\\s+\\w+)`,
    "g"
  );

  return tableSchema.replace(columnRegex, `$1${newColumnName}$2`);
}

function changeColumnTypeInSchema(
  tableSchema: string,
  op: Extract<AttributeOperation, { type: "changeType" }>
): string {
  const columnName = toSnakeCase(op.name);
  const newSqlType = typeToSQLiteType(op.newType);

  // Find and update the column type
  const columnRegex = new RegExp(
    `(\\s+${columnName}\\s+)\\w+`,
    "g"
  );

  return tableSchema.replace(columnRegex, `$1${newSqlType}`);
}

function deleteColumnFromSchema(
  tableSchema: string,
  op: Extract<AttributeOperation, { type: "delete" }>
): string {
  const columnName = toSnakeCase(op.name);

  // Remove the column line
  const columnRegex = new RegExp(
    `\\s+${columnName}\\s+\\w+[^,\\n]*,?\\n?`,
    "g"
  );

  return tableSchema.replace(columnRegex, "");
}
