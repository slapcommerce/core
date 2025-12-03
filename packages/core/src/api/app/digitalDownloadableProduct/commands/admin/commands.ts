import { z } from "zod";

export const CreateDigitalDownloadableProductCommand = z.object({
  id: z.string().uuid(),
  type: z.literal("createDigitalDownloadableProduct"),
  correlationId: z.string().uuid(),
  userId: z.string(),
  name: z.string().min(1),
  description: z.string().optional().default(""),
  slug: z.string().min(1),
  collections: z.array(z.string().uuid()).min(1),
  richDescriptionUrl: z.string().optional().default(""),
  vendor: z.string().optional().default(""),
  variantOptions: z
    .array(
      z.object({
        name: z.string(),
        values: z.array(z.string()),
      })
    )
    .optional()
    .default([]),
  metaTitle: z.string().optional().default(""),
  metaDescription: z.string().optional().default(""),
  tags: z.array(z.string()).optional().default([]),
  taxable: z.boolean(),
  taxId: z.string().optional().default(""),
  maxDownloads: z.number().int().nonnegative().nullable().optional().default(null),
  accessDurationDays: z.number().int().nonnegative().nullable().optional().default(null),
});

export type CreateDigitalDownloadableProductCommand = z.infer<
  typeof CreateDigitalDownloadableProductCommand
>;

export const ArchiveDigitalDownloadableProductCommand = z.object({
  id: z.string().uuid(),
  type: z.literal("archiveDigitalDownloadableProduct"),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type ArchiveDigitalDownloadableProductCommand = z.infer<
  typeof ArchiveDigitalDownloadableProductCommand
>;

export const PublishDigitalDownloadableProductCommand = z.object({
  id: z.string().uuid(),
  type: z.literal("publishDigitalDownloadableProduct"),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type PublishDigitalDownloadableProductCommand = z.infer<
  typeof PublishDigitalDownloadableProductCommand
>;

export const UnpublishDigitalDownloadableProductCommand = z.object({
  id: z.string().uuid(),
  type: z.literal("unpublishDigitalDownloadableProduct"),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UnpublishDigitalDownloadableProductCommand = z.infer<
  typeof UnpublishDigitalDownloadableProductCommand
>;

export const ChangeDigitalDownloadableProductSlugCommand = z.object({
  id: z.string().uuid(),
  type: z.literal("changeDigitalDownloadableProductSlug"),
  userId: z.string(),
  newSlug: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(),
});

export type ChangeDigitalDownloadableProductSlugCommand = z.infer<
  typeof ChangeDigitalDownloadableProductSlugCommand
>;

export const UpdateDigitalDownloadableProductDetailsCommand = z.object({
  id: z.string().uuid(),
  type: z.literal("updateDigitalDownloadableProductDetails"),
  userId: z.string(),
  name: z.string().min(1),
  description: z.string(),
  richDescriptionUrl: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateDigitalDownloadableProductDetailsCommand = z.infer<
  typeof UpdateDigitalDownloadableProductDetailsCommand
>;

export const UpdateDigitalDownloadableProductMetadataCommand = z.object({
  id: z.string().uuid(),
  type: z.literal("updateDigitalDownloadableProductMetadata"),
  userId: z.string(),
  metaTitle: z.string(),
  metaDescription: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateDigitalDownloadableProductMetadataCommand = z.infer<
  typeof UpdateDigitalDownloadableProductMetadataCommand
>;

export const UpdateDigitalDownloadableProductClassificationCommand = z.object({
  id: z.string().uuid(),
  type: z.literal("updateDigitalDownloadableProductClassification"),
  userId: z.string(),
  vendor: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateDigitalDownloadableProductClassificationCommand = z.infer<
  typeof UpdateDigitalDownloadableProductClassificationCommand
>;

export const UpdateDigitalDownloadableProductTagsCommand = z.object({
  id: z.string().uuid(),
  type: z.literal("updateDigitalDownloadableProductTags"),
  userId: z.string(),
  tags: z.array(z.string()),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateDigitalDownloadableProductTagsCommand = z.infer<
  typeof UpdateDigitalDownloadableProductTagsCommand
>;

export const UpdateDigitalDownloadableProductCollectionsCommand = z.object({
  id: z.string().uuid(),
  type: z.literal("updateDigitalDownloadableProductCollections"),
  userId: z.string(),
  collections: z.array(z.string().uuid()).min(1),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateDigitalDownloadableProductCollectionsCommand = z.infer<
  typeof UpdateDigitalDownloadableProductCollectionsCommand
>;

export const UpdateDigitalDownloadableProductOptionsCommand = z.object({
  id: z.string().uuid(),
  type: z.literal("updateDigitalDownloadableProductOptions"),
  userId: z.string(),
  variantOptions: z.array(
    z.object({
      name: z.string(),
      values: z.array(z.string()),
    })
  ),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateDigitalDownloadableProductOptionsCommand = z.infer<
  typeof UpdateDigitalDownloadableProductOptionsCommand
>;

export const UpdateDigitalDownloadableProductTaxDetailsCommand = z.object({
  id: z.string().uuid(),
  type: z.literal("updateDigitalDownloadableProductTaxDetails"),
  userId: z.string(),
  taxable: z.boolean(),
  taxId: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateDigitalDownloadableProductTaxDetailsCommand = z.infer<
  typeof UpdateDigitalDownloadableProductTaxDetailsCommand
>;

export const SetDigitalDownloadableProductDefaultVariantCommand = z.object({
  type: z.literal("setDigitalDownloadableProductDefaultVariant"),
  productId: z.string().uuid(),
  variantId: z.string().uuid(),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type SetDigitalDownloadableProductDefaultVariantCommand = z.infer<
  typeof SetDigitalDownloadableProductDefaultVariantCommand
>;

export const UpdateDigitalDownloadableProductDownloadSettingsCommand = z.object({
  id: z.string().uuid(),
  type: z.literal("updateDigitalDownloadableProductDownloadSettings"),
  userId: z.string(),
  maxDownloads: z.number().int().nonnegative().nullable(),
  accessDurationDays: z.number().int().nonnegative().nullable(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateDigitalDownloadableProductDownloadSettingsCommand = z.infer<
  typeof UpdateDigitalDownloadableProductDownloadSettingsCommand
>;

export const ScheduleDigitalDownloadableProductDropCommand = z.object({
  id: z.string().uuid(),
  type: z.literal("scheduleDigitalDownloadableProductDrop"),
  correlationId: z.string().uuid(),
  userId: z.string(),
  dropType: z.enum(["hidden", "visible"]),
  scheduledFor: z.coerce.date(),
  expectedVersion: z.number().int().nonnegative(),
});

export type ScheduleDigitalDownloadableProductDropCommand = z.infer<
  typeof ScheduleDigitalDownloadableProductDropCommand
>;

export const UpdateScheduledDigitalDownloadableProductDropCommand = z.object({
  id: z.string().uuid(),
  type: z.literal("updateScheduledDigitalDownloadableProductDrop"),
  userId: z.string(),
  dropType: z.enum(["hidden", "visible"]).optional(),
  scheduledFor: z.coerce.date().optional(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateScheduledDigitalDownloadableProductDropCommand = z.infer<
  typeof UpdateScheduledDigitalDownloadableProductDropCommand
>;

export const CancelScheduledDigitalDownloadableProductDropCommand = z.object({
  id: z.string().uuid(),
  type: z.literal("cancelScheduledDigitalDownloadableProductDrop"),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type CancelScheduledDigitalDownloadableProductDropCommand = z.infer<
  typeof CancelScheduledDigitalDownloadableProductDropCommand
>;
