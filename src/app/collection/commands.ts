import { z } from "zod";

export const CreateCollectionCommand = z.object({
  id: z.uuidv7(),
  correlationId: z.uuidv7(),
  name: z.string().min(1),
  description: z.string().nullable(),
  slug: z.string().min(1),
});

export type CreateCollectionCommand = z.infer<typeof CreateCollectionCommand>;

export const ArchiveCollectionCommand = z.object({
  id: z.uuidv7(),
  expectedVersion: z.number().int().nonnegative(),
});

export type ArchiveCollectionCommand = z.infer<typeof ArchiveCollectionCommand>;

export const UpdateCollectionMetadataCommand = z.object({
  id: z.uuidv7(),
  name: z.string().min(1),
  description: z.string().nullable(),
  newSlug: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateCollectionMetadataCommand = z.infer<typeof UpdateCollectionMetadataCommand>;

export const PublishCollectionCommand = z.object({
  id: z.uuidv7(),
  expectedVersion: z.number().int().nonnegative(),
});

export type PublishCollectionCommand = z.infer<typeof PublishCollectionCommand>;

export const UpdateCollectionSeoMetadataCommand = z.object({
  id: z.uuidv7(),
  metaTitle: z.string(),
  metaDescription: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateCollectionSeoMetadataCommand = z.infer<typeof UpdateCollectionSeoMetadataCommand>;

export const UnpublishCollectionCommand = z.object({
  id: z.uuidv7(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UnpublishCollectionCommand = z.infer<typeof UnpublishCollectionCommand>;

export const UpdateCollectionImageCommand = z.object({
  id: z.uuidv7(),
  imageUrl: z.string().nullable(),
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdateCollectionImageCommand = z.infer<typeof UpdateCollectionImageCommand>;

