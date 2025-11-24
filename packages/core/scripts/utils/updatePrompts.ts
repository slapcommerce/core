import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { toCamelCase } from "./templates";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CORE_ROOT = join(__dirname, "../..");
const SRC_ROOT = join(CORE_ROOT, "src");

const rl = readline.createInterface({ input, output });

export type UpdateFieldConfig = {
  name: string;
  type: string;
  zodValidation: string;
};

export type UpdateMethodConfig = {
  aggregateName: string;
  aggregateCamelName: string;
  methodName: string;
  eventName: string;
  commandName: string;
  commandType: string;
  fields: UpdateFieldConfig[];
  accessLevel: "admin" | "public";
  affectedFields: string[];
};

async function getAvailableAggregates(): Promise<string[]> {
  const domainPath = join(SRC_ROOT, "domain");

  const entries = await Array.fromAsync(
    new Bun.Glob("*").scan({ cwd: domainPath, onlyFiles: false })
  );

  const aggregates: string[] = [];
  for (const entry of entries) {
    const aggregatePath = `${domainPath}/${entry}/aggregate.ts`;
    if (await Bun.file(aggregatePath).exists()) {
      const name = entry.charAt(0).toUpperCase() + entry.slice(1);
      aggregates.push(name);
    }
  }

  return aggregates;
}

async function parseAggregateFields(aggregateName: string): Promise<Map<string, string>> {
  const camelName = toCamelCase(aggregateName);
  const aggregatePath = join(SRC_ROOT, "domain", camelName, "aggregate.ts");

  const file = Bun.file(aggregatePath);
  const content = await file.text();

  const fieldMap = new Map<string, string>();
  const fieldRegex = /(?:private|public)\s+(\w+):\s*([^;]+);/g;
  let match;

  while ((match = fieldRegex.exec(content)) !== null) {
    const fieldName = match[1];
    if (fieldName === undefined) {
      throw new Error("Field name is undefined");
    }
    if (match[2] === undefined) {
      throw new Error("Field type is undefined");
    }
    const fieldType = match[2].trim();

    if (!["id", "version", "events", "uncommittedEvents", "correlationId", "createdAt", "updatedAt"].includes(fieldName)) {
      fieldMap.set(fieldName, fieldType);
    }
  }

  return fieldMap;
}

