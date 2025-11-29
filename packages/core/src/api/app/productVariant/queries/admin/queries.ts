import { z } from "zod";

export const GetProductVariantsQuery = z.object({
  productId: z.string().uuid(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});

export type GetProductVariantsQuery = z.infer<typeof GetProductVariantsQuery>;
