import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";

export const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/about",
  component: () => (
    <div className="text-center">
      <h1 className="text-3xl font-bold mb-4">About</h1>
      <p className="text-gray-600">This is the about page.</p>
    </div>
  ),
});
