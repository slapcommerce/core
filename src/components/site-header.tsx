import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useLocation } from "@tanstack/react-router";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

function getPageTitle(pathname: string): string {
  // Remove leading/trailing slashes and split
  const segments = pathname.replace(/^\/|\/$/g, "").split("/");

  // Get the last segment (the actual page)
  const page = segments[segments.length - 1] || "Dashboard";

  // Capitalize first letter and handle special cases
  if (page === "admin" || page === "") {
    return "Dashboard";
  }

  // Convert kebab-case or camelCase to Title Case
  return page
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function SiteHeader() {
  const location = useLocation();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const pageTitle = getPageTitle(location.pathname);

  const toggleTheme = () => {
    if (theme === "system") {
      // If system, toggle to the opposite of current resolved theme
      setTheme(resolvedTheme === "dark" ? "light" : "dark");
    } else {
      // Toggle between light and dark
      setTheme(theme === "dark" ? "light" : "dark");
    }
  };

  // Use resolvedTheme for icon display (accounts for system theme)
  const isDark = resolvedTheme === "dark";

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-smooth ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height) relative backdrop-blur-sm bg-background/80">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1 transition-smooth hover:scale-110 hover:text-primary" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4 bg-gradient-to-b from-transparent via-border to-transparent"
        />
        <h1
          className="text-base font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text transition-smooth hover:from-primary hover:to-fantasy-purple"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {pageTitle}
        </h1>
        <div className="ml-auto flex items-center gap-2">
          {mounted && (
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:flex group relative overflow-visible"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {isDark ? (
                <Sun className="h-4 w-4 transition-smooth group-hover:rotate-180 group-hover:text-ornament-gold" />
              ) : (
                <Moon className="h-4 w-4 transition-smooth group-hover:-rotate-12 group-hover:text-fantasy-purple" />
              )}
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs opacity-0 group-hover:opacity-100 transition-smooth whitespace-nowrap pointer-events-none">
                {isDark ? "Light" : "Dark"} mode
              </span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
