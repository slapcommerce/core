import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: () => (
    <div className="text-center">
      <h1 className="text-3xl font-bold mb-4">Welcome to Admin</h1>
      <p className="text-gray-600">This is the home page.</p>
    </div>
  ),
});

