import { z } from "zod";

export const GetCollectionsQuery = z.object({
    status: z.enum(["draft", "active", "archived"]).optional(),
    limit: z.number().int().positive().optional(),
    offset: z.number().int().nonnegative().optional(),
});

export type GetCollectionsQuery = z.infer<typeof GetCollectionsQuery>;

export const GetCollectionQuery = z.object({
    collectionId: z.string(),
});

export type GetCollectionQuery = z.infer<typeof GetCollectionQuery>;

export const GetSlugRedirectChainQuery = z.object({
    entityId: z.string(),
    entityType: z.enum(["product", "collection"]),
});

export type GetSlugRedirectChainQuery = z.infer<typeof GetSlugRedirectChainQuery>;