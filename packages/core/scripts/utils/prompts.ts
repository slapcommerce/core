import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const rl = readline.createInterface({ input, output });

export type FieldDefinition = {
  name: string;
  type: string;
  optional: boolean;
};

export type AggregateConfig = {
  name: string;
  fields: FieldDefinition[];
  includeStatus: boolean;
  accessLevel: "admin" | "public";
};

export async function promptForAggregateConfig(): Promise<AggregateConfig> {
  console.log("\n🚀 Aggregate Generator\n");

  // Get aggregate name
  const name = await rl.question("Aggregate name (PascalCase, e.g., Order): ");
  if (!name || !/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
    console.error("❌ Invalid name. Must be PascalCase (e.g., Order, Customer)");
    process.exit(1);
  }

  // Get fields
  const fields: FieldDefinition[] = [];
  let addingFields = true;

  console.log("\n📝 Add fields to the aggregate:");
  console.log("Available types: string, number, boolean, Date, string[], number[], Record<string, any>, etc.\n");

  while (addingFields) {
    const fieldName = await rl.question(
      `Field name (camelCase) ${fields.length === 0 ? "" : "[press Enter to finish]: "}`
    );

    if (!fieldName) {
      if (fields.length === 0) {
        console.error("❌ At least one field is required");
        continue;
      }
      addingFields = false;
      break;
    }

    if (!/^[a-z][a-zA-Z0-9]*$/.test(fieldName)) {
      console.error("❌ Invalid field name. Must be camelCase (e.g., userId, totalAmount)");
      continue;
    }

    // Reserved fields
    if (
      [
        "id",
        "version",
        "events",
        "uncommittedEvents",
        "correlationId",
        "createdAt",
        "updatedAt",
      ].includes(fieldName)
    ) {
      console.error(`❌ "${fieldName}" is a reserved field name`);
      continue;
    }

    const fieldType = await rl.question(`Type for "${fieldName}" (default: string): `);
    const type = fieldType.trim() || "string";

    const optionalInput = await rl.question(`Is "${fieldName}" optional? (y/N): `);
    const optional = optionalInput.toLowerCase() === "y";

    fields.push({ name: fieldName, type, optional });
    console.log(`✅ Added ${fieldName}: ${type}${optional ? " | null" : ""}\n`);
  }

  // Ask about status field
  const statusInput = await rl.question(
    '\nInclude status field ("draft" | "active" | "archived")? (Y/n): '
  );
  const includeStatus = statusInput.toLowerCase() !== "n";

  // Ask about access level
  const accessInput = await rl.question("\nAccess level for create command (admin/public, default: admin): ");
  const accessLevel = accessInput.toLowerCase() === "public" ? "public" : "admin";

  // Confirm
  console.log("\n📋 Configuration Summary:");
  console.log(`  Aggregate: ${name}`);
  console.log(`  Fields:`);
  fields.forEach((f) => {
    console.log(`    - ${f.name}: ${f.type}${f.optional ? " | null" : ""}`);
  });
  if (includeStatus) {
    console.log(`    - status: "draft" | "active" | "archived"`);
  }
  console.log(`  Access Level: ${accessLevel}`);

  const confirm = await rl.question("\nGenerate aggregate? (Y/n): ");
  if (confirm.toLowerCase() === "n") {
    console.log("❌ Cancelled");
    process.exit(0);
  }

  rl.close();

  return {
    name,
    fields,
    includeStatus,
    accessLevel,
  };
}
