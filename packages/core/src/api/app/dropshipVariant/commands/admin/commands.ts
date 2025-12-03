import { z } from "zod";

export const CreateDropshipVariantCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("createDropshipVariant"),
  correlationId: z.uuidv7(),
  userId: z.string(),
  productId: z.uuidv7(),
  sku: z.string().optional().default(""),
  price: z.number().nonnegative().optional().default(0),
  inventory: z.number().int().nonnegative().optional().default(0),
  options: z.record(z.string(), z.string()).optional().default({}),
  fulfillmentProviderId: z.string().uuid().nullable().optional().default(null),
  supplierCost: z.number().nonnegative().nullable().optional().default(null),
  supplierSku: z.string().nullable().optional().default(null),
});

export type CreateDropshipVariantCommand = z.infer<typeof CreateDropshipVariantCommand>;

export const UpdateDropshipVariantDetailsCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateDropshipVariantDetails"),
  userId: z.string(),
  options: z.record(z.string(), z.string()),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateDropshipVariantDetailsCommand = z.infer<typeof UpdateDropshipVariantDetailsCommand>;

export const UpdateDropshipVariantPriceCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateDropshipVariantPrice"),
  userId: z.string(),
  price: z.number().nonnegative(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateDropshipVariantPriceCommand = z.infer<typeof UpdateDropshipVariantPriceCommand>;

export const UpdateDropshipVariantSkuCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateDropshipVariantSku"),
  userId: z.string(),
  sku: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateDropshipVariantSkuCommand = z.infer<typeof UpdateDropshipVariantSkuCommand>;

export const ArchiveDropshipVariantCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("archiveDropshipVariant"),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type ArchiveDropshipVariantCommand = z.infer<typeof ArchiveDropshipVariantCommand>;

export const PublishDropshipVariantCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("publishDropshipVariant"),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type PublishDropshipVariantCommand = z.infer<typeof PublishDropshipVariantCommand>;

export const AddDropshipVariantImageCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("addDropshipVariantImage"),
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

export type AddDropshipVariantImageCommand = z.infer<typeof AddDropshipVariantImageCommand>;

export const RemoveDropshipVariantImageCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("removeDropshipVariantImage"),
  userId: z.string(),
  imageId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type RemoveDropshipVariantImageCommand = z.infer<typeof RemoveDropshipVariantImageCommand>;

export const ReorderDropshipVariantImagesCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("reorderDropshipVariantImages"),
  userId: z.string(),
  orderedImageIds: z.array(z.string()),
  expectedVersion: z.number().int().nonnegative(),
});

export type ReorderDropshipVariantImagesCommand = z.infer<typeof ReorderDropshipVariantImagesCommand>;

export const UpdateDropshipVariantImageAltTextCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateDropshipVariantImageAltText"),
  userId: z.string(),
  imageId: z.string(),
  altText: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateDropshipVariantImageAltTextCommand = z.infer<typeof UpdateDropshipVariantImageAltTextCommand>;

export const UpdateDropshipVariantInventoryCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateDropshipVariantInventory"),
  userId: z.string(),
  inventory: z.number().int().nonnegative(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateDropshipVariantInventoryCommand = z.infer<typeof UpdateDropshipVariantInventoryCommand>;

export const UpdateDropshipVariantFulfillmentSettingsCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateDropshipVariantFulfillmentSettings"),
  userId: z.string(),
  fulfillmentProviderId: z.string().uuid().nullable(),
  supplierCost: z.number().nonnegative().nullable(),
  supplierSku: z.string().nullable(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateDropshipVariantFulfillmentSettingsCommand = z.infer<typeof UpdateDropshipVariantFulfillmentSettingsCommand>;

export const ScheduleDropshipVariantDropCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("scheduleDropshipVariantDrop"),
  correlationId: z.uuidv7(),
  userId: z.string(),
  dropType: z.enum(["hidden", "visible"]),
  scheduledFor: z.coerce.date(),
  expectedVersion: z.number().int().nonnegative(),
});

export type ScheduleDropshipVariantDropCommand = z.infer<typeof ScheduleDropshipVariantDropCommand>;

export const UpdateDropshipVariantSaleCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateDropshipVariantSale"),
  userId: z.string(),
  saleType: z.enum(["fixed", "percent", "amount"]).nullable(),
  saleValue: z.number().nullable(),
  expectedVersion: z.number().int().nonnegative().optional(),
});

export type UpdateDropshipVariantSaleCommand = z.infer<typeof UpdateDropshipVariantSaleCommand>;

export const ScheduleDropshipVariantSaleCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("scheduleDropshipVariantSale"),
  correlationId: z.uuidv7(),
  userId: z.string(),
  saleType: z.enum(["fixed", "percent", "amount"]),
  saleValue: z.number(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  expectedVersion: z.number().int().nonnegative(),
});

export type ScheduleDropshipVariantSaleCommand = z.infer<typeof ScheduleDropshipVariantSaleCommand>;

export const UpdateScheduledDropshipVariantSaleCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateScheduledDropshipVariantSale"),
  userId: z.string(),
  saleType: z.enum(["fixed", "percent", "amount"]).optional(),
  saleValue: z.number().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateScheduledDropshipVariantSaleCommand = z.infer<typeof UpdateScheduledDropshipVariantSaleCommand>;

export const CancelScheduledDropshipVariantSaleCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("cancelScheduledDropshipVariantSale"),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type CancelScheduledDropshipVariantSaleCommand = z.infer<typeof CancelScheduledDropshipVariantSaleCommand>;

export const UpdateScheduledDropshipVariantDropCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateScheduledDropshipVariantDrop"),
  userId: z.string(),
  dropType: z.enum(["hidden", "visible"]).optional(),
  scheduledFor: z.coerce.date().optional(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateScheduledDropshipVariantDropCommand = z.infer<typeof UpdateScheduledDropshipVariantDropCommand>;

export const CancelScheduledDropshipVariantDropCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("cancelScheduledDropshipVariantDrop"),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type CancelScheduledDropshipVariantDropCommand = z.infer<typeof CancelScheduledDropshipVariantDropCommand>;
