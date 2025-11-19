import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { ProductsPage } from "@/components/products-page";
import { queryClient } from "@/lib/query-client";
import { productsQueryOptions } from "@/hooks/use-products";

export const productsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/products",
  loader: async () => {
    // Prefetch products data before rendering the page
    await queryClient.ensureQueryData(productsQueryOptions());
  },
  component: ProductsPage,
});


