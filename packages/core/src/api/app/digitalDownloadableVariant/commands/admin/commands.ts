import { z } from "zod";

export const CreateDigitalDownloadableVariantCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("createDigitalDownloadableVariant"),
  correlationId: z.uuidv7(),
  userId: z.string(),
  productId: z.uuidv7(),
  sku: z.string().optional().default(""),
  price: z.number().nonnegative().optional().default(0),
  options: z.record(z.string(), z.string()).optional().default({}),
  maxDownloads: z.number().int().nonnegative().nullable().optional().default(null),
  accessDurationDays: z.number().int().nonnegative().nullable().optional().default(null),
});

export type CreateDigitalDownloadableVariantCommand = z.infer<typeof CreateDigitalDownloadableVariantCommand>;

export const UpdateDigitalDownloadableVariantDetailsCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateDigitalDownloadableVariantDetails"),
  userId: z.string(),
  options: z.record(z.string(), z.string()),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateDigitalDownloadableVariantDetailsCommand = z.infer<typeof UpdateDigitalDownloadableVariantDetailsCommand>;

export const UpdateDigitalDownloadableVariantPriceCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateDigitalDownloadableVariantPrice"),
  userId: z.string(),
  price: z.number().nonnegative(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateDigitalDownloadableVariantPriceCommand = z.infer<typeof UpdateDigitalDownloadableVariantPriceCommand>;

export const UpdateDigitalDownloadableVariantSkuCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateDigitalDownloadableVariantSku"),
  userId: z.string(),
  sku: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateDigitalDownloadableVariantSkuCommand = z.infer<typeof UpdateDigitalDownloadableVariantSkuCommand>;

export const ArchiveDigitalDownloadableVariantCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("archiveDigitalDownloadableVariant"),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type ArchiveDigitalDownloadableVariantCommand = z.infer<typeof ArchiveDigitalDownloadableVariantCommand>;

export const PublishDigitalDownloadableVariantCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("publishDigitalDownloadableVariant"),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type PublishDigitalDownloadableVariantCommand = z.infer<typeof PublishDigitalDownloadableVariantCommand>;

export const AddDigitalDownloadableVariantImageCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("addDigitalDownloadableVariantImage"),
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

export type AddDigitalDownloadableVariantImageCommand = z.infer<typeof AddDigitalDownloadableVariantImageCommand>;

export const RemoveDigitalDownloadableVariantImageCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("removeDigitalDownloadableVariantImage"),
  userId: z.string(),
  imageId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type RemoveDigitalDownloadableVariantImageCommand = z.infer<typeof RemoveDigitalDownloadableVariantImageCommand>;

export const ReorderDigitalDownloadableVariantImagesCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("reorderDigitalDownloadableVariantImages"),
  userId: z.string(),
  orderedImageIds: z.array(z.string()),
  expectedVersion: z.number().int().nonnegative(),
});

export type ReorderDigitalDownloadableVariantImagesCommand = z.infer<typeof ReorderDigitalDownloadableVariantImagesCommand>;

export const UpdateDigitalDownloadableVariantImageAltTextCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateDigitalDownloadableVariantImageAltText"),
  userId: z.string(),
  imageId: z.string(),
  altText: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateDigitalDownloadableVariantImageAltTextCommand = z.infer<typeof UpdateDigitalDownloadableVariantImageAltTextCommand>;

export const AttachDigitalDownloadableVariantDigitalAssetCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("attachDigitalDownloadableVariantDigitalAsset"),
  userId: z.string(),
  assetData: z.string().refine(
    (val) => {
      const base64Part = val.replace(/^data:[^;]+;base64,/, "");
      return /^[A-Za-z0-9+/]*={0,2}$/.test(base64Part);
    },
    { message: "assetData must be a valid base64 string" }
  ),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(),
});

export type AttachDigitalDownloadableVariantDigitalAssetCommand = z.infer<typeof AttachDigitalDownloadableVariantDigitalAssetCommand>;

export const DetachDigitalDownloadableVariantDigitalAssetCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("detachDigitalDownloadableVariantDigitalAsset"),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type DetachDigitalDownloadableVariantDigitalAssetCommand = z.infer<typeof DetachDigitalDownloadableVariantDigitalAssetCommand>;

export const UpdateDigitalDownloadableVariantDownloadSettingsCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateDigitalDownloadableVariantDownloadSettings"),
  userId: z.string(),
  maxDownloads: z.number().int().nonnegative().nullable(),
  accessDurationDays: z.number().int().nonnegative().nullable(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateDigitalDownloadableVariantDownloadSettingsCommand = z.infer<typeof UpdateDigitalDownloadableVariantDownloadSettingsCommand>;

export const ScheduleDigitalDownloadableVariantHiddenDropCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("scheduleDigitalDownloadableVariantHiddenDrop"),
  correlationId: z.uuidv7(),
  userId: z.string(),
  scheduledFor: z.coerce.date(),
  expectedVersion: z.number().int().nonnegative(),
});

export type ScheduleDigitalDownloadableVariantHiddenDropCommand = z.infer<typeof ScheduleDigitalDownloadableVariantHiddenDropCommand>;

export const ScheduleDigitalDownloadableVariantVisibleDropCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("scheduleDigitalDownloadableVariantVisibleDrop"),
  correlationId: z.uuidv7(),
  userId: z.string(),
  scheduledFor: z.coerce.date(),
  expectedVersion: z.number().int().nonnegative(),
});

export type ScheduleDigitalDownloadableVariantVisibleDropCommand = z.infer<typeof ScheduleDigitalDownloadableVariantVisibleDropCommand>;
