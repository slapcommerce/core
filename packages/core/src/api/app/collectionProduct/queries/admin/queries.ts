import { z } from "zod";

export const GetCollectionProductsQuery = z.object({
  collectionId: z.string().uuid(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});

export type GetCollectionProductsQuery = z.infer<
  typeof GetCollectionProductsQuery
>;
