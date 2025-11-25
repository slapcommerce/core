/**
 * Generated types for Ecommerce API SDK
 *
 * DO NOT EDIT MANUALLY - This file is auto-generated
 * Run: bun run sdk:generate
 *
 * Generated at: 2025-11-24T23:27:48.078Z
 */

// ==================== COMMAND TYPES ====================

export type AddCollectionImageCommand = {
  id: string;
  type: "addCollectionImage";
  userId: string;
  imageData: string;
  filename: string;
  contentType: string;
  altText: string;
  expectedVersion: number;
};

export type AddVariantImageCommand = {
  id: string;
  type: "addVariantImage";
  userId: string;
  imageData: string;
  filename: string;
  contentType: string;
  altText: string;
  expectedVersion: number;
};

export type ArchiveCollectionCommand = {
  id: string;
  type: "archiveCollection";
  userId: string;
  expectedVersion: number;
};

export type ArchiveProductCommand = {
  id: string;
  type: "archiveProduct";
  userId: string;
  expectedVersion: number;
};

export type ArchiveVariantCommand = {
  id: string;
  type: "archiveVariant";
  userId: string;
  expectedVersion: number;
};

export type AttachVariantDigitalAssetCommand = {
  id: string;
  type: "attachVariantDigitalAsset";
  userId: string;
  assetData: string;
  filename: string;
  mimeType: string;
  expectedVersion: number;
};

export type CancelScheduleCommand = {
  id: string;
  type: "cancelSchedule";
  userId: string;
  expectedVersion: number;
};

export type ChangeSlugCommand = {
  id: string;
  type: "changeSlug";
  userId: string;
  newSlug: string;
  expectedVersion: number;
};

export type CreateCollectionCommand = {
  id: string;
  type: "createCollection";
  correlationId: string;
  userId: string;
  name: string;
  description: string | null;
  slug: string;
};

export type CreateProductCommand = {
  id: string;
  type: "createProduct";
  correlationId: string;
  userId: string;
  title: string;
  shortDescription: string | undefined;
  slug: string;
  collectionIds: Array<string>;
  variantIds: Array<string> | undefined;
  richDescriptionUrl: string | undefined;
  productType: string | undefined;
  fulfillmentType: unknown | undefined;
  dropshipSafetyBuffer: number | undefined;
  vendor: string | undefined;
  variantOptions: Array<{
    name: string;
    values: Array<string>;
  }> | undefined;
  metaTitle: string | undefined;
  metaDescription: string | undefined;
  tags: Array<string> | undefined;
  taxable: boolean;
  taxId: string | undefined;
};

export type CreateScheduleCommand = {
  id: string;
  type: "createSchedule";
  correlationId: string;
  userId: string;
  targetAggregateId: string;
  targetAggregateType: string;
  commandType: string;
  commandData: unknown | null;
  scheduledFor: unknown;
  createdBy: string;
};

export type CreateVariantCommand = {
  id: string;
  type: "createVariant";
  correlationId: string;
  userId: string;
  productId: string;
  sku: string | undefined;
  price: number | undefined;
  inventory: number | undefined;
  options: unknown | undefined;
};

export type DetachVariantDigitalAssetCommand = {
  id: string;
  type: "detachVariantDigitalAsset";
  userId: string;
  expectedVersion: number;
};

export type PublishCollectionCommand = {
  id: string;
  type: "publishCollection";
  userId: string;
  expectedVersion: number;
};

export type PublishProductCommand = {
  id: string;
  type: "publishProduct";
  userId: string;
  expectedVersion: number;
};

export type PublishVariantCommand = {
  id: string;
  type: "publishVariant";
  userId: string;
  expectedVersion: number;
};

export type RemoveCollectionImageCommand = {
  id: string;
  type: "removeCollectionImage";
  userId: string;
  imageId: string;
  expectedVersion: number;
};

export type RemoveVariantImageCommand = {
  id: string;
  type: "removeVariantImage";
  userId: string;
  imageId: string;
  expectedVersion: number;
};

export type ReorderCollectionImagesCommand = {
  id: string;
  type: "reorderCollectionImages";
  userId: string;
  orderedImageIds: Array<string>;
  expectedVersion: number;
};

export type ReorderVariantImagesCommand = {
  id: string;
  type: "reorderVariantImages";
  userId: string;
  orderedImageIds: Array<string>;
  expectedVersion: number;
};

export type UnpublishCollectionCommand = {
  id: string;
  type: "unpublishCollection";
  userId: string;
  expectedVersion: number;
};

export type UnpublishProductCommand = {
  id: string;
  type: "unpublishProduct";
  userId: string;
  expectedVersion: number;
};

export type UpdateCollectionImageCommand = {
  id: string;
  type: "updateCollectionImage";
  userId: string;
  imageId: string;
  imageData: string;
  filename: string;
  contentType: string;
  altText: string;
  expectedVersion: number;
};

