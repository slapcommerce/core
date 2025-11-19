import { z } from "zod";

export const CreateProductCommand = z.object({
  id: z.uuidv7(),
  correlationId: z.uuidv7(),
  userId: z.string(),
  title: z.string().min(1),
  shortDescription: z.string().optional().default(""),
  slug: z.string().min(1),
  collectionIds: z.array(z.uuidv7()).optional().default([]),
  variantIds: z.array(z.uuidv7()).optional().default([]),
  richDescriptionUrl: z.string().optional().default(""),
  productType: z.string().optional().default(""),
  fulfillmentType: z
    .enum(["digital", "dropship"])
    .optional()
    .default("digital"),
  digitalAssetUrl: z.string().url().optional(),
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
  requiresShipping: z.boolean(),
  taxable: z.boolean(),
  pageLayoutId: z.uuidv7().nullable(),
});

export type CreateProductCommand = z.infer<typeof CreateProductCommand>;

export const ArchiveProductCommand = z.object({
  id: z.uuidv7(),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type ArchiveProductCommand = z.infer<typeof ArchiveProductCommand>;

export const PublishProductCommand = z.object({
  id: z.uuidv7(),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type PublishProductCommand = z.infer<typeof PublishProductCommand>;

export const UnpublishProductCommand = z.object({
  id: z.uuidv7(),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UnpublishProductCommand = z.infer<typeof UnpublishProductCommand>;

export const ChangeSlugCommand = z.object({
  id: z.uuidv7(),
  userId: z.string(),
  newSlug: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(),
});

export type ChangeSlugCommand = z.infer<typeof ChangeSlugCommand>;

export const UpdateProductDetailsCommand = z.object({
  id: z.uuidv7(),
  userId: z.string(),
  title: z.string().min(1),
  shortDescription: z.string(),
  richDescriptionUrl: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateProductDetailsCommand = z.infer<
  typeof UpdateProductDetailsCommand
>;

export const UpdateProductMetadataCommand = z.object({
  id: z.uuidv7(),
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
  userId: z.string(),
  productType: z.string(),
  vendor: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export const UpdateProductFulfillmentTypeCommand = z.object({
  id: z.uuidv7(),
  userId: z.string(),
  fulfillmentType: z.enum(["digital", "dropship"]),
  digitalAssetUrl: z.string().url().optional(),
  maxLicenses: z.number().int().positive().nullable().optional(),
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
  userId: z.string(),
  tags: z.array(z.string()),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateProductTagsCommand = z.infer<typeof UpdateProductTagsCommand>;

export const UpdateProductCollectionsCommand = z.object({
  id: z.uuidv7(),
  userId: z.string(),
  collectionIds: z.array(z.uuidv7()),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateProductCollectionsCommand = z.infer<
  typeof UpdateProductCollectionsCommand
>;

export const UpdateProductShippingSettingsCommand = z.object({
  id: z.uuidv7(),
  userId: z.string(),
  requiresShipping: z.boolean(),
  taxable: z.boolean(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateProductShippingSettingsCommand = z.infer<
  typeof UpdateProductShippingSettingsCommand
>;

export const UpdateProductPageLayoutCommand = z.object({
  id: z.uuidv7(),
  userId: z.string(),
  pageLayoutId: z.uuidv7().nullable(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateProductPageLayoutCommand = z.infer<
  typeof UpdateProductPageLayoutCommand
>;

export const UpdateProductOptionsCommand = z.object({
  id: z.uuidv7(),
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
