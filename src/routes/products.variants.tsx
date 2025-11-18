import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { VariantsPage } from "@/components/variants-page";

export const productsVariantsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/products/variants",
  component: VariantsPage,
});
