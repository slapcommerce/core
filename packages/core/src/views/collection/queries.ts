import { z } from "zod";

export const GetCollectionsQuery = z.object({
    collectionId: z.string().optional(),
    status: z.enum(["draft", "active", "archived"]).optional(),
    limit: z.number().int().positive().optional(),
    offset: z.number().int().nonnegative().optional(),
});

export type GetCollectionsQuery = z.infer<typeof GetCollectionsQuery>;
