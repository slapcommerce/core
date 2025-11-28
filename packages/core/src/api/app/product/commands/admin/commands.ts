import { z } from "zod";

export const CreateProductCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("createProduct"),
  correlationId: z.uuidv7(),
  userId: z.string(),
  name: z.string().min(1),
  description: z.string().optional().default(""),
  slug: z.string().min(1),
  collections: z.array(z.uuidv7()).min(1),  // Just collection IDs
  variantIds: z.array(z.uuidv7()).optional().default([]),
  richDescriptionUrl: z.string().optional().default(""),
  fulfillmentType: z
    .enum(["digital", "dropship"])
    .optional()
    .default("digital"),
  dropshipSafetyBuffer: z.number().int().nonnegative().optional(),
  vendor: z.string().optional().default(""),
  variantOptions: z.array(
    z.object({
      name: z.string(),
      values: z.array(z.string()),
    }),
  ).optional().default([]),
  metaTitle: z.string().optional().default(""),
  metaDescription: z.string().optional().default(""),
  tags: z.array(z.string()).optional().default([]),
  taxable: z.boolean(),
  taxId: z.string().optional().default(""),
});

export type CreateProductCommand = z.infer<typeof CreateProductCommand>;

export const ArchiveProductCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("archiveProduct"),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type ArchiveProductCommand = z.infer<typeof ArchiveProductCommand>;

export const PublishProductCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("publishProduct"),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type PublishProductCommand = z.infer<typeof PublishProductCommand>;

export const UnpublishProductCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("unpublishProduct"),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UnpublishProductCommand = z.infer<typeof UnpublishProductCommand>;

export const ChangeSlugCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("changeSlug"),
  userId: z.string(),
  newSlug: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(),
});

export type ChangeSlugCommand = z.infer<typeof ChangeSlugCommand>;

export const UpdateProductDetailsCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateProductDetails"),
  userId: z.string(),
  name: z.string().min(1),
  description: z.string(),
  richDescriptionUrl: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateProductDetailsCommand = z.infer<
  typeof UpdateProductDetailsCommand
>;

export const UpdateProductMetadataCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateProductMetadata"),
  userId: z.string(),
  metaTitle: z.string(),
  metaDescription: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateProductMetadataCommand = z.infer<
  typeof UpdateProductMetadataCommand
>;

export const UpdateProductClassificationCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateProductClassification"),
  userId: z.string(),
  vendor: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export const UpdateProductFulfillmentTypeCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateProductFulfillmentType"),
  userId: z.string(),
  fulfillmentType: z.enum(["digital", "dropship"]),
  dropshipSafetyBuffer: z.number().int().nonnegative().optional(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateProductFulfillmentTypeCommand = z.infer<
  typeof UpdateProductFulfillmentTypeCommand
>;

export type UpdateProductClassificationCommand = z.infer<
  typeof UpdateProductClassificationCommand
>;

export const UpdateProductTagsCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateProductTags"),
  userId: z.string(),
  tags: z.array(z.string()),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateProductTagsCommand = z.infer<typeof UpdateProductTagsCommand>;

export const UpdateProductCollectionsCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateProductCollections"),
  userId: z.string(),
  collections: z.array(z.uuidv7()).min(1),  // Just collection IDs
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateProductCollectionsCommand = z.infer<
  typeof UpdateProductCollectionsCommand
>;

export const ReorderProductsInCollectionCommand = z.object({
  type: z.literal("reorderProductsInCollection"),
  collectionId: z.uuidv7(),
  productPositions: z.array(
    z.object({
      productId: z.uuidv7(),
      position: z.number().int().nonnegative(),
    }),
  ),
  userId: z.string(),
});

export type ReorderProductsInCollectionCommand = z.infer<
  typeof ReorderProductsInCollectionCommand
>;

export const UpdateProductOptionsCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateProductOptions"),
  userId: z.string(),
  variantOptions: z.array(
    z.object({
      name: z.string(),
      values: z.array(z.string()),
    }),
  ),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateProductOptionsCommand = z.infer<
  typeof UpdateProductOptionsCommand
>;

export const UpdateProductTaxDetailsCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateProductTaxDetails"),
  userId: z.string(),
  taxable: z.boolean(),
  taxId: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateProductTaxDetailsCommand = z.infer<typeof UpdateProductTaxDetailsCommand>;
