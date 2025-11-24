import { z } from "zod";

export const GetSlugRedirectsQuery = z.object({
    oldSlug: z.string().optional(),
    newSlug: z.string().optional(),
    productId: z.string().optional(),
    entityId: z.string().optional(),
    entityType: z.enum(["product", "collection"]).optional(),
    limit: z.number().int().positive().optional(),
    offset: z.number().int().nonnegative().optional(),
});

export type GetSlugRedirectsQuery = z.infer<typeof GetSlugRedirectsQuery>;
