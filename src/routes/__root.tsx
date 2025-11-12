import { createRootRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import "../index.css";

export const rootRoute = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: session, isPending } = authClient.useSession();

  const currentPath = location.pathname;
  const isLoginPage = currentPath === "/admin/login";
  const isSignupPage = currentPath === "/admin/signup";
  const isPublicPage = isLoginPage || isSignupPage;

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

  // Show loading state while checking session
  if (isPending) {
    return (
      <div className="container mx-auto p-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  // If not authenticated and not on a public page, show loading (redirect is happening)
  if (!session) {
    return (
      <div className="container mx-auto p-8">
        <div className="text-center">Redirecting to login...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <nav className="mb-8 flex items-center justify-between border-b pb-4">
        <div className="flex gap-4">
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
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{session.user.email}</span>
          <Button variant="outline" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </nav>
      <Outlet />
    </div>
  );
}
