import { CollectionsPageSkeleton } from "./skeletons/collections-page-skeleton";
import { DashboardPageSkeleton } from "./skeletons/dashboard-page-skeleton";
import { GenericPageSkeleton } from "./skeletons/generic-page-skeleton";

interface PageSkeletonRouterProps {
  pathname: string;
}

export function PageSkeletonRouter({ pathname }: PageSkeletonRouterProps) {
  // Match specific routes to their skeleton components
  if (pathname === "/admin" || pathname === "/admin/") {
    return <DashboardPageSkeleton />;
  }
  
  if (pathname === "/admin/products/collections") {
    return <CollectionsPageSkeleton />;
  }
  
  // Add more route-specific skeletons as needed
  // if (pathname === "/admin/products") {
  //   return <ProductsPageSkeleton />;
  // }
  
  // if (pathname === "/admin/orders") {
  //   return <OrdersPageSkeleton />;
  // }
  
  // Default fallback for unknown routes
  return <GenericPageSkeleton />;
}


