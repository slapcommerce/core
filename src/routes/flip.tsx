import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { Calculator } from "@/components/calculator";

export const flipRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/flip",
  component: Calculator,
});
