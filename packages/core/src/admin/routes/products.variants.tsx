import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { VariantsPage } from "@/admin/components/variants-page";
import { queryClient } from "@/admin/lib/query-client";
import { variantsQueryOptions } from "@/admin/hooks/use-variants";

export const productsVariantsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/products/variants",
  loader: async ({ location }) => {
    // Extract productId from search params if present
    const search = location.search as { productId?: string };
    const params = search.productId ? { productId: search.productId } : undefined;

    // Prefetch variants data before rendering the page
    await queryClient.ensureQueryData(variantsQueryOptions(params));
  },
  component: VariantsPage,
});

