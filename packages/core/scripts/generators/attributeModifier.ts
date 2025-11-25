import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import type {
  AddAttributeConfig,
  ModifyAttributeConfig,
  DeleteAttributeConfig,
} from "../utils/attributePrompts";
import {
  getAggregateFilePaths,
  tsToZod,
  tsToSqlite,
  getDefaultValue,
} from "../utils/attributeParser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Add a new attribute to an aggregate
 */
export async function addAttribute(config: AddAttributeConfig): Promise<void> {
  const { aggregateName, attribute, addToCreateCommand } = config;
  const { name, type, optional } = attribute;
  const paths = getAggregateFilePaths(aggregateName);

  console.log("\n🏗️  Adding attribute across the stack...\n");

  // 1. Add to State type in events.ts
  await addToStateType(paths.events, aggregateName, name, type, optional);

  // 2. Add to aggregate.ts (params, fields, constructor, etc.)
  await addToAggregate(paths.aggregate, aggregateName, name, type, optional);

  // 3. Add to CreateCommand in commands.ts (if requested)
  if (addToCreateCommand) {
    await addToCreateCommand_fn(paths.commands, aggregateName, name, type, optional);
  }

  // 4. Add to schema.ts
  await addToSchema(paths.schemas, aggregateName, name, type);

  // 5. Try to add to repository (may not exist)
  if (paths.repository && await Bun.file(paths.repository).exists()) {
    await addToRepository(paths.repository, aggregateName, name, type, optional);
  }

  console.log("\n✅ Attribute added successfully!");
}

/**
 * Modify an existing attribute
 */
export async function modifyAttribute(config: ModifyAttributeConfig): Promise<void> {
  const { aggregateName, originalAttribute, newName, newType, newOptional } = config;
  const paths = getAggregateFilePaths(aggregateName);

  console.log("\n🏗️  Modifying attribute across the stack...\n");

  const finalName = newName || originalAttribute.name;
  const finalType = newType || originalAttribute.type;
  const finalOptional = newOptional !== null ? newOptional : originalAttribute.optional;

  // Modify in events.ts
  await modifyInFile(paths.events, originalAttribute.name, finalName, originalAttribute.type, finalType, originalAttribute.optional, finalOptional);
  console.log(`  ✅ Modified in events.ts`);

  // Modify in aggregate.ts
  await modifyInFile(paths.aggregate, originalAttribute.name, finalName, originalAttribute.type, finalType, originalAttribute.optional, finalOptional);
  console.log(`  ✅ Modified in aggregate.ts`);

  // Modify in commands.ts
  if (await Bun.file(paths.commands).exists()) {
    await modifyInCommands(paths.commands, originalAttribute.name, finalName, originalAttribute.type, finalType, finalOptional);
    console.log(`  ✅ Modified in commands.ts`);
  }

  // Modify in schema.ts
  await modifyInSchema(paths.schemas, aggregateName, originalAttribute.name, finalName, finalType);
  console.log(`  ✅ Modified in schemas.ts`);

  // Modify in repository if exists
  if (paths.repository && await Bun.file(paths.repository).exists()) {
    await modifyInFile(paths.repository, originalAttribute.name, finalName, originalAttribute.type, finalType, originalAttribute.optional, finalOptional);
    console.log(`  ✅ Modified in repository`);
  }

  // Modify in projection if exists
  if (paths.projection && await Bun.file(paths.projection).exists()) {
    await modifyInFile(paths.projection, originalAttribute.name, finalName, originalAttribute.type, finalType, originalAttribute.optional, finalOptional);
    console.log(`  ✅ Modified in projection`);
  }

  console.log("\n✅ Attribute modified successfully!");
}

/**
 * Delete an attribute from an aggregate
 */
