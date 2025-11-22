import type { AttributeUpdateConfig, AttributeOperation } from "../utils/attributePrompts";
import {
  getDefaultValueForType,
  renameFieldInContent,
  updateFieldType,
} from "../utils/attributeTemplates";

export async function updateDomainLayer(config: AttributeUpdateConfig): Promise<void> {
  console.log("\n🏗️  Updating domain layer...");

  await updateEventsFile(config);
  await updateAggregateFile(config);
}

async function updateEventsFile(config: AttributeUpdateConfig): Promise<void> {
  const eventsPath = `/Users/ryanwible/projects/core/src/domain/${config.aggregateCamelName}/events.ts`;
  const file = Bun.file(eventsPath);
  let content = await file.text();

  // Find the State type definition
  const stateTypeRegex = new RegExp(
    `export type ${config.aggregateName}State = \\{[\\s\\S]*?\\n\\};`,
    "m"
  );

  const stateMatch = content.match(stateTypeRegex);
  if (!stateMatch) {
    throw new Error(`Could not find ${config.aggregateName}State type definition`);
  }

  let stateTypeContent = stateMatch[0];

  // Process each operation
  for (const op of config.operations) {
    if (op.type === "add") {
      const optional = op.optional ? "?" : "";
      const fieldLine = `  ${op.name}${optional}: ${op.fieldType};`;

      // Add before the closing brace (before [key: string]: any if it exists)
      const indexSignatureIndex = stateTypeContent.indexOf("[key: string]: any");
      if (indexSignatureIndex !== -1) {
        const insertIndex = stateTypeContent.lastIndexOf("\n", indexSignatureIndex);
        stateTypeContent =
          stateTypeContent.substring(0, insertIndex) +
          `\n${fieldLine}` +
          stateTypeContent.substring(insertIndex);
      } else {
        // Add before closing brace
        const closingBraceIndex = stateTypeContent.lastIndexOf("};");
        stateTypeContent =
          stateTypeContent.substring(0, closingBraceIndex) +
          `${fieldLine}\n` +
          stateTypeContent.substring(closingBraceIndex);
      }
    } else if (op.type === "rename") {
      // Rename field in State type
      const fieldRegex = new RegExp(
        `(\\s+)${op.oldName}(\\??):\\s*([^;]+);`,
        "g"
      );
      stateTypeContent = stateTypeContent.replace(
        fieldRegex,
        `$1${op.newName}$2: $3;`
      );
    } else if (op.type === "changeType") {
      // Update field type
      const fieldRegex = new RegExp(
        `(\\s+${op.name}\\??):\\s*[^;]+;`,
        "g"
      );
      stateTypeContent = stateTypeContent.replace(
        fieldRegex,
        `$1: ${op.newType};`
      );
    } else if (op.type === "delete") {
      // Remove field from State type
      const fieldRegex = new RegExp(
        `\\s+${op.name}\\??:\\s*[^;]+;\\n?`,
        "g"
      );
      stateTypeContent = stateTypeContent.replace(fieldRegex, "");
    }
  }

  // Replace the state type in content
  content = content.replace(stateMatch[0], stateTypeContent);

  await Bun.write(eventsPath, content);
  console.log(`  ✅ Updated ${config.aggregateName}State type`);
}

async function updateAggregateFile(config: AttributeUpdateConfig): Promise<void> {
  const aggregatePath = `/Users/ryanwible/projects/core/src/domain/${config.aggregateCamelName}/aggregate.ts`;
  const file = Bun.file(aggregatePath);
  let content = await file.text();

  // Process each operation
  for (const op of config.operations) {
    if (op.type === "add") {
      content = await addFieldToAggregate(content, config, op);
    } else if (op.type === "rename") {
      content = await renameFieldInAggregate(content, config, op);
    } else if (op.type === "changeType") {
      content = await changeFieldTypeInAggregate(content, config, op);
    } else if (op.type === "delete") {
      content = await deleteFieldFromAggregate(content, config, op);
    }
  }

  await Bun.write(aggregatePath, content);
  console.log(`  ✅ Updated ${config.aggregateName}Aggregate`);
}

