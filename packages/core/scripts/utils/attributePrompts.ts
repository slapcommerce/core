import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  discoverAggregates,
  parseStateType,
  attributeExists,
  RESERVED_FIELDS,
  type ParsedAttribute,
} from "./attributeParser";

const rl = readline.createInterface({ input, output });

export type Operation = "add" | "modify" | "delete";

export interface AddAttributeConfig {
  operation: "add";
  aggregateName: string;
  attribute: {
    name: string;
    type: string;
    optional: boolean;
  };
  addToCreateCommand: boolean;
}

export interface ModifyAttributeConfig {
  operation: "modify";
  aggregateName: string;
  originalAttribute: ParsedAttribute;
  newName: string | null; // null means keep original
  newType: string | null; // null means keep original
  newOptional: boolean | null; // null means keep original
}

export interface DeleteAttributeConfig {
  operation: "delete";
  aggregateName: string;
  attribute: ParsedAttribute;
}

export type AttributeConfig = AddAttributeConfig | ModifyAttributeConfig | DeleteAttributeConfig;

/**
 * Main prompt function to gather attribute modification configuration
 */
export async function promptForAttributeConfig(): Promise<AttributeConfig> {
  console.log("\n🔧 Attribute Modifier\n");

  // Step 1: Select aggregate
  const aggregates = await discoverAggregates();
  if (aggregates.length === 0) {
    console.error("❌ No aggregates found in the domain directory");
    process.exit(1);
  }

  console.log("Available aggregates:");
  aggregates.forEach((agg, i) => console.log(`  ${i + 1}. ${agg}`));

  const aggChoice = await rl.question("\nSelect aggregate (number): ");
  const aggIndex = parseInt(aggChoice, 10) - 1;
  if (isNaN(aggIndex) || aggIndex < 0 || aggIndex >= aggregates.length) {
    console.error("❌ Invalid selection");
    process.exit(1);
  }

  const aggregateName = aggregates[aggIndex];
  if (!aggregateName) {
    console.error("❌ Invalid aggregate selection");
    process.exit(1);
  }

  // Step 2: Show current attributes
  console.log(`\n📋 Current attributes for ${aggregateName}:`);
  const currentAttributes = await parseStateType(aggregateName);
  if (currentAttributes.length === 0) {
    console.log("  (no custom attributes found)");
  } else {
    currentAttributes.forEach((attr, i) => {
      const optionalMark = attr.optional ? "?" : "";
      console.log(`  ${i + 1}. ${attr.name}${optionalMark}: ${attr.type}`);
    });
  }

  // Step 3: Select operation
  console.log("\nSelect operation:");
  console.log("  [A] Add new attribute");
  console.log("  [M] Modify existing attribute");
  console.log("  [D] Delete attribute");

  const opChoice = await rl.question("\nOperation (A/M/D): ");
  const operation = opChoice.toLowerCase();

  if (operation === "a") {
    return await promptAddAttribute(aggregateName);
  } else if (operation === "m") {
    return await promptModifyAttribute(aggregateName, currentAttributes);
  } else if (operation === "d") {
    return await promptDeleteAttribute(aggregateName, currentAttributes);
  } else {
    console.error("❌ Invalid operation. Choose A, M, or D");
    process.exit(1);
  }
}

/**
 * Prompt for adding a new attribute
 */
async function promptAddAttribute(aggregateName: string): Promise<AddAttributeConfig> {
  console.log("\n➕ Add New Attribute\n");

  // Get attribute name
  const name = await rl.question("Attribute name (camelCase): ");
  if (!name || !/^[a-z][a-zA-Z0-9]*$/.test(name)) {
    console.error("❌ Invalid name. Must be camelCase (e.g., productWeight, itemCount)");
    process.exit(1);
  }

  // Check reserved names
  if (RESERVED_FIELDS.includes(name)) {
    console.error(`❌ "${name}" is a reserved field name`);
    process.exit(1);
  }

  // Check if already exists
  if (await attributeExists(aggregateName, name)) {
    console.error(`❌ Attribute "${name}" already exists on ${aggregateName}`);
    process.exit(1);
  }

  // Get type
  console.log("\nCommon types: string, number, boolean, Date, string[], number[]");
  const type = await rl.question("Type: ");
  if (!type) {
    console.error("❌ Type is required");
    process.exit(1);
  }

  // Is optional?
  const optionalInput = await rl.question("Is this attribute optional? (y/N): ");
  const optional = optionalInput.toLowerCase() === "y";

  // Add to CreateCommand?
  const addToCreateInput = await rl.question("Add to CreateCommand? (Y/n): ");
  const addToCreateCommand = addToCreateInput.toLowerCase() !== "n";

  // Confirm
  console.log("\n📋 Summary:");
  console.log(`  Aggregate: ${aggregateName}`);
  console.log(`  Add: ${name}${optional ? "?" : ""}: ${type}`);
  console.log(`  Add to CreateCommand: ${addToCreateCommand ? "Yes" : "No"}`);

  const confirm = await rl.question("\nProceed? (Y/n): ");
  if (confirm.toLowerCase() === "n") {
    console.log("❌ Cancelled");
    process.exit(0);
  }

  rl.close();

  return {
    operation: "add",
    aggregateName,
    attribute: { name, type, optional },
    addToCreateCommand,
  };
}

/**
 * Prompt for modifying an existing attribute
 */
