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
});

export type ArchiveProductCommand = z.infer<typeof ArchiveProductCommand>;

export const PublishProductCommand = z.object({
  id: z.uuidv7(),
});

export type PublishProductCommand = z.infer<typeof PublishProductCommand>;
