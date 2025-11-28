import { z } from "zod";

export const CreateVariantCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("createVariant"),
  correlationId: z.uuidv7(),
  userId: z.string(),
  productId: z.uuidv7(),
  sku: z.string().optional().default(""),
  price: z.number().nonnegative().optional().default(0),
  inventory: z.number().int().nonnegative().optional().default(0),
  options: z.record(z.string(), z.string()).optional().default({}),
});

export type CreateVariantCommand = z.infer<typeof CreateVariantCommand>;

export const UpdateVariantDetailsCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateVariantDetails"),
  userId: z.string(),
  options: z.record(z.string(), z.string()),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateVariantDetailsCommand = z.infer<typeof UpdateVariantDetailsCommand>;

export const UpdateVariantPriceCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateVariantPrice"),
  userId: z.string(),
  price: z.number().nonnegative(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateVariantPriceCommand = z.infer<typeof UpdateVariantPriceCommand>;

export const UpdateVariantInventoryCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateVariantInventory"),
  userId: z.string(),
  inventory: z.number().int().min(-1),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateVariantInventoryCommand = z.infer<typeof UpdateVariantInventoryCommand>;

export const UpdateVariantSkuCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateVariantSku"),
  userId: z.string(),
  sku: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateVariantSkuCommand = z.infer<typeof UpdateVariantSkuCommand>;

export const ArchiveVariantCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("archiveVariant"),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type ArchiveVariantCommand = z.infer<typeof ArchiveVariantCommand>;

export const PublishVariantCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("publishVariant"),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type PublishVariantCommand = z.infer<typeof PublishVariantCommand>;

export const AddVariantImageCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("addVariantImage"),
  userId: z.string(),
  imageData: z.string().refine(
    (val) => /^[A-Za-z0-9+/]*={0,2}$/.test(val.replace(/^data:image\/\w+;base64,/, "")),
    { message: "imageData must be a valid base64 string" }
  ),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  altText: z.string().default(""), // Alt text for accessibility
  expectedVersion: z.number().int().nonnegative(),
});

export type AddVariantImageCommand = z.infer<typeof AddVariantImageCommand>;

export const RemoveVariantImageCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("removeVariantImage"),
  userId: z.string(),
  imageId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type RemoveVariantImageCommand = z.infer<typeof RemoveVariantImageCommand>;

export const ReorderVariantImagesCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("reorderVariantImages"),
  userId: z.string(),
  orderedImageIds: z.array(z.string()),
  expectedVersion: z.number().int().nonnegative(),
});

export type ReorderVariantImagesCommand = z.infer<typeof ReorderVariantImagesCommand>;

export const UpdateVariantImageAltTextCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateVariantImageAltText"),
  userId: z.string(),
  imageId: z.string(),
  altText: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateVariantImageAltTextCommand = z.infer<typeof UpdateVariantImageAltTextCommand>;

export const AttachVariantDigitalAssetCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("attachVariantDigitalAsset"),
  userId: z.string(),
  assetData: z.string().refine(
    (val) => {
      // Allow any base64 data (not just images)
      const base64Part = val.replace(/^data:[^;]+;base64,/, "")
      return /^[A-Za-z0-9+/]*={0,2}$/.test(base64Part)
    },
    { message: "assetData must be a valid base64 string" }
  ),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(),
});

export type AttachVariantDigitalAssetCommand = z.infer<typeof AttachVariantDigitalAssetCommand>;

export const DetachVariantDigitalAssetCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("detachVariantDigitalAsset"),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type DetachVariantDigitalAssetCommand = z.infer<typeof DetachVariantDigitalAssetCommand>;

export const ReorderVariantsInProductCommand = z.object({
  type: z.literal("reorderVariantsInProduct"),
  productId: z.uuidv7(),
  variantPositions: z.array(
    z.object({
      variantId: z.uuidv7(),
      position: z.number().int().nonnegative(),
    }),
  ),
  userId: z.string(),
});

export type ReorderVariantsInProductCommand = z.infer<
  typeof ReorderVariantsInProductCommand
>;
