import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";

export const productsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/products",
  component: () => (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6">
            <h1 className="text-3xl font-bold mb-4">Products</h1>
            <p className="text-gray-600">Manage your products here.</p>
          </div>
        </div>
      </div>
    </div>
  ),
});

