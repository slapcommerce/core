import { z } from "zod";

export const GetVariantsQuery = z.object({
    variantId: z.string().optional(),
    productId: z.string().optional(),
    status: z.enum(["draft", "active", "archived"]).optional(),
    sku: z.string().optional(),
    limit: z.number().int().positive().optional(),
    offset: z.number().int().nonnegative().optional(),
});

export type GetVariantsQuery = z.infer<typeof GetVariantsQuery>;
