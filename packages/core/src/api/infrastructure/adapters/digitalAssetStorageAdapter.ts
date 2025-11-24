export interface DigitalAssetUploadResult {
  readonly assetId: string
  readonly url: string
  readonly filename: string
  readonly size: number
}

export interface DigitalAssetStorageAdapter {
  uploadAsset(
    file: ArrayBuffer,
    assetId: string,
    filename: string,
    mimeType: string
  ): Promise<DigitalAssetUploadResult>

  deleteAsset(assetId: string, filename: string): Promise<void>

  getAssetUrl(assetId: string, filename: string): Promise<string>
}
