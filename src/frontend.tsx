/**
 * This file is the entry point for the React app, it sets up the root
 * element and renders the RouterProvider to the DOM.
 *
 * It is included in `src/index.html`.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { rootRoute } from "./routes/__root";
import { indexRoute } from "./routes/index";
import { aboutRoute } from "./routes/about";
import { loginRoute } from "./routes/login";
import { signupRoute } from "./routes/signup";
import { productsRoute } from "./routes/products";
import { productsCollectionsRoute } from "./routes/products.collections";
import { ordersRoute } from "./routes/orders";

// Create the route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  aboutRoute,
  loginRoute,
  signupRoute,
  productsRoute,
  productsCollectionsRoute,
  ordersRoute,
]);

// Create the router instance
const router = createRouter({ routeTree });

// Register the router for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Create QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

const elem = document.getElementById("root")!;
const app = (
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
);

if (import.meta.hot) {
  // With hot module reloading, `import.meta.hot.data` is persisted.
  const root = (import.meta.hot.data.root ??= createRoot(elem));
  root.render(app);
} else {
  // The hot module reloading API is not available in production.
  createRoot(elem).render(app);
}