async function addFieldToAggregate(
  content: string,
  config: AttributeUpdateConfig,
  op: Extract<AttributeOperation, { type: "add" }>
): Promise<string> {
  const optional = op.optional ? "?" : "";
  const defaultValue = getDefaultValueForType(op.fieldType, op.defaultValue);

  // 1. Add to AggregateParams type
  const paramsTypeRegex = new RegExp(
    `type ${config.aggregateName}AggregateParams = \\{[\\s\\S]*?\\n\\};`,
    "m"
  );
  const paramsMatch = content.match(paramsTypeRegex);
  if (paramsMatch) {
    const closingBraceIndex = paramsMatch[0].lastIndexOf("};");
    const fieldLine = `  ${op.name}${optional}: ${op.fieldType};`;
    const updated =
      paramsMatch[0].substring(0, closingBraceIndex) +
      `${fieldLine}\n` +
      paramsMatch[0].substring(closingBraceIndex);
    content = content.replace(paramsMatch[0], updated);
  }

  // 2. Add private field to class
  const classFieldsRegex = new RegExp(
    `export class ${config.aggregateName}Aggregate \\{[\\s\\S]*?constructor`,
    "m"
  );
  const classMatch = content.match(classFieldsRegex);
  if (classMatch) {
    const constructorIndex = classMatch[0].lastIndexOf("constructor");
    const fieldLine = `  private ${op.name}${optional}: ${op.fieldType};\n`;
    const updated =
      classMatch[0].substring(0, constructorIndex) +
      fieldLine +
      "  " +
      classMatch[0].substring(constructorIndex);
    content = content.replace(classMatch[0], updated);
  }

  // 3. Add to constructor destructuring
  const constructorParamsRegex = new RegExp(
    `constructor\\(\\{[\\s\\S]*?\\}: ${config.aggregateName}AggregateParams\\)`,
    "m"
  );
  const constructorMatch = content.match(constructorParamsRegex);
  if (constructorMatch) {
    const closingBraceIndex = constructorMatch[0].lastIndexOf("}:");
    const updated =
      constructorMatch[0].substring(0, closingBraceIndex) +
      `    ${op.name},\n  ` +
      constructorMatch[0].substring(closingBraceIndex);
    content = content.replace(constructorMatch[0], updated);
  }

  // 4. Add to constructor assignment
  const constructorBodyStart = content.indexOf("this.id = id");
  if (constructorBodyStart !== -1) {
    const nextLineAfterAssignments = content.indexOf("\n  }", constructorBodyStart);
    const assignmentLine = `    this.${op.name} = ${op.name};\n`;
    content =
      content.substring(0, nextLineAfterAssignments) +
      assignmentLine +
      content.substring(nextLineAfterAssignments);
  }

  // 5. Add to create() factory method params if it exists
  const createParamsRegex = new RegExp(
    `type Create${config.aggregateName}AggregateParams = \\{[\\s\\S]*?\\n\\};`,
    "m"
  );
  const createParamsMatch = content.match(createParamsRegex);
  if (createParamsMatch && !op.optional) {
    // Only add required fields to create params
    const closingBraceIndex = createParamsMatch[0].lastIndexOf("};");
    const fieldLine = `  ${op.name}: ${op.fieldType};`;
    const updated =
      createParamsMatch[0].substring(0, closingBraceIndex) +
      `${fieldLine}\n` +
      createParamsMatch[0].substring(closingBraceIndex);
    content = content.replace(createParamsMatch[0], updated);
  }

  // 6. Add to static create() method
  if (!op.optional) {
    const createMethodRegex = /static create\(\{[\s\S]*?\}: Create\w+AggregateParams\)/m;
    const createMethodMatch = content.match(createMethodRegex);
    if (createMethodMatch) {
      const closingBraceIndex = createMethodMatch[0].lastIndexOf("}:");
      const updated =
        createMethodMatch[0].substring(0, closingBraceIndex) +
        `    ${op.name},\n  ` +
        createMethodMatch[0].substring(closingBraceIndex);
      content = content.replace(createMethodMatch[0], updated);
    }

    // Add to new aggregate instantiation in create()
    const newAggregateRegex = new RegExp(
      `return new ${config.aggregateName}Aggregate\\(\\{[\\s\\S]*?\\}\\);`,
      "m"
    );
    const newAggregateMatch = content.match(newAggregateRegex);
    if (newAggregateMatch) {
      const closingBraceIndex = newAggregateMatch[0].lastIndexOf("});");
      const fieldLine = `      ${op.name},`;
      const updated =
        newAggregateMatch[0].substring(0, closingBraceIndex) +
        `\n${fieldLine}\n    ` +
        newAggregateMatch[0].substring(closingBraceIndex);
      content = content.replace(newAggregateMatch[0], updated);
    }
  }

  // 7. Add to toState() method
  const toStateRegex = /private toState\(\): \w+State \{[\s\S]*?return \{[\s\S]*?\};[\s\S]*?\}/m;
  const toStateMatch = content.match(toStateRegex);
  if (toStateMatch) {
    const returnObjRegex = /return \{[\s\S]*?\};/;
    const returnMatch = toStateMatch[0].match(returnObjRegex);
    if (returnMatch) {
      const closingBraceIndex = returnMatch[0].lastIndexOf("};");
      const fieldLine = `      ${op.name}: this.${op.name},`;
      const updated =
        returnMatch[0].substring(0, closingBraceIndex) +
        `\n${fieldLine}\n    ` +
        returnMatch[0].substring(closingBraceIndex);
      content = content.replace(returnMatch[0], updated);
    }
  }

  // 8. Add to toSnapshot() method
  const toSnapshotRegex = /toSnapshot\(\) \{[\s\S]*?return \{[\s\S]*?\};[\s\S]*?\}/m;
  const toSnapshotMatch = content.match(toSnapshotRegex);
  if (toSnapshotMatch) {
    const returnObjRegex = /return \{[\s\S]*?\};/;
    const returnMatch = toSnapshotMatch[0].match(returnObjRegex);
    if (returnMatch) {
      const closingBraceIndex = returnMatch[0].lastIndexOf("};");
      const fieldLine = `      ${op.name}: this.${op.name},`;
      const updated =
        returnMatch[0].substring(0, closingBraceIndex) +
        `\n${fieldLine}\n    ` +
        returnMatch[0].substring(closingBraceIndex);
      content = content.replace(returnMatch[0], updated);
    }
  }

  // 9. Add to loadFromSnapshot() method
  const loadFromSnapshotRegex = /static loadFromSnapshot[\s\S]*?return new \w+Aggregate\(\{[\s\S]*?\}\);[\s\S]*?\}/m;
  const loadMatch = content.match(loadFromSnapshotRegex);
  if (loadMatch) {
    const newAggregateRegex = /return new \w+Aggregate\(\{[\s\S]*?\}\);/;
    const newAggMatch = loadMatch[0].match(newAggregateRegex);
    if (newAggMatch) {
      const closingBraceIndex = newAggMatch[0].lastIndexOf("});");
      const defaultVal = op.optional ? `payload.${op.name}` : `payload.${op.name} ?? ${defaultValue}`;
      const fieldLine = `      ${op.name}: ${defaultVal},`;
      const updated =
        newAggMatch[0].substring(0, closingBraceIndex) +
        `\n${fieldLine}\n    ` +
        newAggMatch[0].substring(closingBraceIndex);
      const updatedLoadMethod = loadMatch[0].replace(newAggMatch[0], updated);
      content = content.replace(loadMatch[0], updatedLoadMethod);
    }
  }

  return content;
}

