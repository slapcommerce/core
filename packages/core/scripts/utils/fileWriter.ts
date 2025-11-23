import { mkdir, exists } from "node:fs/promises";
import { dirname } from "node:path";

export async function writeFile(filePath: string, content: string): Promise<void> {
  // Ensure directory exists
  const dir = dirname(filePath);
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }

  // Write file
  await Bun.write(filePath, content);
  console.log(`  ✅ Created: ${filePath}`);
}

export async function appendToFile(filePath: string, searchPattern: RegExp, insertion: string): Promise<void> {
  const file = Bun.file(filePath);
  const content = await file.text();

  // Find the location to insert
  const match = content.match(searchPattern);
  if (!match || match.index === undefined) {
    throw new Error(`Pattern not found in ${filePath}: ${searchPattern}`);
  }

  // Insert the new content
  const insertIndex = match.index;
  const newContent = content.slice(0, insertIndex) + insertion + "\n" + content.slice(insertIndex);

  await Bun.write(filePath, newContent);
  console.log(`  ✅ Updated: ${filePath}`);
}

export async function addImportStatement(filePath: string, importStatement: string): Promise<void> {
  const file = Bun.file(filePath);
  const content = await file.text();

  // Check if import already exists
  if (content.includes(importStatement)) {
    return;
  }

  // Find the last import statement
  const importRegex = /^import\s+.*from\s+["'].*["'];?\s*$/gm;
  const imports = content.match(importRegex);

  if (!imports) {
    // No imports, add at the beginning
    await Bun.write(filePath, importStatement + "\n\n" + content);
  } else {
    // Add after the last import
    const lastImport = imports[imports.length - 1];
    if (lastImport === undefined) {
      throw new Error("Last import is undefined");
    }
    const lastImportIndex = content.lastIndexOf(lastImport);
    const insertIndex = lastImportIndex + lastImport.length;

    const newContent =
      content.slice(0, insertIndex) + "\n" + importStatement + content.slice(insertIndex);

    await Bun.write(filePath, newContent);
  }
}

export async function addToUnionType(
  filePath: string,
  unionTypeName: string,
  newType: string
): Promise<void> {
  const file = Bun.file(filePath);
  let content = await file.text();

  // Find the union type definition
  const unionRegex = new RegExp(
    `export type ${unionTypeName}\\s*=([\\s\\S]*?)(?=\\nexport|\\ntype|\\ninterface|$)`,
    "m"
  );

  const match = content.match(unionRegex);
  if (!match) {
    throw new Error(`Union type "${unionTypeName}" not found in ${filePath}`);
  }

  const unionContent = match[1];
  if (unionContent === undefined) {
    throw new Error("Union type content is undefined");
  }

  // Check if already exists
  if (unionContent.includes(newType)) {
    return;
  }

  // Find the last pipe character
  const lastPipeIndex = unionContent.lastIndexOf("|");
  if (lastPipeIndex === -1) {
    // Single type, add pipe and new type
    const semicolonIndex = unionContent.indexOf(";");
    const insertIndex = semicolonIndex > -1 ? semicolonIndex : unionContent.length;
    const updatedUnion = unionContent.slice(0, insertIndex) + "\n  | " + newType + unionContent.slice(insertIndex);

    content = content.replace(unionRegex, `export type ${unionTypeName} =${updatedUnion}`);
  } else {
    // Multiple types, add after last pipe
    const semicolonIndex = unionContent.indexOf(";", lastPipeIndex);
    const insertIndex = semicolonIndex > -1 ? semicolonIndex : unionContent.length;
    const updatedUnion = unionContent.slice(0, insertIndex) + "\n  | " + newType + unionContent.slice(insertIndex);

    content = content.replace(unionRegex, `export type ${unionTypeName} =${updatedUnion}`);
  }

  await Bun.write(filePath, content);
  console.log(`  ✅ Added ${newType} to ${unionTypeName} in ${filePath}`);
}
