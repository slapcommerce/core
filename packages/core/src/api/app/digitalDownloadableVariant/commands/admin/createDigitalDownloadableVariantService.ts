import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { CreateDigitalDownloadableVariantCommand } from "./commands";
import { DigitalDownloadableVariantAggregate } from "../../../../domain/digitalDownloadableVariant/aggregate";
import { SkuAggregate } from "../../../../domain/sku/skuAggregate";
import { DigitalDownloadableProductAggregate } from "../../../../domain/digitalDownloadableProduct/aggregate";
import { VariantPositionsWithinProductAggregate } from "../../../../domain/variantPositionsWithinProduct/aggregate";
import { randomUUIDv7 } from "bun";
import type { Service } from "../../../service";

export class CreateDigitalDownloadableVariantService implements Service<CreateDigitalDownloadableVariantCommand> {

  constructor(private unitOfWork: UnitOfWork) {}

  async execute(command: CreateDigitalDownloadableVariantCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;

      // Load product aggregate to get variantOptions
      const productSnapshot = snapshotRepository.getSnapshot(command.productId);
      if (!productSnapshot) {
        throw new Error(`Digital downloadable product with id ${command.productId} not found`);
      }
      const productAggregate = DigitalDownloadableProductAggregate.loadFromSnapshot(productSnapshot);
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
      const variantAggregate = DigitalDownloadableVariantAggregate.create({
        id: command.id,
        correlationId: command.correlationId,
        userId: command.userId,
        productId: command.productId,
        sku: command.sku,
        price: command.price,
        options: command.options,
        maxDownloads: command.maxDownloads,
        accessDurationDays: command.accessDurationDays,
      });

      // Reserve SKU in registry if applicable
      if (skuAggregate) {
        skuAggregate.reserveSku(command.id, command.userId);
      }

      // Load variant positions aggregate and add this variant
      const variantPositionsAggregateId = productAggregate.variantPositionsAggregateId;
      const variantPositionsSnapshot = snapshotRepository.getSnapshot(variantPositionsAggregateId);
      if (!variantPositionsSnapshot) {
        throw new Error(`Variant positions aggregate ${variantPositionsAggregateId} not found for product ${command.productId}`);
      }
      const variantPositionsAggregate = VariantPositionsWithinProductAggregate.loadFromSnapshot(variantPositionsSnapshot);
      variantPositionsAggregate.addVariant(command.id, command.userId);

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

      // Handle variant positions aggregate events
      for (const event of variantPositionsAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Save variant snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: variantAggregate.id,
        correlationId: command.correlationId,
        version: variantAggregate.version,
        payload: variantAggregate.toSnapshot(),
      });

      // Save SKU aggregate snapshot
      if (skuAggregate) {
        snapshotRepository.saveSnapshot({
          aggregateId: skuAggregate.id,
          correlationId: command.correlationId,
          version: skuAggregate.version,
          payload: skuAggregate.toSnapshot(),
        });
      }

      // Save variant positions aggregate snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: variantPositionsAggregateId,
        correlationId: command.correlationId,
        version: variantPositionsAggregate.version,
        payload: variantPositionsAggregate.toSnapshot(),
      });

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
      for (const event of variantPositionsAggregate.uncommittedEvents) {
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