export async function deleteAttribute(config: DeleteAttributeConfig): Promise<void> {
  const { aggregateName, attribute } = config;
  const paths = getAggregateFilePaths(aggregateName);

  console.log("\n🏗️  Deleting attribute across the stack...\n");

  // Delete from events.ts
  await deleteFromFile(paths.events, attribute.name);
  console.log(`  ✅ Removed from events.ts`);

  // Delete from aggregate.ts
  await deleteFromAggregate(paths.aggregate, attribute.name);
  console.log(`  ✅ Removed from aggregate.ts`);

  // Delete from commands.ts
  if (await Bun.file(paths.commands).exists()) {
    await deleteFromCommands(paths.commands, attribute.name);
    console.log(`  ✅ Removed from commands.ts`);
  }

  // Delete from schema.ts
  await deleteFromSchema(paths.schemas, aggregateName, attribute.name);
  console.log(`  ✅ Removed from schemas.ts`);

  // Delete from repository if exists
  if (paths.repository && await Bun.file(paths.repository).exists()) {
    await deleteFromFile(paths.repository, attribute.name);
    console.log(`  ✅ Removed from repository`);
  }

  console.log("\n✅ Attribute deleted successfully!");
}

// ==================== ADD HELPERS ====================

async function addToStateType(
  filePath: string,
  aggregateName: string,
  name: string,
  type: string,
  optional: boolean
): Promise<void> {
  const file = Bun.file(filePath);
  let content = await file.text();

  const stateTypeName = `${aggregateName}State`;
  const optionalMark = optional ? "?" : "";
  const newField = `  ${name}${optionalMark}: ${type};`;

  // Find the State type and add the field before the closing brace or index signature
  // Look for the pattern: export type ProductState = { ... }
  const stateRegex = new RegExp(
    `(export\\s+type\\s+${stateTypeName}\\s*=\\s*\\{[^}]*)(\\[key:\\s*string\\]:[^;]*;\\s*)?\\}`,
    "s"
  );

  const match = content.match(stateRegex);
  if (match) {
    const beforeIndexSig = match[1];
    const indexSig = match[2] || "";

    // Add new field before index signature (or at end)
    const newStateType = `${beforeIndexSig}${newField}\n  ${indexSig}}`;
    content = content.replace(stateRegex, newStateType);

    await Bun.write(filePath, content);
    console.log(`  ✅ Added ${name} to ${stateTypeName}`);
  } else {
    console.log(`  ⚠️  Could not find ${stateTypeName} in events.ts`);
  }
}

