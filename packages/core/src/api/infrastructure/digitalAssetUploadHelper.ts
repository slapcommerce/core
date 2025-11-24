import type {
  DigitalAssetStorageAdapter,
  DigitalAssetUploadResult,
} from "./adapters/digitalAssetStorageAdapter"
import { randomUUIDv7 } from "bun"

export class DigitalAssetUploadHelper {
  constructor(private storageAdapter: DigitalAssetStorageAdapter) {}

  async uploadAsset(
    buffer: ArrayBuffer,
    filename: string,
    mimeType: string
  ): Promise<DigitalAssetUploadResult> {
    // Generate unique asset ID
    const assetId = randomUUIDv7()

    // Upload asset using the adapter (no validation or processing)
    const result = await this.storageAdapter.uploadAsset(
      buffer,
      assetId,
      filename,
      mimeType
    )

    return result
  }
}
