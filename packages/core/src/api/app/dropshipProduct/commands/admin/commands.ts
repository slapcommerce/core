import { z } from "zod";

export const CreateDropshipProductCommand = z.object({
  id: z.string().uuid(),
  type: z.literal("createDropshipProduct"),
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
  dropshipSafetyBuffer: z.number().int().nonnegative().optional().default(0),
  fulfillmentProviderId: z.string().uuid().nullable().optional().default(null),
  supplierCost: z.number().nonnegative().nullable().optional().default(null),
  supplierSku: z.string().nullable().optional().default(null),
});

export type CreateDropshipProductCommand = z.infer<
  typeof CreateDropshipProductCommand
>;

export const ArchiveDropshipProductCommand = z.object({
  id: z.string().uuid(),
  type: z.literal("archiveDropshipProduct"),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type ArchiveDropshipProductCommand = z.infer<
  typeof ArchiveDropshipProductCommand
>;

export const PublishDropshipProductCommand = z.object({
  id: z.string().uuid(),
  type: z.literal("publishDropshipProduct"),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type PublishDropshipProductCommand = z.infer<
  typeof PublishDropshipProductCommand
>;

export const UnpublishDropshipProductCommand = z.object({
  id: z.string().uuid(),
  type: z.literal("unpublishDropshipProduct"),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UnpublishDropshipProductCommand = z.infer<
  typeof UnpublishDropshipProductCommand
>;

export const ChangeDropshipProductSlugCommand = z.object({
  id: z.string().uuid(),
  type: z.literal("changeDropshipProductSlug"),
  userId: z.string(),
  newSlug: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(),
});

export type ChangeDropshipProductSlugCommand = z.infer<
  typeof ChangeDropshipProductSlugCommand
>;

export const UpdateDropshipProductDetailsCommand = z.object({
  id: z.string().uuid(),
  type: z.literal("updateDropshipProductDetails"),
  userId: z.string(),
  name: z.string().min(1),
  description: z.string(),
  richDescriptionUrl: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateDropshipProductDetailsCommand = z.infer<
  typeof UpdateDropshipProductDetailsCommand
>;

export const UpdateDropshipProductMetadataCommand = z.object({
  id: z.string().uuid(),
  type: z.literal("updateDropshipProductMetadata"),
  userId: z.string(),
  metaTitle: z.string(),
  metaDescription: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateDropshipProductMetadataCommand = z.infer<
  typeof UpdateDropshipProductMetadataCommand
>;

export const UpdateDropshipProductClassificationCommand = z.object({
  id: z.string().uuid(),
  type: z.literal("updateDropshipProductClassification"),
  userId: z.string(),
  vendor: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateDropshipProductClassificationCommand = z.infer<
  typeof UpdateDropshipProductClassificationCommand
>;

export const UpdateDropshipProductTagsCommand = z.object({
  id: z.string().uuid(),
  type: z.literal("updateDropshipProductTags"),
  userId: z.string(),
  tags: z.array(z.string()),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateDropshipProductTagsCommand = z.infer<
  typeof UpdateDropshipProductTagsCommand
>;

export const UpdateDropshipProductCollectionsCommand = z.object({
  id: z.string().uuid(),
  type: z.literal("updateDropshipProductCollections"),
  userId: z.string(),
  collections: z.array(z.string().uuid()).min(1),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateDropshipProductCollectionsCommand = z.infer<
  typeof UpdateDropshipProductCollectionsCommand
>;

export const UpdateDropshipProductOptionsCommand = z.object({
  id: z.string().uuid(),
  type: z.literal("updateDropshipProductOptions"),
  userId: z.string(),
  variantOptions: z.array(
    z.object({
      name: z.string(),
      values: z.array(z.string()),
    })
  ),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateDropshipProductOptionsCommand = z.infer<
  typeof UpdateDropshipProductOptionsCommand
>;

export const UpdateDropshipProductTaxDetailsCommand = z.object({
  id: z.string().uuid(),
  type: z.literal("updateDropshipProductTaxDetails"),
  userId: z.string(),
  taxable: z.boolean(),
  taxId: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateDropshipProductTaxDetailsCommand = z.infer<
  typeof UpdateDropshipProductTaxDetailsCommand
>;

export const SetDropshipProductDefaultVariantCommand = z.object({
  type: z.literal("setDropshipProductDefaultVariant"),
  productId: z.string().uuid(),
  variantId: z.string().uuid(),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type SetDropshipProductDefaultVariantCommand = z.infer<
  typeof SetDropshipProductDefaultVariantCommand
>;

export const UpdateDropshipProductSafetyBufferCommand = z.object({
  id: z.string().uuid(),
  type: z.literal("updateDropshipProductSafetyBuffer"),
  userId: z.string(),
  dropshipSafetyBuffer: z.number().int().nonnegative(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateDropshipProductSafetyBufferCommand = z.infer<
  typeof UpdateDropshipProductSafetyBufferCommand
>;

export const UpdateDropshipProductFulfillmentSettingsCommand = z.object({
  id: z.string().uuid(),
  type: z.literal("updateDropshipProductFulfillmentSettings"),
  userId: z.string(),
  fulfillmentProviderId: z.string().uuid().nullable(),
  supplierCost: z.number().nonnegative().nullable(),
  supplierSku: z.string().nullable(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateDropshipProductFulfillmentSettingsCommand = z.infer<
  typeof UpdateDropshipProductFulfillmentSettingsCommand
>;