export type UpdateCollectionImageAltTextCommand = {
  id: string;
  type: "updateCollectionImageAltText";
  userId: string;
  imageId: string;
  altText: string;
  expectedVersion: number;
};

export type UpdateCollectionMetadataCommand = {
  id: string;
  type: "updateCollectionMetadata";
  userId: string;
  name: string;
  description: string | null;
  newSlug: string;
  expectedVersion: number;
};

export type UpdateCollectionSeoMetadataCommand = {
  id: string;
  type: "updateCollectionSeoMetadata";
  userId: string;
  metaTitle: string;
  metaDescription: string;
  expectedVersion: number;
};

export type UpdateProductClassificationCommand = {
  id: string;
  type: "updateProductClassification";
  userId: string;
  productType: string;
  vendor: string;
  expectedVersion: number;
};

export type UpdateProductCollectionsCommand = {
  id: string;
  type: "updateProductCollections";
  userId: string;
  collectionIds: Array<string>;
  expectedVersion: number;
};

export type UpdateProductDetailsCommand = {
  id: string;
  type: "updateProductDetails";
  userId: string;
  title: string;
  shortDescription: string;
  richDescriptionUrl: string;
  expectedVersion: number;
};

export type UpdateProductFulfillmentTypeCommand = {
  id: string;
  type: "updateProductFulfillmentType";
  userId: string;
  fulfillmentType: unknown;
  dropshipSafetyBuffer: number | undefined;
  expectedVersion: number;
};

export type UpdateProductMetadataCommand = {
  id: string;
  type: "updateProductMetadata";
  userId: string;
  metaTitle: string;
  metaDescription: string;
  expectedVersion: number;
};

export type UpdateProductOptionsCommand = {
  id: string;
  type: "updateProductOptions";
  userId: string;
  variantOptions: Array<{
    name: string;
    values: Array<string>;
  }>;
  expectedVersion: number;
};

export type UpdateProductTagsCommand = {
  id: string;
  type: "updateProductTags";
  userId: string;
  tags: Array<string>;
  expectedVersion: number;
};

export type UpdateProductTaxDetailsCommand = {
  id: string;
  type: "updateProductTaxDetails";
  userId: string;
  taxable: boolean;
  taxId: string;
  expectedVersion: number;
};

export type UpdateScheduleCommand = {
  id: string;
  type: "updateSchedule";
  userId: string;
  scheduledFor: unknown;
  commandData: unknown | null;
  expectedVersion: number;
};

export type UpdateVariantDetailsCommand = {
  id: string;
  type: "updateVariantDetails";
  userId: string;
  options: unknown;
  expectedVersion: number;
};

export type UpdateVariantImageAltTextCommand = {
  id: string;
  type: "updateVariantImageAltText";
  userId: string;
  imageId: string;
  altText: string;
  expectedVersion: number;
};

export type UpdateVariantInventoryCommand = {
  id: string;
  type: "updateVariantInventory";
  userId: string;
  inventory: number;
  expectedVersion: number;
};

export type UpdateVariantPriceCommand = {
  id: string;
  type: "updateVariantPrice";
  userId: string;
  price: number;
  expectedVersion: number;
};

export type UpdateVariantSkuCommand = {
  id: string;
  type: "updateVariantSku";
  userId: string;
  sku: string;
  expectedVersion: number;
};

// ==================== QUERY TYPES ====================

export type GetCollectionsQuery = {
  collectionId: string | undefined;
  status: unknown | undefined;
  limit: number | undefined;
  offset: number | undefined;
};

export type GetProductCollectionsQuery = {
  collectionId: string | undefined;
  aggregateId: string | undefined;
  status: unknown | undefined;
  limit: number | undefined;
  offset: number | undefined;
};

export type GetProductListQuery = {
  status: unknown | undefined;
  vendor: string | undefined;
  productType: string | undefined;
  collectionId: string | undefined;
  limit: number | undefined;
  offset: number | undefined;
};

export type GetvariantssQuery = {
  productId: string | undefined;
  variantId: string | undefined;
  status: unknown | undefined;
  limit: number | undefined;
  offset: number | undefined;
};

export type GetSchedulesQuery = {
  scheduleId: string | undefined;
  status: unknown | undefined;
  targetAggregateId: string | undefined;
  targetAggregateType: string | undefined;
  commandType: string | undefined;
  limit: number | undefined;
  offset: number | undefined;
};

export type GetSlugRedirectsQuery = {
  oldSlug: string | undefined;
  newSlug: string | undefined;
  productId: string | undefined;
  entityId: string | undefined;
  entityType: unknown | undefined;
  limit: number | undefined;
  offset: number | undefined;
};

export type GetVariantsQuery = {
  variantId: string | undefined;
  productId: string | undefined;
  status: unknown | undefined;
  sku: string | undefined;
  limit: number | undefined;
  offset: number | undefined;
};

// ==================== SHARED TYPES ====================

export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string } };

export type CommandResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: { message: string } };
