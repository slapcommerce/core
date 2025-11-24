import type { ImageUploadResult } from "../../infrastructure/adapters/imageStorageAdapter";

/**
 * Represents a single image with its optimized formats and metadata
 */
export type ImageItem = {
  imageId: string; // Unique image ID from ImageUploadResult
  urls: ImageUploadResult["urls"];
  uploadedAt: Date;
  altText: string; // Alt text for accessibility and SEO
};

/**
 * JSON-serializable representation of ImageItem
 */
type ImageItemJSON = {
  imageId: string;
  urls: ImageUploadResult["urls"];
  uploadedAt: string; // ISO string
  altText: string;
};

/**
 * Value object for managing collections of images with ordering and metadata
 *
 * Characteristics:
 * - Immutable: All operations return new instances
 * - First image (index 0) is considered the primary image
 * - Images have unique IDs for stable references
 * - Each image has alt text for accessibility
 *
 * Usage:
 * ```typescript
 * let images = ImageCollection.empty();
 * images = images.addImage(uploadResult, "Product hero shot");
 * images = images.addImage(uploadResult2, "Product detail view");
 * const primary = images.getPrimaryImage();
 * ```
 */
export class ImageCollection {
  private readonly images: ReadonlyArray<ImageItem>;

  static readonly MAX_RECOMMENDED_IMAGES = 10; // Soft limit - show warning after this
  static readonly ABSOLUTE_MAX_IMAGES = 100; // Hard limit - cannot exceed

  private constructor(images: ImageItem[]) {
    this.images = Object.freeze([...images]);
  }

  /**
   * Create an empty image collection
   */
  static empty(): ImageCollection {
    return new ImageCollection([]);
  }

  /**
   * Create from an array of image items
   * @throws Error if exceeds absolute maximum
   */
  static fromArray(images: ImageItem[]): ImageCollection {
    if (images.length > ImageCollection.ABSOLUTE_MAX_IMAGES) {
      throw new Error(
        `Cannot exceed ${ImageCollection.ABSOLUTE_MAX_IMAGES} images`
      );
    }
    return new ImageCollection(images);
  }

  /**
   * Create from JSON (for deserialization from database/snapshots)
   * @param json Array of ImageItemJSON objects or null/undefined
   * @returns ImageCollection instance (empty if json is null/undefined/not an array)
   */
  static fromJSON(json: any): ImageCollection {
    if (!json || !Array.isArray(json)) {
      return ImageCollection.empty();
    }

    try {
      const images = json.map((item) => ({
        imageId: item.imageId,
        urls: item.urls,
        uploadedAt: new Date(item.uploadedAt),
        altText: item.altText ?? "", // Backwards compatible with images without altText
      }));
      return new ImageCollection(images);
    } catch (error) {
      console.error("Failed to deserialize ImageCollection:", error);
      return ImageCollection.empty();
    }
  }

  /**
   * Add a new image to the end of the collection
   * @param uploadResult The result from ImageUploadHelper
   * @param altText Alt text for the image (required for accessibility)
   * @returns New ImageCollection with the added image
   * @throws Error if at absolute maximum capacity
   */
  addImage(uploadResult: ImageUploadResult, altText: string): ImageCollection {
    if (this.images.length >= ImageCollection.ABSOLUTE_MAX_IMAGES) {
      throw new Error(
        `Cannot exceed ${ImageCollection.ABSOLUTE_MAX_IMAGES} images`
      );
    }

    const newImage: ImageItem = {
      imageId: uploadResult.imageId,
      urls: uploadResult.urls,
      uploadedAt: new Date(),
      altText: altText || "", // Ensure altText is never undefined
    };

    return new ImageCollection([...this.images, newImage]);
  }

  /**
   * Remove an image by its ID
   * @param imageId The ID of the image to remove
   * @returns New ImageCollection without the specified image
   * @throws Error if image with specified ID not found
   */
  removeImage(imageId: string): ImageCollection {
    const filtered = this.images.filter((img) => img.imageId !== imageId);

    if (filtered.length === this.images.length) {
      throw new Error(`Image with id ${imageId} not found`);
    }

    return new ImageCollection(filtered);
  }

