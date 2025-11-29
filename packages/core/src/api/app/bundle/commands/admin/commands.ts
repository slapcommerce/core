import { z } from "zod";

const BundleItemSchema = z.object({
  variantId: z.uuidv7(),
  quantity: z.number().int().positive(),
});

export const CreateBundleCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("createBundle"),
  correlationId: z.uuidv7(),
  userId: z.string(),
  name: z.string().min(1),
  description: z.string().optional().default(""),
  slug: z.string().min(1),
  items: z.array(BundleItemSchema).min(1),
  price: z.number().nonnegative(),
  compareAtPrice: z.number().nonnegative().nullable().optional().default(null),
  metaTitle: z.string().optional().default(""),
  metaDescription: z.string().optional().default(""),
  richDescriptionUrl: z.string().optional().default(""),
  tags: z.array(z.string()).optional().default([]),
  collections: z.array(z.uuidv7()).optional().default([]),
  taxable: z.boolean().optional().default(true),
  taxId: z.string().optional().default(""),
});

export type CreateBundleCommand = z.infer<typeof CreateBundleCommand>;

export const ArchiveBundleCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("archiveBundle"),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type ArchiveBundleCommand = z.infer<typeof ArchiveBundleCommand>;

export const PublishBundleCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("publishBundle"),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type PublishBundleCommand = z.infer<typeof PublishBundleCommand>;

export const UnpublishBundleCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("unpublishBundle"),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UnpublishBundleCommand = z.infer<typeof UnpublishBundleCommand>;

export const UpdateBundleItemsCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateBundleItems"),
  userId: z.string(),
  items: z.array(BundleItemSchema).min(1),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateBundleItemsCommand = z.infer<typeof UpdateBundleItemsCommand>;

export const UpdateBundleDetailsCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateBundleDetails"),
  userId: z.string(),
  name: z.string().min(1),
  description: z.string(),
  richDescriptionUrl: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateBundleDetailsCommand = z.infer<typeof UpdateBundleDetailsCommand>;

export const UpdateBundleMetadataCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateBundleMetadata"),
  userId: z.string(),
  metaTitle: z.string(),
  metaDescription: z.string(),
  tags: z.array(z.string()),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateBundleMetadataCommand = z.infer<typeof UpdateBundleMetadataCommand>;

export const UpdateBundlePriceCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateBundlePrice"),
  userId: z.string(),
  price: z.number().nonnegative(),
  compareAtPrice: z.number().nonnegative().nullable(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateBundlePriceCommand = z.infer<typeof UpdateBundlePriceCommand>;

export const UpdateBundleCollectionsCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateBundleCollections"),
  userId: z.string(),
  collections: z.array(z.uuidv7()),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateBundleCollectionsCommand = z.infer<typeof UpdateBundleCollectionsCommand>;

export const ChangeBundleSlugCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("changeBundleSlug"),
  userId: z.string(),
  newSlug: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(),
});

export type ChangeBundleSlugCommand = z.infer<typeof ChangeBundleSlugCommand>;

export const UpdateBundleTaxDetailsCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateBundleTaxDetails"),
  userId: z.string(),
  taxable: z.boolean(),
  taxId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateBundleTaxDetailsCommand = z.infer<typeof UpdateBundleTaxDetailsCommand>;

export const AddBundleImageCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("addBundleImage"),
  userId: z.string(),
  imageData: z.string().refine(
    (val) => /^[A-Za-z0-9+/]*={0,2}$/.test(val.replace(/^data:image\/\w+;base64,/, "")),
    { message: "imageData must be a valid base64 string" }
  ),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  altText: z.string().default(""),
  expectedVersion: z.number().int().nonnegative(),
});

export type AddBundleImageCommand = z.infer<typeof AddBundleImageCommand>;

export const RemoveBundleImageCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("removeBundleImage"),
  userId: z.string(),
  imageId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type RemoveBundleImageCommand = z.infer<typeof RemoveBundleImageCommand>;

export const ReorderBundleImagesCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("reorderBundleImages"),
  userId: z.string(),
  orderedImageIds: z.array(z.string()),
  expectedVersion: z.number().int().nonnegative(),
});

export type ReorderBundleImagesCommand = z.infer<typeof ReorderBundleImagesCommand>;

export const UpdateBundleImageAltTextCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateBundleImageAltText"),
  userId: z.string(),
  imageId: z.string(),
  altText: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateBundleImageAltTextCommand = z.infer<typeof UpdateBundleImageAltTextCommand>;
