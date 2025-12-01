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

  save(state: AllVariantState & { id: string; correlationId: string; version: number }) {
    const statement = this.db.query(
      `INSERT OR REPLACE INTO variantReadModel (
        aggregateId, productId, sku, price, inventory, options,
        status, correlationId, version, createdAt, updatedAt,
        publishedAt, images, digitalAsset,
        fulfillmentProviderId, supplierCost, supplierSku,
        maxDownloads, accessDurationDays
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )

    this.batch.addCommand({
      statement,
      params: [
        state.id,
        state.productId,
        state.sku,
        state.price,
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
