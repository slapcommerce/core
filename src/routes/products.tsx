import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { ProductsPage } from "@/components/products-page";

export const productsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/products",
  component: ProductsPage,
});


