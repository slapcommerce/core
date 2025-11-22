import type { AttributeUpdateConfig, AttributeOperation } from "../utils/attributePrompts";
import { typeToZodValidation } from "../utils/attributePrompts";

export async function updateApplicationLayer(config: AttributeUpdateConfig): Promise<void> {
  console.log("\n📦 Updating application layer...");

  await updateCommandsFile(config);
}

async function updateCommandsFile(config: AttributeUpdateConfig): Promise<void> {
  const commandsPath = `/Users/ryanwible/projects/core/src/app/${config.aggregateCamelName}/commands.ts`;
  const file = Bun.file(commandsPath);

  if (!(await file.exists())) {
    console.log(`  ⚠️  Commands file not found, skipping`);
    return;
  }

  let content = await file.text();

  // Focus on updating CreateCommand since it contains all attributes
  const createCommandRegex = new RegExp(
    `export const Create${config.aggregateName}Command = z\\.object\\(\\{[\\s\\S]*?\\}\\);`,
    "m"
  );

  const createCommandMatch = content.match(createCommandRegex);
  if (!createCommandMatch) {
    console.log(`  ⚠️  Create${config.aggregateName}Command not found, skipping`);
    return;
  }

  let commandSchema = createCommandMatch[0];

  // Process each operation
  for (const op of config.operations) {
    if (op.type === "add") {
      commandSchema = addFieldToCommand(commandSchema, op);
    } else if (op.type === "rename") {
      commandSchema = renameFieldInCommand(commandSchema, op);
    } else if (op.type === "changeType") {
      commandSchema = changeFieldTypeInCommand(commandSchema, op);
    } else if (op.type === "delete") {
      commandSchema = deleteFieldFromCommand(commandSchema, op);
    }
  }

  // Replace the command schema in content
  content = content.replace(createCommandMatch[0], commandSchema);

  await Bun.write(commandsPath, content);
  console.log(`  ✅ Updated Create${config.aggregateName}Command schema`);
}

function addFieldToCommand(
  commandSchema: string,
  op: Extract<AttributeOperation, { type: "add" }>
): string {
  const zodValidator = typeToZodValidation(op.fieldType);
  const optionalModifier = op.optional ? ".optional()" : "";
  const defaultModifier = op.defaultValue && op.optional
    ? `.default(${op.defaultValue})`
    : op.optional
    ? ""
    : "";

  const fieldLine = `  ${op.name}: ${zodValidator}${optionalModifier}${defaultModifier},`;

  // Add before the closing });
  const closingIndex = commandSchema.lastIndexOf("});");
  return (
    commandSchema.substring(0, closingIndex) +
    `${fieldLine}\n` +
    commandSchema.substring(closingIndex)
  );
}

function renameFieldInCommand(
  commandSchema: string,
  op: Extract<AttributeOperation, { type: "rename" }>
): string {
  // Rename the field in the schema
  const fieldRegex = new RegExp(`(\\s+)${op.oldName}:`, "g");
  return commandSchema.replace(fieldRegex, `$1${op.newName}:`);
}

function changeFieldTypeInCommand(
  commandSchema: string,
  op: Extract<AttributeOperation, { type: "changeType" }>
): string {
  const zodValidator = typeToZodValidation(op.newType);

  // Find the field and update its validator
  const fieldRegex = new RegExp(
    `(\\s+${op.name}:\\s*)z\\.[^,]+,`,
    "g"
  );

  return commandSchema.replace(fieldRegex, `$1${zodValidator},`);
}

function deleteFieldFromCommand(
  commandSchema: string,
  op: Extract<AttributeOperation, { type: "delete" }>
): string {
  // Remove the field line
  const fieldRegex = new RegExp(
    `\\s+${op.name}:\\s*z\\.[^,]+,\\n?`,
    "g"
  );

  return commandSchema.replace(fieldRegex, "");
}
