import type { AggregateConfig } from "../utils/prompts";
import { writeFile } from "../utils/fileWriter";
import { toCamelCase, generateZodFields } from "../utils/templates";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CORE_ROOT = join(__dirname, "../..");
const SRC_ROOT = join(CORE_ROOT, "src");

export async function generateApplicationLayer(config: AggregateConfig): Promise<void> {
  const { name, accessLevel } = config;

  console.log("\n📦 Generating application layer...");

  // Generate commands.ts
  await generateCommandsFile(config);

  // Generate create service
  await generateCreateServiceFile(config);
}

async function generateCommandsFile(config: AggregateConfig): Promise<void> {
  const { name, fields } = config;
  const camelName = toCamelCase(name);

  const zodFields = generateZodFields(fields);

  const content = `import { z } from "zod";

export const Create${name}Command = z.object({
  id: z.uuidv7(),
  type: z.literal("create${name}"),
  correlationId: z.uuidv7(),
  userId: z.string(),
${zodFields}
});

export type Create${name}Command = z.infer<typeof Create${name}Command>;
`;

  const filePath = join(SRC_ROOT, "app", camelName, "commands.ts");
  await writeFile(filePath, content);
}

async function generateCreateServiceFile(config: AggregateConfig): Promise<void> {
  const { name, accessLevel } = config;
  const camelName = toCamelCase(name);

  const content = `import type { UnitOfWork } from "../../infrastructure/unitOfWork";
import type { Create${name}Command } from "./commands";
import { ${name}Aggregate } from "../../domain/${camelName}/aggregate";
import { randomUUIDv7 } from "bun";
import type { AccessLevel } from "../accessLevel";
import type { Service } from "../service";

export class Create${name}Service implements Service<Create${name}Command> {
  accessLevel: AccessLevel = "${accessLevel}";

  constructor(private unitOfWork: UnitOfWork) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: Create${name}Command) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;

      // Create aggregate
      const aggregate = ${name}Aggregate.create(command);

      // Save events
      for (const event of aggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Save snapshot
      snapshotRepository.saveSnapshot({
        aggregate_id: aggregate.id,
        correlation_id: command.correlationId,
        version: aggregate.version,
        payload: aggregate.toSnapshot(),
      });

      // Add events to outbox
      for (const event of aggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }
}
`;

  const filePath = join(SRC_ROOT, "app", camelName, `create${name}Service.ts`);
  await writeFile(filePath, content);
}