async function addToAggregate(
  filePath: string,
  aggregateName: string,
  name: string,
  type: string,
  optional: boolean
): Promise<void> {
  const file = Bun.file(filePath);
  let content = await file.text();

  const optionalMark = optional ? "?" : "";

  // 1. Add to AggregateParams type
  const paramsTypeName = `${aggregateName}AggregateParams`;
  const paramsRegex = new RegExp(
    `(type\\s+${paramsTypeName}\\s*=\\s*\\{[^}]*)\\};`,
    "s"
  );
  const paramsMatch = content.match(paramsRegex);
  if (paramsMatch) {
    content = content.replace(
      paramsRegex,
      `$1  ${name}${optionalMark}: ${type};\n};`
    );
    console.log(`  ✅ Added to ${paramsTypeName}`);
  }

  // 2. Add to CreateAggregateParams type
  const createParamsTypeName = `Create${aggregateName}AggregateParams`;
  const createParamsRegex = new RegExp(
    `(type\\s+${createParamsTypeName}\\s*=\\s*\\{[^}]*)\\};`,
    "s"
  );
  const createParamsMatch = content.match(createParamsRegex);
  if (createParamsMatch) {
    content = content.replace(
      createParamsRegex,
      `$1  ${name}${optionalMark}: ${type};\n};`
    );
    console.log(`  ✅ Added to ${createParamsTypeName}`);
  }

  // 3. Add private field to class
  const classRegex = new RegExp(
    `(export\\s+class\\s+${aggregateName}Aggregate\\s*\\{[^}]*)(\\s+constructor)`,
    "s"
  );
  const classMatch = content.match(classRegex);
  if (classMatch) {
    const visibility = optional ? "private" : "private";
    const fieldDecl = `  ${visibility} ${name}${optionalMark}: ${type};\n`;
    content = content.replace(classRegex, `$1${fieldDecl}$2`);
    console.log(`  ✅ Added private field`);
  }

  // 4. Add to constructor destructuring
  const constructorDestructRegex = /constructor\(\{([^}]+)\}:/;
  const destructMatch = content.match(constructorDestructRegex);
  if (destructMatch && destructMatch[1]) {
    const params = destructMatch[1].trim();
    const newParams = params.endsWith(",")
      ? `${params}\n    ${name},`
      : `${params},\n    ${name},`;
    content = content.replace(
      constructorDestructRegex,
      `constructor({\n    ${newParams.trim()}\n  }:`
    );
    console.log(`  ✅ Added to constructor destructuring`);
  }

  // 5. Add to constructor body (this.name = name)
  const constructorBodyRegex = /(constructor\([^)]+\)\s*\{[\s\S]*?)(^\s*\})/m;
  const bodyMatch = content.match(constructorBodyRegex);
  if (bodyMatch) {
    const assignment = `    this.${name} = ${name};\n`;
    content = content.replace(
      constructorBodyRegex,
      `$1${assignment}$2`
    );
    console.log(`  ✅ Added constructor assignment`);
  }

  // 6. Add to toState() return if exists
  const toStateRegex = /(private\s+toState\(\)[^{]*\{[\s\S]*?return\s*\{[^}]*)(};)/;
  const toStateMatch = content.match(toStateRegex);
  if (toStateMatch) {
    content = content.replace(
      toStateRegex,
      `$1      ${name}: this.${name},\n    $2`
    );
    console.log(`  ✅ Added to toState()`);
  }

  // 7. Add to toSnapshot() if exists
  const toSnapshotRegex = /(toSnapshot\(\)[^{]*\{[\s\S]*?return\s*\{[^}]*)(};)/;
  const toSnapshotMatch = content.match(toSnapshotRegex);
  if (toSnapshotMatch) {
    content = content.replace(
      toSnapshotRegex,
      `$1      ${name}: this.${name},\n    $2`
    );
    console.log(`  ✅ Added to toSnapshot()`);
  }

  await Bun.write(filePath, content);
}

async function addToCreateCommand_fn(
  filePath: string,
  aggregateName: string,
  name: string,
  type: string,
  optional: boolean
): Promise<void> {
  const file = Bun.file(filePath);
  if (!await file.exists()) {
    console.log(`  ⚠️  Commands file not found: ${filePath}`);
    return;
  }

  let content = await file.text();

  const zodType = tsToZod(type, optional);
  const newField = `  ${name}: ${zodType},`;

  // Find CreateCommand and add field
  const createCommandRegex = new RegExp(
    `(export\\s+const\\s+Create${aggregateName}Command\\s*=\\s*z\\.object\\(\\{[^}]*)\\}\\)`,
    "s"
  );

  const match = content.match(createCommandRegex);
  if (match) {
    content = content.replace(
      createCommandRegex,
      `$1${newField}\n})`
    );
    await Bun.write(filePath, content);
    console.log(`  ✅ Added ${name} to Create${aggregateName}Command`);
  } else {
    console.log(`  ⚠️  Could not find Create${aggregateName}Command in commands.ts`);
  }
}

async function addToSchema(
  filePath: string,
  aggregateName: string,
  name: string,
  type: string
): Promise<void> {
  const file = Bun.file(filePath);
  let content = await file.text();

  const camelName = aggregateName.charAt(0).toLowerCase() + aggregateName.slice(1);
  const tableName = `${camelName}_list_view`;
  const snakeCaseName = name.replace(/([A-Z])/g, "_$1").toLowerCase();
  const sqliteType = tsToSqlite(type);

  // Find the table schema and add the column
  const tableRegex = new RegExp(
    `(CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${tableName}\\s*\\([^)]+)(\\))`,
    "si"
  );

  const match = content.match(tableRegex);
  if (match) {
    const newColumn = `,\n        ${snakeCaseName} ${sqliteType}`;
    content = content.replace(
      tableRegex,
      `$1${newColumn}$2`
    );
    await Bun.write(filePath, content);
    console.log(`  ✅ Added ${snakeCaseName} column to ${tableName} table`);
  } else {
    console.log(`  ⚠️  Could not find ${tableName} table in schemas.ts`);
  }
}

async function addToRepository(
  filePath: string,
  aggregateName: string,
  name: string,
  type: string,
  optional: boolean
): Promise<void> {
  const file = Bun.file(filePath);
  let content = await file.text();

  const snakeCaseName = name.replace(/([A-Z])/g, "_$1").toLowerCase();
  const optionalMark = optional ? "?" : "";

  // Look for ViewData type and add field
  const viewDataRegex = new RegExp(
    `(export\\s+type\\s+${aggregateName}(?:List)?ViewData\\s*=\\s*\\{[^}]*)\\}`,
    "s"
  );

  const match = content.match(viewDataRegex);
  if (match) {
    const newField = `  ${snakeCaseName}${optionalMark}: ${type === "boolean" ? "number" : type};`;
    content = content.replace(
      viewDataRegex,
      `$1${newField}\n}`
    );
    await Bun.write(filePath, content);
    console.log(`  ✅ Added ${snakeCaseName} to ViewData type`);
  }
}

// ==================== MODIFY HELPERS ====================

async function modifyInFile(
  filePath: string,
  oldName: string,
  newName: string,
  oldType: string,
  newType: string,
  oldOptional: boolean,
  newOptional: boolean
): Promise<void> {
  const file = Bun.file(filePath);
  if (!await file.exists()) return;

  let content = await file.text();

  // Rename if name changed
  if (oldName !== newName) {
    // Replace field definitions: oldName: type or oldName?: type
    const fieldRegex = new RegExp(`\\b${oldName}(\\?)?:`, "g");
    content = content.replace(fieldRegex, `${newName}$1:`);

    // Replace assignments: this.oldName
    const thisRegex = new RegExp(`this\\.${oldName}\\b`, "g");
    content = content.replace(thisRegex, `this.${newName}`);

    // Replace parameter references
    const paramRegex = new RegExp(`\\b${oldName}\\b(?=\\s*[,}])`, "g");
    content = content.replace(paramRegex, newName);
  }

  // Change type if type changed
  if (oldType !== newType) {
    const typeRegex = new RegExp(
      `(\\b${newName}\\??:\\s*)${oldType.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
      "g"
    );
    content = content.replace(typeRegex, `$1${newType}`);
  }

  // Change optional status
  if (oldOptional !== newOptional) {
    if (newOptional) {
      // Add ? if not present
      const addOptionalRegex = new RegExp(`(\\b${newName})(:)`, "g");
      content = content.replace(addOptionalRegex, "$1?$2");
    } else {
      // Remove ? if present
      const removeOptionalRegex = new RegExp(`(\\b${newName})\\?(:)`, "g");
      content = content.replace(removeOptionalRegex, "$1$2");
    }
  }

  await Bun.write(filePath, content);
}

async function modifyInCommands(
  filePath: string,
  oldName: string,
  newName: string,
  oldType: string,
  newType: string,
  newOptional: boolean
): Promise<void> {
  const file = Bun.file(filePath);
  let content = await file.text();

  // Rename field in Zod schemas
  if (oldName !== newName) {
    const fieldRegex = new RegExp(`\\b${oldName}:`, "g");
    content = content.replace(fieldRegex, `${newName}:`);
  }

  // Update Zod type if type changed
  if (oldType !== newType) {
    const newZodType = tsToZod(newType, newOptional);
    // This is complex because Zod types can have modifiers
    // For now, just warn the user
    console.log(`  ⚠️  Type changed - you may need to manually update Zod schema for ${newName}`);
  }

  await Bun.write(filePath, content);
}

async function modifyInSchema(
  filePath: string,
  aggregateName: string,
  oldName: string,
  newName: string,
  newType: string
): Promise<void> {
  const file = Bun.file(filePath);
  let content = await file.text();

  const oldSnakeName = oldName.replace(/([A-Z])/g, "_$1").toLowerCase();
  const newSnakeName = newName.replace(/([A-Z])/g, "_$1").toLowerCase();
  const newSqliteType = tsToSqlite(newType);

  // Rename column
  if (oldSnakeName !== newSnakeName) {
    const columnRegex = new RegExp(`\\b${oldSnakeName}\\b`, "g");
    content = content.replace(columnRegex, newSnakeName);
  }

  // Note: Changing column type in SQLite requires dropping and recreating
  // We'll just update the schema definition
  const typeRegex = new RegExp(`(${newSnakeName}\\s+)\\w+`, "g");
  content = content.replace(typeRegex, `$1${newSqliteType}`);

  await Bun.write(filePath, content);
}

// ==================== DELETE HELPERS ====================

async function deleteFromFile(filePath: string, name: string): Promise<void> {
  const file = Bun.file(filePath);
  if (!await file.exists()) return;

  let content = await file.text();

  // Remove field definitions: name: type; or name?: type;
  const fieldRegex = new RegExp(`^\\s*${name}\\??:[^;]+;\\s*$`, "gm");
  content = content.replace(fieldRegex, "");

  // Remove from object literals: name: this.name, or name,
  const objectLiteralRegex = new RegExp(`\\s*${name}:\\s*[^,}]+,?`, "g");
  content = content.replace(objectLiteralRegex, "");

  // Remove standalone references in destructuring: name,
  const destructRegex = new RegExp(`\\s*${name}\\s*,`, "g");
  content = content.replace(destructRegex, "");

  // Clean up any double commas or trailing commas before }
  content = content.replace(/,(\s*,)+/g, ",");
  content = content.replace(/,(\s*\})/g, "$1");
  content = content.replace(/,(\s*\))/g, "$1");

  await Bun.write(filePath, content);
}

async function deleteFromAggregate(filePath: string, name: string): Promise<void> {
  const file = Bun.file(filePath);
  let content = await file.text();

  // Remove private field
  const fieldRegex = new RegExp(`^\\s*(private|public)\\s+${name}\\??:[^;]+;\\s*$`, "gm");
  content = content.replace(fieldRegex, "");

  // Remove from constructor assignment: this.name = name;
  const assignRegex = new RegExp(`^\\s*this\\.${name}\\s*=\\s*${name};\\s*$`, "gm");
  content = content.replace(assignRegex, "");

  // Remove from type definitions
  const typeFieldRegex = new RegExp(`^\\s*${name}\\??:[^;]+;\\s*$`, "gm");
  content = content.replace(typeFieldRegex, "");

  // Remove from return statements: name: this.name,
  const returnFieldRegex = new RegExp(`\\s*${name}:\\s*this\\.${name},?`, "g");
  content = content.replace(returnFieldRegex, "");

  // Remove from destructuring: name,
  const destructRegex = new RegExp(`\\s*${name}\\s*,`, "g");
  content = content.replace(destructRegex, "");

  // Clean up
  content = content.replace(/,(\s*,)+/g, ",");
  content = content.replace(/,(\s*\})/g, "$1");

  await Bun.write(filePath, content);
}

async function deleteFromCommands(filePath: string, name: string): Promise<void> {
  const file = Bun.file(filePath);
  let content = await file.text();

  // Remove Zod field: name: z.something(),
  const zodFieldRegex = new RegExp(`^\\s*${name}:\\s*z\\.[^,]+,?\\s*$`, "gm");
  content = content.replace(zodFieldRegex, "");

  // Clean up
  content = content.replace(/,(\s*,)+/g, ",");
  content = content.replace(/,(\s*\}\))/g, "$1");

  await Bun.write(filePath, content);
}

async function deleteFromSchema(
  filePath: string,
  aggregateName: string,
  name: string
): Promise<void> {
  const file = Bun.file(filePath);
  let content = await file.text();

  const snakeCaseName = name.replace(/([A-Z])/g, "_$1").toLowerCase();

  // Remove column definition: column_name TYPE,
  const columnRegex = new RegExp(`\\s*,?\\s*${snakeCaseName}\\s+\\w+`, "gi");
  content = content.replace(columnRegex, "");

  // Clean up double commas
  content = content.replace(/,(\s*,)+/g, ",");

  await Bun.write(filePath, content);
}
