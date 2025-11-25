import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { CreateVariantCommand } from "./commands";
import { VariantAggregate } from "../../../../domain/variant/aggregate";
import { SkuAggregate } from "../../../../domain/sku/skuAggregate";
import { ProductAggregate } from "../../../../domain/product/aggregate";
import { randomUUIDv7 } from "bun";
import type { Service } from "../../../service";

export class CreateVariantService implements Service<CreateVariantCommand> {

  constructor(
    private unitOfWork: UnitOfWork,

  ) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: CreateVariantCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;

      // Load product aggregate to get variantOptions
      const productSnapshot = snapshotRepository.getSnapshot(command.productId);
      if (!productSnapshot) {
        throw new Error(`Product with id ${command.productId} not found`);
      }
      const productAggregate = ProductAggregate.loadFromSnapshot(productSnapshot);
      const productSnapshotData = productAggregate.toSnapshot();

      // Validate variant options match product's variantOptions
      this.validateVariantOptions(command.options, productSnapshotData.variantOptions);

      // Load or create SKU aggregate if SKU is provided
      let skuAggregate: SkuAggregate | null = null;
      if (command.sku && command.sku.trim() !== "") {
        const skuSnapshot = snapshotRepository.getSnapshot(command.sku);
        if (!skuSnapshot) {
          skuAggregate = SkuAggregate.create({
            sku: command.sku,
            correlationId: command.correlationId,
          });
        } else {
          skuAggregate = SkuAggregate.loadFromSnapshot(skuSnapshot);
        }

        // Check if SKU is available
        if (!skuAggregate.isSkuAvailable()) {
          throw new Error(`SKU "${command.sku}" is already in use`);
        }
      }

      // Create variant aggregate
      const variantAggregate = VariantAggregate.create({
        id: command.id,
        correlationId: command.correlationId,
        userId: command.userId,
        productId: command.productId,
        sku: command.sku,
        price: command.price,
        inventory: command.inventory,
        options: command.options,
      });

      // Reserve SKU in registry if applicable
      if (skuAggregate) {
        skuAggregate.reserveSku(command.id, command.userId);
      }

      // Handle variant events and projections
      for (const event of variantAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Handle SKU aggregate events and projections
      if (skuAggregate) {
        for (const event of skuAggregate.uncommittedEvents) {
          eventRepository.addEvent(event);
        }
      }

      // Save variant snapshot
      snapshotRepository.saveSnapshot({
        aggregate_id: variantAggregate.id,
        correlation_id: command.correlationId,
        version: variantAggregate.version,
        payload: variantAggregate.toSnapshot(),
      });

      // Save SKU aggregate snapshot
      if (skuAggregate) {
        snapshotRepository.saveSnapshot({
          aggregate_id: skuAggregate.id,
          correlation_id: command.correlationId,
          version: skuAggregate.version,
          payload: skuAggregate.toSnapshot(),
        });
      }

      // Add all events to outbox
      for (const event of variantAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
      if (skuAggregate) {
        for (const event of skuAggregate.uncommittedEvents) {
          outboxRepository.addOutboxEvent(event, {
            id: randomUUIDv7(),
          });
        }
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
