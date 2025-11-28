import { z } from "zod";

export const GetVariantsQuery = z.object({
    productId: z.string().optional(),
    status: z.enum(["draft", "active", "archived"]).optional(),
    limit: z.number().int().positive().optional(),
    offset: z.number().int().nonnegative().optional(),
});

export type GetVariantsQuery = z.infer<typeof GetVariantsQuery>;

export const GetVariantQuery = z.object({
    variantId: z.string(),
});

export type GetVariantQuery = z.infer<typeof GetVariantQuery>;
