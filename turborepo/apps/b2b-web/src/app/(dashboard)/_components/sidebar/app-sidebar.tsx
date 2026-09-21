"use client";

import * as React from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import type { Role } from "@klikklima/contracts";
import { Thermometer } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getActorRoleForNavAction } from "../../nav-role.actions";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";
import { getNavItemsForRole, type NavItem } from "@/navigation/sidebar-items";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  initialRole?: Role | null;
  initialUser?: User | null;
  initialItems?: NavItem[];
}

export function AppSidebar({
  initialRole = null,
  initialUser = null,
  initialItems,
  ...props
}: AppSidebarProps) {
  const [user, setUser] = React.useState<User | null>(initialUser);
  const [role, setRole] = React.useState<Role | null>(initialRole);
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  React.useEffect(() => {
    if (!user) {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) setUser(data.user);
      });
    }
    if (role === null) {
      getActorRoleForNavAction().then((r) => setRole(r));
    }
  }, [user, role]);

  const items = React.useMemo(() => {
    if (initialItems) return initialItems;
    return getNavItemsForRole(role);
  }, [initialItems, role]);

  return (
    <Sidebar collapsible="icon" variant="sidebar" {...props}>
      <SidebarHeader className="h-16 border-b border-sidebar-border flex items-center justify-center p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="hover:bg-transparent active:bg-transparent"
            >
              <Link href="/dashboard" className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs shrink-0">
                  <Thermometer className="size-5" />
                </div>
                {!isCollapsed && (
                  <div className="flex flex-col gap-0.5 leading-none">
                    <img
                      src="/logo.png"
                      alt="Klik Klima"
                      className="h-8 w-auto object-contain"
                    />
                  </div>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={items} />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <NavUser user={user} role={role} />
      </SidebarFooter>
    </Sidebar>
  );
}