async function promptModifyAttribute(
  aggregateName: string,
  currentAttributes: ParsedAttribute[]
): Promise<ModifyAttributeConfig> {
  console.log("\n✏️  Modify Attribute\n");

  if (currentAttributes.length === 0) {
    console.error("❌ No attributes to modify");
    process.exit(1);
  }

  // Select attribute to modify
  const attrChoice = await rl.question("Select attribute to modify (number): ");
  const attrIndex = parseInt(attrChoice, 10) - 1;
  if (isNaN(attrIndex) || attrIndex < 0 || attrIndex >= currentAttributes.length) {
    console.error("❌ Invalid selection");
    process.exit(1);
  }

  const originalAttribute = currentAttributes[attrIndex];
  if (!originalAttribute) {
    console.error("❌ Invalid attribute selection");
    process.exit(1);
  }

  console.log(`\nModifying: ${originalAttribute.name}${originalAttribute.optional ? "?" : ""}: ${originalAttribute.type}`);

  // What to change?
  console.log("\nWhat would you like to change?");
  console.log("  [N] Name only");
  console.log("  [T] Type only");
  console.log("  [O] Optional status only");
  console.log("  [B] Both name and type");
  console.log("  [A] All (name, type, and optional)");

  const changeChoice = await rl.question("\nChoice (N/T/O/B/A): ");
  const change = changeChoice.toLowerCase();

  let newName: string | null = null;
  let newType: string | null = null;
  let newOptional: boolean | null = null;

  if (change === "n" || change === "b" || change === "a") {
    const nameInput = await rl.question(`New name (or Enter to keep "${originalAttribute.name}"): `);
    if (nameInput) {
      if (!/^[a-z][a-zA-Z0-9]*$/.test(nameInput)) {
        console.error("❌ Invalid name. Must be camelCase");
        process.exit(1);
      }
      if (RESERVED_FIELDS.includes(nameInput)) {
        console.error(`❌ "${nameInput}" is a reserved field name`);
        process.exit(1);
      }
      if (nameInput !== originalAttribute.name && await attributeExists(aggregateName, nameInput)) {
        console.error(`❌ Attribute "${nameInput}" already exists`);
        process.exit(1);
      }
      newName = nameInput;
    }
  }

  if (change === "t" || change === "b" || change === "a") {
    console.log("\nCommon types: string, number, boolean, Date, string[], number[]");
    const typeInput = await rl.question(`New type (or Enter to keep "${originalAttribute.type}"): `);
    if (typeInput) {
      newType = typeInput;
    }
  }

  if (change === "o" || change === "a") {
    const optionalInput = await rl.question(`Make optional? (currently: ${originalAttribute.optional ? "yes" : "no"}) (y/n/Enter to keep): `);
    if (optionalInput.toLowerCase() === "y") {
      newOptional = true;
    } else if (optionalInput.toLowerCase() === "n") {
      newOptional = false;
    }
  }

  if (!newName && !newType && newOptional === null) {
    console.log("❌ No changes specified");
    process.exit(0);
  }

  // Confirm
  console.log("\n📋 Summary:");
  console.log(`  Aggregate: ${aggregateName}`);
  console.log(`  Original: ${originalAttribute.name}${originalAttribute.optional ? "?" : ""}: ${originalAttribute.type}`);
  const finalName = newName || originalAttribute.name;
  const finalType = newType || originalAttribute.type;
  const finalOptional = newOptional !== null ? newOptional : originalAttribute.optional;
  console.log(`  New:      ${finalName}${finalOptional ? "?" : ""}: ${finalType}`);

  const confirm = await rl.question("\nProceed? (Y/n): ");
  if (confirm.toLowerCase() === "n") {
    console.log("❌ Cancelled");
    process.exit(0);
  }

  rl.close();

  return {
    operation: "modify",
    aggregateName,
    originalAttribute,
    newName,
    newType,
    newOptional,
  };
}

/**
 * Prompt for deleting an attribute
 */
async function promptDeleteAttribute(
  aggregateName: string,
  currentAttributes: ParsedAttribute[]
): Promise<DeleteAttributeConfig> {
  console.log("\n🗑️  Delete Attribute\n");

  if (currentAttributes.length === 0) {
    console.error("❌ No attributes to delete");
    process.exit(1);
  }

  // Select attribute to delete
  const attrChoice = await rl.question("Select attribute to delete (number): ");
  const attrIndex = parseInt(attrChoice, 10) - 1;
  if (isNaN(attrIndex) || attrIndex < 0 || attrIndex >= currentAttributes.length) {
    console.error("❌ Invalid selection");
    process.exit(1);
  }

  const attribute = currentAttributes[attrIndex];
  if (!attribute) {
    console.error("❌ Invalid attribute selection");
    process.exit(1);
  }

  // Confirm deletion
  console.log(`\n⚠️  WARNING: This will delete "${attribute.name}" from ${aggregateName}`);
  console.log("This may break existing code that references this attribute.");

  const confirm = await rl.question("\nAre you sure you want to delete this attribute? (type 'yes' to confirm): ");
  if (confirm.toLowerCase() !== "yes") {
    console.log("❌ Cancelled");
    process.exit(0);
  }

  rl.close();

  return {
    operation: "delete",
    aggregateName,
    attribute,
  };
}

export function closeReadline(): void {
  rl.close();
}
