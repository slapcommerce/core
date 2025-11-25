#!/usr/bin/env bun

import { promptForAttributeConfig } from "./utils/attributePrompts";
import {
  addAttribute,
  modifyAttribute,
  deleteAttribute,
} from "./generators/attributeModifier";

async function main() {
  try {
    const config = await promptForAttributeConfig();

    switch (config.operation) {
      case "add":
        await addAttribute(config);
        break;
      case "modify":
        await modifyAttribute(config);
        break;
      case "delete":
        await deleteAttribute(config);
        break;
    }

    console.log("\n📝 Next steps:");
    console.log("  1. Run `bun run tsc` to verify type safety");
    console.log("  2. Run `bun test` to verify tests pass");
    console.log("  3. Review the changes manually for correctness");
    console.log("  4. If you changed schema.ts, you may need to recreate the database\n");
  } catch (error) {
    if (error instanceof Error) {
      console.error("\n❌ Error:", error.message);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
    } else {
      console.error("\n❌ An unexpected error occurred");
    }
    process.exit(1);
  }
}

main();
