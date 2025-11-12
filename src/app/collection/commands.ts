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