  /**
   * Reorder images by providing new array of IDs in desired order
   * All existing image IDs must be present exactly once
   * @param orderedIds Array of image IDs in the new desired order
   * @returns New ImageCollection with images in the specified order
   * @throws Error if orderedIds doesn't contain all current image IDs exactly once
   */
  reorder(orderedIds: string[]): ImageCollection {
    if (orderedIds.length !== this.images.length) {
      throw new Error(
        `All image IDs must be present in reorder operation. Expected ${this.images.length}, got ${orderedIds.length}`
      );
    }

    const idSet = new Set(orderedIds);
    if (idSet.size !== orderedIds.length) {
      throw new Error("Duplicate image IDs in reorder operation");
    }

    const imageMap = new Map(this.images.map((img) => [img.imageId, img]));
    const reordered: ImageItem[] = [];

    for (const id of orderedIds) {
      const image = imageMap.get(id);
      if (!image) {
        throw new Error(`Image with id ${id} not found in collection`);
      }
      reordered.push(image);
    }

    return new ImageCollection(reordered);
  }

  /**
   * Update the alt text for a specific image
   * @param imageId The ID of the image to update
   * @param altText The new alt text
   * @returns New ImageCollection with updated alt text
   * @throws Error if image with specified ID not found
   */
  updateAltText(imageId: string, altText: string): ImageCollection {
    const imageExists = this.images.some((img) => img.imageId === imageId);

    if (!imageExists) {
      throw new Error(`Image with id ${imageId} not found`);
    }

    const updated = this.images.map((img) =>
      img.imageId === imageId ? { ...img, altText } : img
    );

    return new ImageCollection(updated);
  }

  /**
   * Replace all images with a new set (used for bulk updates)
   * @param uploadResults Array of ImageUploadResult with corresponding alt texts
   * @param altTexts Array of alt texts (must match uploadResults length)
   * @returns New ImageCollection with the specified images
   * @throws Error if exceeds absolute maximum or altTexts length doesn't match
   */
  replaceAll(
    uploadResults: ImageUploadResult[],
    altTexts: string[]
  ): ImageCollection {
    if (uploadResults.length !== altTexts.length) {
      throw new Error("Number of alt texts must match number of images");
    }

    if (uploadResults.length > ImageCollection.ABSOLUTE_MAX_IMAGES) {
      throw new Error(
        `Cannot exceed ${ImageCollection.ABSOLUTE_MAX_IMAGES} images`
      );
    }

    const images = uploadResults.map((result, index) => ({
      imageId: result.imageId,
      urls: result.urls,
      uploadedAt: new Date(),
      altText: altTexts[index] ?? "",
    }));

    return new ImageCollection(images);
  }

  /**
   * Get the primary image (first in collection)
   * @returns The first ImageItem or null if collection is empty
   */
  getPrimaryImage(): ImageItem | null {
    return this.images[0] ?? null;
  }

  /**
   * Get an image by its ID
   * @param imageId The ID to search for
   * @returns The ImageItem or null if not found
   */
  getImage(imageId: string): ImageItem | null {
    return this.images.find((img) => img.imageId === imageId) ?? null;
  }

  /**
   * Get all images as a readonly array
   * @returns Readonly array of all ImageItems
   */
  toArray(): ReadonlyArray<ImageItem> {
    return this.images;
  }

  /**
   * Get the number of images in the collection
   * @returns Count of images
   */
  count(): number {
    return this.images.length;
  }

  /**
   * Check if the collection is empty
   * @returns true if no images, false otherwise
   */
  isEmpty(): boolean {
    return this.images.length === 0;
  }

  /**
   * Check if the collection is approaching the recommended limit
   * Used to show warnings in the UI
   * @returns true if at or above recommended maximum
   */
  isApproachingLimit(): boolean {
    return this.images.length >= ImageCollection.MAX_RECOMMENDED_IMAGES;
  }

  /**
   * Check if the collection is at the absolute maximum
   * @returns true if at absolute maximum capacity
   */
  isAtMaximum(): boolean {
    return this.images.length >= ImageCollection.ABSOLUTE_MAX_IMAGES;
  }

  /**
   * Serialize to JSON for database storage
   * @returns Array of ImageItemJSON objects
   */
  toJSON(): ImageItemJSON[] {
    return this.images.map((img) => ({
      imageId: img.imageId,
      urls: img.urls,
      uploadedAt: img.uploadedAt.toISOString(),
      altText: img.altText,
    }));
  }

  /**
   * Check equality with another ImageCollection
   * Compares image IDs and order only (not URLs or alt text)
   * @param other The ImageCollection to compare with
   * @returns true if same images in same order
   */
  equals(other: ImageCollection): boolean {
    if (this.images.length !== other.images.length) {
      return false;
    }
    return this.images.every(
      (img, idx) => img.imageId === other.images[idx]!.imageId
    );
  }

  /**
   * Get a summary string for debugging
   * @returns Human-readable summary
   */
  toString(): string {
    return `ImageCollection(${this.images.length} images${this.isEmpty() ? "" : `, primary: ${this.getPrimaryImage()?.imageId}`})`;
  }
}
