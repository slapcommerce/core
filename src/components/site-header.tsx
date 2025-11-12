import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useLocation } from "@tanstack/react-router"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"

function getPageTitle(pathname: string): string {
  // Remove leading/trailing slashes and split
  const segments = pathname.replace(/^\/|\/$/g, "").split("/")
  
  // Get the last segment (the actual page)
  const page = segments[segments.length - 1] || "Dashboard"
  
  // Capitalize first letter and handle special cases
  if (page === "admin" || page === "") {
    return "Dashboard"
  }
  
  // Convert kebab-case or camelCase to Title Case
  return page
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function SiteHeader() {
  const location = useLocation()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  const pageTitle = getPageTitle(location.pathname)

  const toggleTheme = () => {
    if (theme === "system") {
      // If system, toggle to the opposite of current resolved theme
      setTheme(resolvedTheme === "dark" ? "light" : "dark")
    } else {
      // Toggle between light and dark
      setTheme(theme === "dark" ? "light" : "dark")
    }
  }

  // Use resolvedTheme for icon display (accounts for system theme)
  const isDark = resolvedTheme === "dark"

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{pageTitle}</h1>
        <div className="ml-auto flex items-center gap-2">
          {mounted && (
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:flex"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {isDark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
