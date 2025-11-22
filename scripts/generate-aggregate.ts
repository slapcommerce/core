#!/usr/bin/env bun

import { promptForAggregateConfig } from "./utils/prompts";
import { generateDomainLayer } from "./generators/domainGenerator";
import { generateApplicationLayer } from "./generators/applicationGenerator";
import { updateInfrastructureLayer } from "./generators/infrastructureGenerator";
import { generateProjectionLayer } from "./generators/projectionGenerator";
import { generateViewLayer } from "./generators/viewGenerator";
import { generateTests } from "./generators/testGenerator";
import { toCamelCase } from "./utils/templates";

async function main() {
  try {
    // Get configuration from user
    const config = await promptForAggregateConfig();

    console.log("\n🔨 Generating aggregate...\n");

    // Generate all layers
    await generateDomainLayer(config);
    await generateApplicationLayer(config);
    await updateInfrastructureLayer(config);
    await generateProjectionLayer(config);
    await generateViewLayer(config);
    await generateTests(config);

    const camelName = toCamelCase(config.name);

    console.log("\n✅ Aggregate generation complete!\n");
    console.log("📝 Next steps:");
    console.log(`  1. Review the generated files`);
    console.log(`  2. Run tests: bun test tests/domain/${camelName}/aggregate.test.ts`);
    console.log(`  3. Add any additional business methods to the aggregate`);
    console.log(`  4. Add additional commands and services as needed`);
    console.log(`  5. Consider adding update commands following the pattern in existing aggregates\n`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\n❌ Error: ${error.message}`);
    } else {
      console.error(`\n❌ Unknown error occurred`);
    }
    process.exit(1);
  }
}

main();
