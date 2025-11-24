import type { UpdateMethodConfig } from "../utils/updatePrompts";
import { generateCommandSchema, generateServiceClass } from "../utils/updateTemplates";
import { writeFile } from "../utils/fileWriter";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CORE_ROOT = join(__dirname, "../..");
const SRC_ROOT = join(CORE_ROOT, "src");

export async function generateUpdateApplicationLayer(config: UpdateMethodConfig): Promise<void> {
  console.log("\n📦 Generating application layer...");

  await addCommandToCommandsFile(config);
  await generateServiceFile(config);
  await addToCommandTypeUnion(config);
}

async function addCommandToCommandsFile(config: UpdateMethodConfig): Promise<void> {
  const { aggregateCamelName, commandName } = config;
  const commandsPath = join(SRC_ROOT, "app", aggregateCamelName, "commands.ts");

  const file = Bun.file(commandsPath);
  const content = await file.text();

  // Check if command already exists
  if (content.includes(`export const ${commandName}`)) {
    console.log(`  ⚠️  Command ${commandName} already exists, skipping`);
    return;
  }

  // Generate the command schema
  const commandSchema = generateCommandSchema(config);

  // Append to the end of the file
  const newContent = content + "\n" + commandSchema + "\n";

  await Bun.write(commandsPath, newContent);
  console.log(`  ✅ Added ${commandName} to commands.ts`);
}

async function generateServiceFile(config: UpdateMethodConfig): Promise<void> {
  const { aggregateCamelName, methodName, commandName } = config;

  const serviceName = commandName.replace("Command", "Service");
  const serviceFileName = `${methodName}${config.aggregateName}Service.ts`;
  const servicePath = join(SRC_ROOT, "app", aggregateCamelName, serviceFileName);

  // Check if service already exists
  if (await Bun.file(servicePath).exists()) {
    console.log(`  ⚠️  Service ${serviceName} already exists, skipping`);
    return;
  }

  // Generate the service class
  const serviceClass = generateServiceClass(config);

  await writeFile(servicePath, serviceClass);
}

async function addToCommandTypeUnion(config: UpdateMethodConfig): Promise<void> {
  const { commandType } = config;
  const commandTypePath = join(SRC_ROOT, "app", "command.ts");

  const file = Bun.file(commandTypePath);
  const content = await file.text();

  // Check if already in union
  if (content.includes(`"${commandType}"`)) {
    console.log(`  ⚠️  Command type "${commandType}" already exists in CommandType union, skipping`);
    return;
  }

  // Find the CommandType union
  const unionRegex = /export type CommandType\s*=([\s\S]*?);/;
  const match = content.match(unionRegex);

  if (!match) {
    throw new Error("Could not find CommandType union in command.ts");
  }

  const unionContent = match[1];
  if (unionContent === undefined) {
    throw new Error("CommandType union content is undefined");
  }

  // Add to the union - find the last pipe and add after it
  const lastPipeIndex = unionContent.lastIndexOf("|");
  if (lastPipeIndex === -1) {
    // Single type, add pipe and new type
    const updatedUnion = unionContent.trim() + '\n  | "' + commandType + '"';
    const newContent = content.replace(unionRegex, `export type CommandType = ${updatedUnion};`);
    await Bun.write(commandTypePath, newContent);
  } else {
    // Multiple types, add after last one
    const lines = unionContent.split("\n");

    // Insert before the last line (which should be just whitespace or close)
    lines.splice(lines.length - 1, 0, `    | "${commandType}"`);

    const updatedUnion = lines.join("\n");
    const newContent = content.replace(unionRegex, `export type CommandType =${updatedUnion};`);
    await Bun.write(commandTypePath, newContent);
  }

  console.log(`  ✅ Added "${commandType}" to CommandType union`);
}
