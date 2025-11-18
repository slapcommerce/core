import { z } from "zod";

export const CreateVariantCommand = z.object({
  id: z.uuidv7(),
  correlationId: z.uuidv7(),
  userId: z.string(),
  productId: z.uuidv7(),
  sku: z.string().min(1),
  title: z.string().min(1),
  price: z.number().nonnegative(),
  inventory: z.number().int().nonnegative(),
  options: z.record(z.string(), z.string()),
  barcode: z.string().nullable(),
  weight: z.number().nullable(),
});

export type CreateVariantCommand = z.infer<typeof CreateVariantCommand>;

export const UpdateVariantDetailsCommand = z.object({
  id: z.uuidv7(),
  userId: z.string(),
  title: z.string().min(1),
  options: z.record(z.string(), z.string()),
  barcode: z.string().nullable(),
  weight: z.number().nullable(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateVariantDetailsCommand = z.infer<typeof UpdateVariantDetailsCommand>;

export const UpdateVariantPriceCommand = z.object({
  id: z.uuidv7(),
  userId: z.string(),
  price: z.number().nonnegative(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateVariantPriceCommand = z.infer<typeof UpdateVariantPriceCommand>;

export const UpdateVariantInventoryCommand = z.object({
  id: z.uuidv7(),
  userId: z.string(),
  inventory: z.number().int().nonnegative(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateVariantInventoryCommand = z.infer<typeof UpdateVariantInventoryCommand>;

export const ArchiveVariantCommand = z.object({
  id: z.uuidv7(),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type ArchiveVariantCommand = z.infer<typeof ArchiveVariantCommand>;

export const PublishVariantCommand = z.object({
  id: z.uuidv7(),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type PublishVariantCommand = z.infer<typeof PublishVariantCommand>;

export const AddVariantImageCommand = z.object({
  id: z.uuidv7(),
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
  userId: z.string(),
  imageId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type RemoveVariantImageCommand = z.infer<typeof RemoveVariantImageCommand>;

export const ReorderVariantImagesCommand = z.object({
  id: z.uuidv7(),
  userId: z.string(),
  orderedImageIds: z.array(z.string()),
  expectedVersion: z.number().int().nonnegative(),
});

export type ReorderVariantImagesCommand = z.infer<typeof ReorderVariantImagesCommand>;

export const UpdateVariantImageAltTextCommand = z.object({
  id: z.uuidv7(),
  userId: z.string(),
  imageId: z.string(),
  altText: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateVariantImageAltTextCommand = z.infer<typeof UpdateVariantImageAltTextCommand>;

