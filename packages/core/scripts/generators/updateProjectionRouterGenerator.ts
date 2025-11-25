import type { UpdateMethodConfig } from "../utils/updatePrompts";
import { generateEventName } from "../utils/updateTemplates";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CORE_ROOT = join(__dirname, "../..");
const SRC_ROOT = join(CORE_ROOT, "src", "api");

export async function updateProjectionRouter(config: UpdateMethodConfig): Promise<void> {
  console.log("\n🔀 Updating projection router...");

  const routerPath = join(SRC_ROOT, "infrastructure", "routers", "projectionRouter.ts");
  const file = Bun.file(routerPath);
  let content = await file.text();

  const { aggregateName, aggregateCamelName, methodName } = config;
  const snakeCaseEventName = generateEventName(aggregateName, methodName);

  // Check if event is already registered
  if (content.includes(`case "${snakeCaseEventName}":`)) {
    console.log(`  ⚠️  Event ${snakeCaseEventName} already registered in projection router, skipping`);
    return;
  }

  // Find existing events for this aggregate to determine where to add the new case
  const eventPattern = new RegExp(`case "${aggregateCamelName}\\.[^"]+":`, "g");
  const matches = [...content.matchAll(eventPattern)];

  if (matches.length === 0) {
    console.log(`  ⚠️  No existing events found for ${aggregateCamelName}, please add manually`);
    return;
  }

  // Find the largest case block for this aggregate (the one with the most consecutive cases)
  const caseBlocks = findCaseBlocks(content, aggregateCamelName);

  if (caseBlocks.length === 0) {
    console.log(`  ⚠️  Could not find case block for ${aggregateCamelName}, please add manually`);
    return;
  }

  // Use the first (or largest) case block
  const targetBlock = caseBlocks[0];

  if (targetBlock === undefined) {
    throw new Error("Target case block is undefined");
  }

  // Insert the new case after the last case in the block
  const newCase = `            case "${snakeCaseEventName}":\n`;
  const insertIndex = targetBlock.lastCaseEnd;

  content = content.slice(0, insertIndex) + newCase + content.slice(insertIndex);

  await Bun.write(routerPath, content);
  console.log(`  ✅ Added ${snakeCaseEventName} to projection router`);
}

interface CaseBlock {
  lastCaseEnd: number;
  caseCount: number;
}

function findCaseBlocks(content: string, aggregateCamelName: string): CaseBlock[] {
  const blocks: CaseBlock[] = [];

  // Find all case statements for this aggregate
  const caseRegex = new RegExp(`([ \\t]+)case "${aggregateCamelName}\\.[^"]+":`, "g");
  const matches = [...content.matchAll(caseRegex)];

  if (matches.length === 0) {
    return blocks;
  }

  // Group consecutive cases into blocks
  let currentBlock: { start: number; end: number; cases: number } | null = null;

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    if (match === undefined) {
      throw new Error("Match index is undefined");
    }
    const matchIndex = match.index;
    const matchEnd = matchIndex + match[0].length;

    // Find the newline after the case statement (we want to insert after the newline)
    const nextNewlineIndex = content.indexOf('\n', matchEnd);
    const insertionPoint = nextNewlineIndex !== -1 ? nextNewlineIndex + 1 : matchEnd;

    // Check if this case is part of the current block
    if (currentBlock === null) {
      // Start a new block
      currentBlock = { start: matchIndex, end: insertionPoint, cases: 1 };
    } else {
      // Check if this case is close to the previous one (part of same switch case block)
      const distanceFromPrevious = matchIndex - currentBlock.end;

      // If cases are within ~100 chars of each other, they're likely in the same block
      if (distanceFromPrevious < 100) {
        currentBlock.end = insertionPoint;
        currentBlock.cases++;
      } else {
        // This is a new block, save the previous one
        blocks.push({
          lastCaseEnd: currentBlock.end,
          caseCount: currentBlock.cases,
        });
        currentBlock = { start: matchIndex, end: insertionPoint, cases: 1 };
      }
    }
  }

  // Don't forget the last block
  if (currentBlock !== null) {
    blocks.push({
      lastCaseEnd: currentBlock.end,
      caseCount: currentBlock.cases,
    });
  }

  // Sort by case count (descending) to get the largest block first
  blocks.sort((a, b) => b.caseCount - a.caseCount);

  return blocks;
}
