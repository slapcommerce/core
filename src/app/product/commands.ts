import { z } from "zod";

export const CreateProductCommand = z.object({
  id: z.uuidv7(),
  correlationId: z.uuidv7(),
  title: z.string().min(1),
  shortDescription: z.string(),
  slug: z.string().min(1),
  collectionIds: z.array(z.uuidv7()),
  variantIds: z.array(z.uuidv7()),
  richDescriptionUrl: z.string(),
  productType: z.string(),
  vendor: z.string(),
  variantOptions: z.array(
    z.object({
      name: z.string(),
      values: z.array(z.string()),
    })
  ),
  metaTitle: z.string(),
  metaDescription: z.string(),
  tags: z.array(z.string()),
  requiresShipping: z.boolean(),
  taxable: z.boolean(),
  pageLayoutId: z.uuidv7().nullable(),
});

export type CreateProductCommand = z.infer<typeof CreateProductCommand>;

export const ArchiveProductCommand = z.object({
  id: z.uuidv7(),
  expectedVersion: z.number().int().nonnegative(),
});

export type ArchiveProductCommand = z.infer<typeof ArchiveProductCommand>;

export const PublishProductCommand = z.object({
  id: z.uuidv7(),
  expectedVersion: z.number().int().nonnegative(),
});

export type PublishProductCommand = z.infer<typeof PublishProductCommand>;

export const ChangeSlugCommand = z.object({
  id: z.uuidv7(),
  newSlug: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(),
});

export type ChangeSlugCommand = z.infer<typeof ChangeSlugCommand>;

export const UpdateProductDetailsCommand = z.object({
  id: z.uuidv7(),
  title: z.string().min(1),
  shortDescription: z.string(),
  richDescriptionUrl: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateProductDetailsCommand = z.infer<typeof UpdateProductDetailsCommand>;

export const UpdateProductMetadataCommand = z.object({
  id: z.uuidv7(),
  metaTitle: z.string(),
  metaDescription: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateProductMetadataCommand = z.infer<typeof UpdateProductMetadataCommand>;

export const UpdateProductClassificationCommand = z.object({
  id: z.uuidv7(),
  productType: z.string(),
  vendor: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateProductClassificationCommand = z.infer<typeof UpdateProductClassificationCommand>;

export const UpdateProductTagsCommand = z.object({
  id: z.uuidv7(),
  tags: z.array(z.string()),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateProductTagsCommand = z.infer<typeof UpdateProductTagsCommand>;

export const UpdateProductShippingSettingsCommand = z.object({
  id: z.uuidv7(),
  requiresShipping: z.boolean(),
  taxable: z.boolean(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateProductShippingSettingsCommand = z.infer<typeof UpdateProductShippingSettingsCommand>;

export const UpdateProductPageLayoutCommand = z.object({
  id: z.uuidv7(),
  pageLayoutId: z.uuidv7().nullable(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateProductPageLayoutCommand = z.infer<typeof UpdateProductPageLayoutCommand>;