async function renameFieldInAggregate(
  content: string,
  config: AttributeUpdateConfig,
  op: Extract<AttributeOperation, { type: "rename" }>
): Promise<string> {
  // Simple global replacement - rename all occurrences
  const regex = new RegExp(`\\b${op.oldName}\\b`, "g");
  return content.replace(regex, op.newName);
}

async function changeFieldTypeInAggregate(
  content: string,
  config: AttributeUpdateConfig,
  op: Extract<AttributeOperation, { type: "changeType" }>
): Promise<string> {
  // Update type annotations for private field, params type, etc.
  const patterns = [
    // Private field
    new RegExp(`(private ${op.name}\\??):\\s*[^;]+;`, "g"),
    // In params type
    new RegExp(`(\\s+${op.name}\\??):\\s*[^;]+;`, "g"),
  ];

  for (const pattern of patterns) {
    content = content.replace(pattern, `$1: ${op.newType};`);
  }

  return content;
}

async function deleteFieldFromAggregate(
  content: string,
  config: AttributeUpdateConfig,
  op: Extract<AttributeOperation, { type: "delete" }>
): Promise<string> {
  // 1. Remove from params type
  const paramsTypeRegex = new RegExp(
    `type ${config.aggregateName}AggregateParams = \\{[\\s\\S]*?\\n\\};`,
    "m"
  );
  const paramsMatch = content.match(paramsTypeRegex);
  if (paramsMatch) {
    const fieldRegex = new RegExp(`\\s+${op.name}\\??:\\s*[^;]+;\\n?`, "g");
    const updated = paramsMatch[0].replace(fieldRegex, "");
    content = content.replace(paramsMatch[0], updated);
  }

  // 2. Remove private field
  const privateFieldRegex = new RegExp(`\\s+private ${op.name}\\??:\\s*[^;]+;\\n?`, "g");
  content = content.replace(privateFieldRegex, "");

  // 3. Remove from constructor destructuring
  const constructorParamsRegex = new RegExp(
    `constructor\\(\\{[\\s\\S]*?\\}: ${config.aggregateName}AggregateParams\\)`,
    "m"
  );
  const constructorMatch = content.match(constructorParamsRegex);
  if (constructorMatch) {
    const fieldRegex = new RegExp(`\\s*${op.name},?\\n?`, "g");
    const updated = constructorMatch[0].replace(fieldRegex, "");
    content = content.replace(constructorMatch[0], updated);
  }

  // 4. Remove from constructor assignment
  const assignmentRegex = new RegExp(`\\s+this\\.${op.name} = ${op.name};\\n?`, "g");
  content = content.replace(assignmentRegex, "");

  // 5. Remove from Create params type
  const createParamsRegex = new RegExp(
    `type Create${config.aggregateName}AggregateParams = \\{[\\s\\S]*?\\n\\};`,
    "m"
  );
  const createParamsMatch = content.match(createParamsRegex);
  if (createParamsMatch) {
    const fieldRegex = new RegExp(`\\s+${op.name}\\??:\\s*[^;]+;\\n?`, "g");
    const updated = createParamsMatch[0].replace(fieldRegex, "");
    content = content.replace(createParamsMatch[0], updated);
  }

  // 6. Remove from create() method destructuring
  const createMethodRegex = /static create\(\{[\s\S]*?\}: Create\w+AggregateParams\)/m;
  const createMethodMatch = content.match(createMethodRegex);
  if (createMethodMatch) {
    const fieldRegex = new RegExp(`\\s*${op.name},?\\n?`, "g");
    const updated = createMethodMatch[0].replace(fieldRegex, "");
    content = content.replace(createMethodMatch[0], updated);
  }

  // 7. Remove from new aggregate instantiation in create()
  const newAggregateRegex = new RegExp(
    `return new ${config.aggregateName}Aggregate\\(\\{[\\s\\S]*?\\}\\);`,
    "m"
  );
  const newAggregateMatch = content.match(newAggregateRegex);
  if (newAggregateMatch) {
    const fieldRegex = new RegExp(`\\s*${op.name}[^,\\n]*,?\\n?`, "g");
    const updated = newAggregateMatch[0].replace(fieldRegex, "");
    content = content.replace(newAggregateMatch[0], updated);
  }

  // 8. Remove from toState()
  const toStateRegex = /private toState\(\): \w+State \{[\s\S]*?return \{[\s\S]*?\};[\s\S]*?\}/m;
  const toStateMatch = content.match(toStateRegex);
  if (toStateMatch) {
    const fieldRegex = new RegExp(`\\s*${op.name}:\\s*this\\.${op.name},?\\n?`, "g");
    const updated = toStateMatch[0].replace(fieldRegex, "");
    content = content.replace(toStateMatch[0], updated);
  }

  // 9. Remove from toSnapshot()
  const toSnapshotRegex = /toSnapshot\(\) \{[\s\S]*?return \{[\s\S]*?\};[\s\S]*?\}/m;
  const toSnapshotMatch = content.match(toSnapshotRegex);
  if (toSnapshotMatch) {
    const fieldRegex = new RegExp(`\\s*${op.name}:\\s*this\\.${op.name},?\\n?`, "g");
    const updated = toSnapshotMatch[0].replace(fieldRegex, "");
    content = content.replace(toSnapshotMatch[0], updated);
  }

  // 10. Remove from loadFromSnapshot()
  const loadFromSnapshotRegex = /static loadFromSnapshot[\s\S]*?return new \w+Aggregate\(\{[\s\S]*?\}\);[\s\S]*?\}/m;
  const loadMatch = content.match(loadFromSnapshotRegex);
  if (loadMatch) {
    const fieldRegex = new RegExp(`\\s*${op.name}:\\s*[^,\\n]+,?\\n?`, "g");
    const updated = loadMatch[0].replace(fieldRegex, "");
    content = content.replace(loadMatch[0], updated);
  }

  return content;
}
