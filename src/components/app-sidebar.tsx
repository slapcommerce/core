import * as React from "react";
import {
  IconBox,
  IconFolder,
  IconHelp,
  IconInnerShadowTop,
  IconSearch,
  IconSettings,
  IconShoppingCart,
} from "@tabler/icons-react";

import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Link } from "@tanstack/react-router";

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Products",
      url: "/admin/products",
      icon: IconBox,
      items: [
        {
          title: "Collections",
          url: "/admin/products/collections",
          icon: IconFolder,
        },
        {
          title: "Products",
          url: "/admin/products",
          icon: IconBox,
        },
      ],
    },
    {
      title: "Orders",
      url: "/admin/orders",
      icon: IconShoppingCart,
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "#",
      icon: IconSettings,
    },
    {
      title: "Get Help",
      url: "#",
      icon: IconHelp,
    },
    {
      title: "Search",
      url: "#",
      icon: IconSearch,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="relative">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5 group"
            >
              <Link
                to="/admin"
                className="transition-smooth hover:scale-[1.02]"
              >
                <IconInnerShadowTop className="!size-5 transition-smooth group-hover:text-primary group-hover:rotate-12" />
                <span
                  className="text-base font-bold tracking-tight"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  <span className="text-primary">Slap</span>Commerce
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="relative">
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter className="relative">
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
