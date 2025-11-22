import type { AttributeUpdateConfig, AttributeOperation } from "../utils/attributePrompts";
import { getDefaultValueForType } from "../utils/attributeTemplates";
import { Glob } from "bun";

export async function updateTestLayer(config: AttributeUpdateConfig): Promise<void> {
  console.log("\n🧪 Updating test layer...");

  const testFiles = await findTestFiles(config.aggregateCamelName);

  if (testFiles.length === 0) {
    console.log(`  ⚠️  No test files found for ${config.aggregateName}, skipping`);
    return;
  }

  for (const testFile of testFiles) {
    await updateTestFile(testFile, config);
  }
}

async function findTestFiles(aggregateCamelName: string): Promise<string[]> {
  const testsPath = "/Users/ryanwible/projects/core/tests";
  const pattern = `**/*${aggregateCamelName}*.test.ts`;

  const glob = new Glob(pattern);
  const files: string[] = [];

  for await (const file of glob.scan({ cwd: testsPath })) {
    files.push(`${testsPath}/${file}`);
  }

  return files;
}

async function updateTestFile(filePath: string, config: AttributeUpdateConfig): Promise<void> {
  const file = Bun.file(filePath);
  let content = await file.text();

  // Find test object literals that match aggregate creation patterns
  // Look for patterns like: { id: ..., correlationId: ..., field1: ..., field2: ... }

  // Strategy: Find object literals within the file and update them
  // We'll look for objects that contain multiple fields from the aggregate

  let modified = false;

  // Process each operation
  for (const op of config.operations) {
    if (op.type === "add") {
      // Don't automatically add to existing tests - they might not need it
      // Just mark that we've processed this file
      modified = true;
    } else if (op.type === "rename") {
      // Rename field references in test
      const fieldRegex = new RegExp(`\\b${op.oldName}:`, "g");
      if (content.match(fieldRegex)) {
        content = content.replace(fieldRegex, `${op.newName}:`);
        modified = true;
      }

      // Also rename in expect statements
      const expectRegex = new RegExp(`\\.${op.oldName}\\b`, "g");
      if (content.match(expectRegex)) {
        content = content.replace(expectRegex, `.${op.newName}`);
        modified = true;
      }
    } else if (op.type === "changeType") {
      // Type changes might need test value updates, but we can't automatically determine this
      // Just mark as modified
      modified = true;
    } else if (op.type === "delete") {
      // Remove field from test objects
      const fieldRegex = new RegExp(`\\s*${op.name}:\\s*[^,\\n}]+,?\\n?`, "g");
      if (content.match(fieldRegex)) {
        content = content.replace(fieldRegex, "");
        modified = true;
      }

      // Remove from expect statements
      const expectRegex = new RegExp(`\\s*expect\\([^)]+\\.${op.name}\\)[^\\n]+\\n?`, "g");
      if (content.match(expectRegex)) {
        content = content.replace(expectRegex, "");
        modified = true;
      }
    }
  }

  if (modified) {
    // Add a comment at the top of the file
    if (!content.includes("// Auto-updated by generate-attribute-updates")) {
      const firstImport = content.indexOf("import");
      if (firstImport !== -1) {
        content =
          content.substring(0, firstImport) +
          "// Auto-updated by generate-attribute-updates\n" +
          content.substring(firstImport);
      } else {
        content = "// Auto-updated by generate-attribute-updates\n" + content;
      }
    }

    await Bun.write(filePath, content);
    console.log(`  ✅ Updated test: ${filePath.split("/").pop()}`);
  } else {
    console.log(`  ⚠️  No changes needed in: ${filePath.split("/").pop()}`);
  }
}
