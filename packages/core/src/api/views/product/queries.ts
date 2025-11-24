import { z } from "zod";

export const GetProductListQuery = z.object({
    status: z.enum(["draft", "active", "archived"]).optional(),
    vendor: z.string().optional(),
    productType: z.string().optional(),
    collectionId: z.string().optional(),
    limit: z.number().int().positive().optional(),
    offset: z.number().int().nonnegative().optional(),
});

export type GetProductListQuery = z.infer<typeof GetProductListQuery>;

export const GetProductCollectionsQuery = z.object({
    collectionId: z.string().optional(),
    aggregateId: z.string().optional(),
    status: z.enum(["draft", "active", "archived"]).optional(),
    limit: z.number().int().positive().optional(),
    offset: z.number().int().nonnegative().optional(),
});

export type GetProductCollectionsQuery = z.infer<
    typeof GetProductCollectionsQuery
>;

export const GetProductVariantsQuery = z.object({
    productId: z.string().optional(),
    variantId: z.string().optional(),
    status: z.enum(["draft", "active", "archived"]).optional(),
    limit: z.number().int().positive().optional(),
    offset: z.number().int().nonnegative().optional(),
});

export type GetProductVariantsQuery = z.infer<typeof GetProductVariantsQuery>;
