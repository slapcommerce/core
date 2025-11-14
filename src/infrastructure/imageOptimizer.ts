import sharp from "sharp";
import type { ImageFormats, ImageSizeFormats } from "./adapters/imageStorageAdapter";

export class ImageOptimizer {
  async optimizeImage(
    buffer: ArrayBuffer,
    contentType: string
  ): Promise<ImageFormats> {
    const inputBuffer = Buffer.from(buffer);
    const sharpInstance = sharp(inputBuffer);

    // Generate all sizes in parallel
    const [thumbnail, small, medium, large, original] = await Promise.all([
      this.generateSizeFormats(sharpInstance.clone(), contentType, 200, 200),
      this.generateSizeFormats(sharpInstance.clone(), contentType, 400, 400),
      this.generateSizeFormats(sharpInstance.clone(), contentType, 800, 800),
      this.generateSizeFormats(sharpInstance.clone(), contentType, 1200, 1200),
      this.generateSizeFormats(sharpInstance.clone(), contentType, null, null), // Original size
    ]);

    return {
      thumbnail,
      small,
      medium,
      large,
      original,
    };
  }

  private async generateSizeFormats(
    sharpInstance: sharp.Sharp,
    contentType: string,
    width: number | null,
    height: number | null
  ): Promise<ImageSizeFormats> {
    // Resize if dimensions are provided (not for original size)
    if (width !== null && height !== null) {
      sharpInstance = sharpInstance.resize(width, height, {
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    // Determine original format extension
    const ext = this.getExtensionFromContentType(contentType);

    // Generate all formats in parallel
    const [originalBuffer, webpBuffer, avifBuffer] = await Promise.all([
      // Original format - convert to the original format
      this.convertToOriginalFormat(sharpInstance.clone(), ext),
      // WebP format (quality: 85)
      sharpInstance.clone().webp({ quality: 85 }).toBuffer(),
      // AVIF format (quality: 75)
      sharpInstance.clone().avif({ quality: 75 }).toBuffer(),
    ]);

    return {
      original: new Uint8Array(originalBuffer).buffer,
      webp: new Uint8Array(webpBuffer).buffer,
      avif: new Uint8Array(avifBuffer).buffer,
    };
  }

  private async convertToOriginalFormat(
    sharpInstance: sharp.Sharp,
    ext: string
  ): Promise<Buffer> {
    // Convert to the original format based on extension
    switch (ext) {
      case "jpg":
      case "jpeg":
        return await sharpInstance.jpeg().toBuffer();
      case "png":
        return await sharpInstance.png().toBuffer();
      case "webp":
        return await sharpInstance.webp().toBuffer();
      case "avif":
        return await sharpInstance.avif().toBuffer();
      case "gif":
        return await sharpInstance.gif().toBuffer();
      default:
        return await sharpInstance.jpeg().toBuffer(); // Default to JPEG
    }
  }

  private getExtensionFromContentType(contentType: string): string {
    const mapping: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/avif": "avif",
      "image/gif": "gif",
    };

    return mapping[contentType.toLowerCase()] || "jpg";
  }
}

