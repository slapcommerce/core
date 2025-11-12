import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import "../index.css";

export const rootRoute = createRootRoute({
  component: () => (
    <div className="container mx-auto p-8">
      <nav className="mb-8 flex gap-4 border-b pb-4">
        <Link
          to="/admin"
          className="[&.active]:font-bold [&.active]:text-blue-600"
        >
          Home
        </Link>
        <Link
          to="/admin/about"
          className="[&.active]:font-bold [&.active]:text-blue-600"
        >
          About
        </Link>
      </nav>
      <Outlet />
    </div>
  ),
});