function typeToZodValidation(type: string): string {
  if (type === "string") return "z.string().min(1)";
  if (type === "number") return "z.number()";
  if (type === "boolean") return "z.boolean()";
  if (type === "Date") return "z.date()";
  if (type === "string[]") return "z.array(z.string())";
  if (type === "number[]") return "z.array(z.number())";

  if (type.includes("|")) {
    const types = type.split("|").map(t => t.trim());
    if (types.includes("null")) {
      const nonNullType = types.find(t => t !== "null");
      if (nonNullType) {
        const baseValidation = typeToZodValidation(nonNullType);
        return `${baseValidation}.nullable()`;
      }
    }
    if (types.every(t => t.startsWith('"'))) {
      const literals = types.map(t => t.replace(/"/g, "")).join('", "');
      return `z.enum(["${literals}"])`;
    }
  }

  if (type.startsWith("Record<")) return "z.record(z.string(), z.any())";
  if (type.startsWith("{")) return "z.any()";

  return "z.any()";
}

export async function promptForUpdateConfig(): Promise<UpdateMethodConfig> {
  console.log("\n🚀 Update Method Generator\n");

  const availableAggregates = await getAvailableAggregates();

  if (availableAggregates.length === 0) {
    console.error("❌ No aggregates found in src/domain");
    process.exit(1);
  }

  console.log("Available aggregates:");
  availableAggregates.forEach((agg, i) => {
    console.log(`  ${i + 1}. ${agg}`);
  });

  const aggregateChoice = await rl.question("\nSelect aggregate (number or name): ");
  let aggregateName: string;

  if (/^\d+$/.test(aggregateChoice)) {
    const index = parseInt(aggregateChoice) - 1;
    if (index < 0 || index >= availableAggregates.length) {
      console.error("❌ Invalid selection");
      process.exit(1);
    }
    if (availableAggregates[index] === undefined) {
      throw new Error("Selected aggregate is undefined");
    }
    aggregateName = availableAggregates[index];
  } else {
    aggregateName = aggregateChoice;
    if (!availableAggregates.includes(aggregateName)) {
      console.error(`❌ Aggregate "${aggregateName}" not found`);
      process.exit(1);
    }
  }

  const aggregateCamelName = toCamelCase(aggregateName);

  const aggregateFields = await parseAggregateFields(aggregateName);
  console.log(`\n📝 Available fields in ${aggregateName}:`);
  Array.from(aggregateFields.keys()).forEach((field, i) => {
    console.log(`  ${i + 1}. ${field}: ${aggregateFields.get(field)}`);
  });

  const methodName = await rl.question("\nMethod name (camelCase, e.g., updateDetails, publish): ");
  if (!methodName || !/^[a-z][a-zA-Z0-9]*$/.test(methodName)) {
    console.error("❌ Invalid method name. Must be camelCase");
    process.exit(1);
  }

  console.log("\n📝 Select fields that this method will update:");
  console.log("Enter field numbers separated by commas or field names");

  const fieldsInput = await rl.question("Fields to update: ");
  const affectedFields: string[] = [];

  if (fieldsInput.includes(",")) {
    const inputs = fieldsInput.split(",").map(s => s.trim());
    for (const input of inputs) {
      if (/^\d+$/.test(input)) {
        const index = parseInt(input) - 1;
        const fieldName = Array.from(aggregateFields.keys())[index];
        if (fieldName) {
          affectedFields.push(fieldName);
        }
      } else if (aggregateFields.has(input)) {
        affectedFields.push(input);
      }
    }
  } else {
    if (/^\d+$/.test(fieldsInput)) {
      const index = parseInt(fieldsInput) - 1;
      const fieldName = Array.from(aggregateFields.keys())[index];
      if (fieldName) {
        affectedFields.push(fieldName);
      }
    } else if (aggregateFields.has(fieldsInput)) {
      affectedFields.push(fieldsInput);
    }
  }

  if (affectedFields.length === 0) {
    console.error("❌ At least one field is required");
    process.exit(1);
  }

  console.log(`\n✅ Selected fields: ${affectedFields.join(", ")}`);

  const fields: UpdateFieldConfig[] = affectedFields.map(fieldName => {
    const fieldType = aggregateFields.get(fieldName)!;
    return {
      name: fieldName,
      type: fieldType,
      zodValidation: typeToZodValidation(fieldType),
    };
  });

  const eventName = `${aggregateName}${methodName.charAt(0).toUpperCase() + methodName.slice(1)}Event`;
  const commandName = `${methodName.charAt(0).toUpperCase() + methodName.slice(1)}${aggregateName}Command`;
  const commandType = `${methodName}${aggregateName}`;

  const accessInput = await rl.question("\nAccess level for command (admin/public, default: admin): ");
  const accessLevel = accessInput.toLowerCase() === "public" ? "public" : "admin";

  console.log("\n📋 Configuration Summary:");
  console.log(`  Aggregate: ${aggregateName}`);
  console.log(`  Method: ${methodName}`);
  console.log(`  Event: ${eventName}`);
  console.log(`  Command: ${commandName}`);
  console.log(`  Command Type: ${commandType}`);
  console.log(`  Fields to update:`);
  affectedFields.forEach((f) => {
    console.log(`    - ${f}: ${aggregateFields.get(f)}`);
  });
  console.log(`  Access Level: ${accessLevel}`);

  const confirm = await rl.question("\nGenerate update method? (Y/n): ");
  if (confirm.toLowerCase() === "n") {
    console.log("❌ Cancelled");
    process.exit(0);
  }

  rl.close();

  return {
    aggregateName,
    aggregateCamelName,
    methodName,
    eventName,
    commandName,
    commandType,
    fields,
    accessLevel,
    affectedFields,
  };
}
