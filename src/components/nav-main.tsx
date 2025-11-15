import * as React from "react";
import { IconHome, IconChevronRight, type Icon } from "@tabler/icons-react";
import { Link, useLocation } from "@tanstack/react-router";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type NavItem = {
  title: string;
  url: string;
  icon?: Icon;
  items?: NavItem[];
};

export function NavMain({ items }: { items: NavItem[] }) {
  const location = useLocation();
  const currentPath = location.pathname;
  const [openItems, setOpenItems] = React.useState<Set<string>>(new Set());

  const toggleItem = (title: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  const isChildRouteActive = (url: string, isSubItem: boolean = false) => {
    if (url === "/admin") {
      return currentPath === "/admin";
    }
    // For sub-items (child routes), only check exact match
    // This prevents "/admin/products" from matching "/admin/products/collections"
    if (isSubItem) {
      return currentPath === url;
    }
    // For top-level items, check exact match or if path starts with URL followed by "/"
    if (currentPath === url) {
      return true;
    }
    return currentPath.startsWith(url + "/");
  };

  const isParentActive = (parentItems?: NavItem[]) => {
    if (!parentItems) return false;
    // Check if any child route matches exactly (use isSubItem=true for exact matching)
    return parentItems.some((subItem) => isChildRouteActive(subItem.url, true));
  };

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Home"
              isActive={currentPath === "/admin"}
              asChild
            >
              <Link to="/admin">
                <IconHome />
                <span>Home</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => {
            const hasItems = item.items && item.items.length > 0;
            const isOpen = openItems.has(item.title);
            // For parent items with children, only highlight if a child is active
            // For items without children, check if the route itself is active
            const itemIsActive = hasItems
              ? isParentActive(item.items)
              : isChildRouteActive(item.url);

            return (
              <SidebarMenuItem key={item.title}>
                {hasItems ? (
                  <>
                    <SidebarMenuButton
                      tooltip={item.title}
                      onClick={() => toggleItem(item.title)}
                      data-state={isOpen ? "open" : "closed"}
                      isActive={itemIsActive}
                    >
                      {item.icon && <item.icon />}
                      <span>{item.title}</span>
                      <IconChevronRight
                        className={cn(
                          "ml-auto transition-transform duration-200",
                          isOpen && "rotate-90",
                        )}
                      />
                    </SidebarMenuButton>
                    {isOpen && (
                      <SidebarMenuSub>
                        {item.items?.map((subItem) => {
                          // For sub-items, use exact match only to prevent false positives
                          const subItemIsActive = isChildRouteActive(
                            subItem.url,
                            true,
                          );
                          return (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={subItemIsActive}
                              >
                                <Link to={subItem.url}>
                                  {subItem.icon && <subItem.icon />}
                                  <span>{subItem.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    )}
                  </>
                ) : (
                  <SidebarMenuButton
                    tooltip={item.title}
                    asChild
                    isActive={itemIsActive}
                  >
                    <Link to={item.url}>
                      {item.icon && <item.icon />}
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
