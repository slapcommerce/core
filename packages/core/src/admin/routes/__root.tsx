import { createRootRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { ThemeProvider } from "next-themes";
import { authClient } from "@/admin/lib/auth-client";
import { AppSidebar } from "@/admin/components/app-sidebar"
import { SiteHeader } from "@/admin/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/admin/components/ui/sidebar"
import { PageSkeletonRouter } from "@/admin/components/page-skeleton-router"
import { Toaster } from "@/admin/components/ui/sonner"
import "../index.css";

export const rootRoute = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: session, isPending } = authClient.useSession();
  const [showSkeleton, setShowSkeleton] = useState(isPending);
  const skeletonStartTimeRef = useRef<number | null>(isPending ? Date.now() : null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentPath = location.pathname;
  const isLoginPage = currentPath === "/admin/login";
  const isSignupPage = currentPath === "/admin/signup";
  const isPublicPage = isLoginPage || isSignupPage;

  // Ensure skeleton shows for a minimum time to prevent flash
  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (isPending) {
      // Start showing skeleton and record start time
      setShowSkeleton(true);
      skeletonStartTimeRef.current = Date.now();
    } else if (skeletonStartTimeRef.current !== null) {
      // Authentication completed, ensure minimum display time
      const elapsed = Date.now() - skeletonStartTimeRef.current;
      const remainingTime = Math.max(0, 300 - elapsed);
      
      timerRef.current = setTimeout(() => {
        setShowSkeleton(false);
        skeletonStartTimeRef.current = null;
        timerRef.current = null;
      }, remainingTime);
    } else {
      // If isPending is false and we never started a skeleton, hide it immediately
      setShowSkeleton(false);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPending]);

  useEffect(() => {
    // Redirect authenticated users away from login/signup pages
    if (!isPending && session && isPublicPage) {
      navigate({ to: "/admin", replace: true });
      return;
    }
    
    // Only redirect if we're on an admin page (not login or signup) and not authenticated
    if (!isPending && !session && currentPath.startsWith("/admin") && !isPublicPage) {
      navigate({ to: "/admin/login" });
    }
  }, [session, isPending, navigate, currentPath, isPublicPage]);

  const handleLogout = async () => {
    await authClient.signOut();
    navigate({ to: "/admin/login" });
  };

  // Don't show nav on login or signup pages - render immediately
  if (isPublicPage) {
    return <Outlet />;
  }

  // Show layout structure even while checking session to prevent flash
  // Only show content if authenticated, otherwise redirect will happen
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          {showSkeleton ? (
            <PageSkeletonRouter pathname={currentPath} />
          ) : !session ? (
            <div className="flex flex-1 items-center justify-center p-8">
              <div className="text-center text-muted-foreground">Redirecting to login...</div>
            </div>
          ) : (
            <Outlet />
          )}
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </ThemeProvider>
  )
}
