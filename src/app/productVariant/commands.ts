import { z } from "zod";

export const CreateProductVariantCommand = z
  .object({
    variantId: z.string(),
    productId: z.string(),
    createdAt: z.date(),
    sku: z.string(),
    priceCents: z.number().int().positive(),
    imageUrls: z.array(z.string().url()).optional(),
    videoUrls: z.array(z.string().url()).optional(),
    size: z.string(),
    color: z.string(),
  })
  .refine(
    (data) =>
      (data.imageUrls?.length ?? 0) > 0 || (data.videoUrls?.length ?? 0) > 0,
    {
      message: "Product variant must have at least one image or video URL",
    }
  );

export type CreateProductVariantCommand = z.infer<
  typeof CreateProductVariantCommand
>;

export const ArchiveProductVariantCommand = z.object({
  variantId: z.string(),
});

export type ArchiveProductVariantCommand = z.infer<
  typeof ArchiveProductVariantCommand
>;
