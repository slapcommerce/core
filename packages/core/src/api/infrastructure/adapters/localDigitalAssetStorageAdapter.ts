import type {
  DigitalAssetStorageAdapter,
  DigitalAssetUploadResult,
} from "./digitalAssetStorageAdapter"
import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { rm } from "node:fs/promises"

export class LocalDigitalAssetStorageAdapter
  implements DigitalAssetStorageAdapter
{
  private readonly storagePath: string

  constructor(storagePath: string = "./storage/digital-assets") {
    this.storagePath = storagePath
  }

  async uploadAsset(
    file: ArrayBuffer,
    assetId: string,
    filename: string,
    mimeType: string
  ): Promise<DigitalAssetUploadResult> {
    // Create directory for this asset
    const assetDir = join(this.storagePath, assetId)
    await mkdir(assetDir, { recursive: true })

    // Write file
    const filePath = join(assetDir, filename)
    await Bun.write(filePath, file)

    // Get file size
    const bunFile = Bun.file(filePath)
    const size = bunFile.size

    // Return result with relative URL
    const url = `/storage/digital-assets/${assetId}/${filename}`

    return {
      assetId,
      url,
      filename,
      size,
    }
  }

  async deleteAsset(assetId: string, filename: string): Promise<void> {
    const assetDir = join(this.storagePath, assetId)

    try {
      // Remove entire asset directory
      await rm(assetDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore errors if directory doesn't exist
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error
      }
    }
  }

  async getAssetUrl(assetId: string, filename: string): Promise<string> {
    return `/storage/digital-assets/${assetId}/${filename}`
  }
}
