import type { UnitOfWork } from "../../infrastructure/unitOfWork";
import type { UpdateVariantDetailsCommand } from "./commands";
import type { ProjectionService } from "../../infrastructure/projectionService";
import { VariantAggregate } from "../../domain/variant/aggregate";
import { ProductAggregate } from "../../domain/product/aggregate";
import { randomUUIDv7 } from "bun";

export class UpdateVariantDetailsService {
  constructor(
    private unitOfWork: UnitOfWork,
    private projectionService: ProjectionService
  ) {
    this.unitOfWork = unitOfWork;
    this.projectionService = projectionService;
  }

  async execute(command: UpdateVariantDetailsCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;
      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(`Variant with id ${command.id} not found`);
      }
      if (snapshot.version !== command.expectedVersion) {
        throw new Error(`Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${snapshot.version}`);
      }
      const variantAggregate = VariantAggregate.loadFromSnapshot(snapshot);

      // Load product aggregate to validate variantOptions if options are being updated
      const productSnapshot = snapshotRepository.getSnapshot(variantAggregate.toSnapshot().productId);
      if (!productSnapshot) {
        throw new Error(`Product not found for variant`);
      }
      const productAggregate = ProductAggregate.loadFromSnapshot(productSnapshot);
      const productSnapshotData = productAggregate.toSnapshot();

      // Validate variant options match product's variantOptions
      this.validateVariantOptions(command.options, productSnapshotData.variantOptions);

      variantAggregate.updateDetails(command.title, command.options, command.barcode, command.weight, command.userId);

      for (const event of variantAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
        await this.projectionService.handleEvent(event, repositories);
      }

      snapshotRepository.saveSnapshot({
        aggregate_id: variantAggregate.id,
        correlation_id: snapshot.correlation_id,
        version: variantAggregate.version,
        payload: variantAggregate.toSnapshot(),
      });

      for (const event of variantAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }

  private validateVariantOptions(
    variantOptions: Record<string, string>,
    productVariantOptions: { name: string; values: string[] }[]
  ): void {
    // Check that all option names in variant match product's variantOptions
    const productOptionNames = new Set(productVariantOptions.map(opt => opt.name));
    for (const optionName of Object.keys(variantOptions)) {
      if (!productOptionNames.has(optionName)) {
        throw new Error(`Option "${optionName}" is not valid for this product`);
      }
    }

    // Check that all product variantOptions have a value in variant
    for (const productOption of productVariantOptions) {
      if (!(productOption.name in variantOptions)) {
        throw new Error(`Missing required option "${productOption.name}"`);
      }
    }

    // Check that each option value is valid for that option
    for (const productOption of productVariantOptions) {
      const variantValue = variantOptions[productOption.name];
      if (!variantValue) {
        throw new Error(`Missing required option "${productOption.name}"`);
      }
      if (!productOption.values.includes(variantValue)) {
        throw new Error(`Value "${variantValue}" is not valid for option "${productOption.name}". Valid values: ${productOption.values.join(", ")}`);
      }
    }
  }
}

