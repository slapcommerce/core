import type { Database } from "bun:sqlite"
import type { TransactionBatch } from "../../transactionBatch"
import type { DropshipVariantState } from "@/api/domain/dropshipVariant/events"
import type { DigitalDownloadableVariantState } from "@/api/domain/digitalDownloadableVariant/events"

type AllVariantState = DropshipVariantState | DigitalDownloadableVariantState


export class VariantsReadModelRepository {
  private db: Database
  private batch: TransactionBatch

  constructor(db: Database, batch: TransactionBatch) {
    this.db = db
    this.batch = batch
  }

  private calculateActivePrice(state: AllVariantState): number {
    if (state.saleType === null || state.saleValue === null) {
      return state.listPrice;
    }
    switch (state.saleType) {
      case "fixed":
        return state.saleValue;
      case "percent":
        return Math.round(state.listPrice * (1 - state.saleValue));
      case "amount":
        return Math.max(0, state.listPrice - state.saleValue);
    }
  }

  save(state: AllVariantState & { id: string; correlationId: string; version: number }) {
    const activePrice = this.calculateActivePrice(state);
    const statement = this.db.query(
      `INSERT OR REPLACE INTO variantReadModel (
        aggregateId, productId, sku, listPrice, saleType, saleValue, activePrice, inventory, options,
        status, correlationId, version, createdAt, updatedAt,
        publishedAt, images, digitalAsset,
        fulfillmentProviderId, supplierCost, supplierSku,
        maxDownloads, accessDurationDays
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )

    this.batch.addCommand({
      statement,
      params: [
        state.id,
        state.productId,
        state.sku,
        state.listPrice,
        state.saleType,
        state.saleValue,
        activePrice,
        state.inventory,
        JSON.stringify(state.options),
        state.status,
        state.correlationId,
        state.version,
        state.createdAt.toISOString(),
        state.updatedAt.toISOString(),
        state.publishedAt?.toISOString() ?? null,
        JSON.stringify(state.images),
        state.variantType === "digital_downloadable" && state.digitalAsset
          ? JSON.stringify(state.digitalAsset)
          : null,
        state.variantType === "dropship" ? state.fulfillmentProviderId : null,
        state.variantType === "dropship" ? state.supplierCost : null,
        state.variantType === "dropship" ? state.supplierSku : null,
        state.variantType === "digital_downloadable" ? state.maxDownloads : null,
        state.variantType === "digital_downloadable" ? state.accessDurationDays : null,
      ],
      type: 'insert'
    })
  }
}
