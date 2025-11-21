import { z } from "zod";

export const CreateCollectionCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("createCollection"),
  correlationId: z.uuidv7(),
  userId: z.string(),
  name: z.string().min(1),
  description: z.string().nullable(),
  slug: z.string().min(1),
});

export type CreateCollectionCommand = z.infer<typeof CreateCollectionCommand>;

export const ArchiveCollectionCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("archiveCollection"),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type ArchiveCollectionCommand = z.infer<typeof ArchiveCollectionCommand>;

export const UpdateCollectionMetadataCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateCollectionMetadata"),
  userId: z.string(),
  name: z.string().min(1),
  description: z.string().nullable(),
  newSlug: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateCollectionMetadataCommand = z.infer<typeof UpdateCollectionMetadataCommand>;

export const PublishCollectionCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("publishCollection"),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type PublishCollectionCommand = z.infer<typeof PublishCollectionCommand>;

export const UpdateCollectionSeoMetadataCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateCollectionSeoMetadata"),
  userId: z.string(),
  metaTitle: z.string(),
  metaDescription: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateCollectionSeoMetadataCommand = z.infer<typeof UpdateCollectionSeoMetadataCommand>;

export const UnpublishCollectionCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("unpublishCollection"),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UnpublishCollectionCommand = z.infer<typeof UnpublishCollectionCommand>;

export const AddCollectionImageCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("addCollectionImage"),
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

export type AddCollectionImageCommand = z.infer<typeof AddCollectionImageCommand>;

export const RemoveCollectionImageCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("removeCollectionImage"),
  userId: z.string(),
  imageId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type RemoveCollectionImageCommand = z.infer<typeof RemoveCollectionImageCommand>;

export const ReorderCollectionImagesCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("reorderCollectionImages"),
  userId: z.string(),
  orderedImageIds: z.array(z.string()),
  expectedVersion: z.number().int().nonnegative(),
});

export type ReorderCollectionImagesCommand = z.infer<typeof ReorderCollectionImagesCommand>;

export const UpdateCollectionImageAltTextCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateCollectionImageAltText"),
  userId: z.string(),
  imageId: z.string(),
  altText: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateCollectionImageAltTextCommand = z.infer<typeof UpdateCollectionImageAltTextCommand>;

export const UpdateCollectionImageCommand = z.object({
  id: z.uuidv7(),
  type: z.literal("updateCollectionImage"),
  userId: z.string(),
  imageId: z.string(), // Image to replace
  imageData: z.string().refine(
    (val) => /^[A-Za-z0-9+/]*={0,2}$/.test(val.replace(/^data:image\/\w+;base64,/, "")),
    { message: "imageData must be a valid base64 string" }
  ),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  altText: z.string().default(""),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateCollectionImageCommand = z.infer<typeof UpdateCollectionImageCommand>;

