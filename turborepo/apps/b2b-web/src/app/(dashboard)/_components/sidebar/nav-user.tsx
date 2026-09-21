"use client";

import { LogOut, User as UserIcon, ChevronsUpDown, Shield } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { Role } from "@klikklima/contracts";
import { createClient } from "@/utils/supabase/client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

interface NavUserProps {
  user: User | null;
  role: Role | null;
}

export function NavUser({ user, role }: NavUserProps) {
  const { isMobile } = useSidebar();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const getInitials = (email?: string | null) => {
    if (!email) return "KK";
    return email.substring(0, 2).toUpperCase();
  };

  const formatRole = (r: Role | null) => {
    if (!r) return "Użytkownik";
    switch (r) {
      case "admin":
        return "Administrator";
      case "dyspozytor":
        return "Dyspozytor";
      case "audytor":
        return "Audytor";
      case "monter":
        return "Monter / Ekipa";
      default:
        return r;
    }
  };

  const email = user?.email || "Ładowanie...";
  const initials = getInitials(user?.email);
  const roleLabel = formatRole(role);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-lg bg-primary text-primary-foreground font-semibold">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs rounded-lg">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                <span className="truncate font-semibold text-xs">{email}</span>
                <span className="truncate text-muted-foreground text-[11px] flex items-center gap-1">
                  <Shield className="size-2.5 inline" /> {roleLabel}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-2 py-1.5 text-left text-sm">
                <Avatar className="size-8 rounded-lg bg-primary text-primary-foreground font-semibold">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs rounded-lg">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                  <span className="truncate font-semibold text-xs">{email}</span>
                  <span className="truncate text-muted-foreground text-[11px]">{roleLabel}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem className="cursor-pointer" onClick={() => (window.location.href = "/settings")}>
                <UserIcon className="size-4 mr-2" />
                <span>Ustawienia konta</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer" onClick={handleLogout}>
              <LogOut className="size-4 mr-2" />
              <span>Wyloguj się</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
