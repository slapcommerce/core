import { z } from "zod";

export const GetProductsQuery = z.object({
    status: z.enum(["draft", "active", "archived"]).optional(),
    collectionId: z.string().optional(),
    limit: z.number().int().positive().optional(),
    offset: z.number().int().nonnegative().optional(),
});

export type GetProductsQuery = z.infer<typeof GetProductsQuery>;

export const GetProductQuery = z.object({
    productId: z.string(),
});

export type GetProductQuery = z.infer<typeof GetProductQuery>;
