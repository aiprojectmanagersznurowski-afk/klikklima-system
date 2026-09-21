"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronRight, Plus, UserPlus, ShieldPlus, Users, Wrench, CalendarPlus, UserCheck } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { NavItem, NavSubItem } from "@/navigation/sidebar-items";

interface NavMainProps {
  readonly items: NavItem[];
}

export function NavMain({ items }: NavMainProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { state, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed" && !isMobile;

  const currentUrl = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;

  const isExactActive = (href: string) => currentUrl === href;
  const isPrefixActive = (href: string) =>
    href !== "/" && href !== "/leads" && currentUrl.startsWith(href);

  const isItemActive = (item: NavItem) => {
    if (item.subItems) {
      return item.subItems.some((sub) => currentUrl === sub.href);
    }
    if (item.href) {
      return isExactActive(item.href) || isPrefixActive(item.href);
    }
    return false;
  };

  const isSubItemActive = (sub: NavSubItem) => currentUrl === sub.href;

  return (
    <>
      {/* Quick Create Action */}
      <SidebarGroup className="pt-2 pb-1">
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    tooltip="Szybkie dodawanie"
                    className="w-full bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground font-medium shadow-xs"
                  >
                    <Plus className="size-4 shrink-0" />
                    <span>Szybkie dodawanie</span>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side={isCollapsed ? "right" : "bottom"}
                  align={isCollapsed ? "start" : "center"}
                  sideOffset={8}
                  className="w-56"
                >
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                    Utwórz nowy obiekt
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link href="/customers?action=new" className="flex items-center gap-2 cursor-pointer">
                        <UserPlus className="size-4 text-primary" />
                        <span>Nowy klient</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/leads" className="flex items-center gap-2 cursor-pointer">
                        <Users className="size-4 text-primary" />
                        <span>Nowy lead</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/auditors" className="flex items-center gap-2 cursor-pointer">
                        <UserCheck className="size-4 text-primary" />
                        <span>Nowy audytor</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/crews" className="flex items-center gap-2 cursor-pointer">
                        <ShieldPlus className="size-4 text-primary" />
                        <span>Nowy zespół / monter</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/incidents" className="flex items-center gap-2 cursor-pointer">
                        <Wrench className="size-4 text-primary" />
                        <span>Nowe zgłoszenie / usterka</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/settings/calendar" className="flex items-center gap-2 cursor-pointer">
                        <CalendarPlus className="size-4 text-primary" />
                        <span>Wizyta w kalendarzu</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {/* Main Navigation Items */}
      <SidebarGroup className="pt-1">
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map((item) => {
              const Icon = item.icon;
              const hasSub = Boolean(item.subItems && item.subItems.length > 0);
              const active = isItemActive(item);

              if (!hasSub) {
                if (item.comingSoon) {
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        aria-disabled="true"
                        tooltip={isCollapsed ? `${item.label} (Wkrótce)` : undefined}
                        className="cursor-not-allowed opacity-60 text-muted-foreground"
                      >
                        <Icon className="size-4 shrink-0" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                      <SidebarMenuBadge>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                          Wkrótce
                        </Badge>
                      </SidebarMenuBadge>
                    </SidebarMenuItem>
                  );
                }

                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={isCollapsed ? item.label : undefined}
                    >
                      <Link prefetch={false} href={item.href || "#"}>
                        <Icon className="size-4 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              }

              // Subitems in collapsed icon mode -> DropdownMenu
              if (isCollapsed) {
                return (
                  <SidebarMenuItem key={item.id}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                          tooltip={item.label}
                          isActive={active}
                        >
                          <Icon className="size-4 shrink-0" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start" sideOffset={12} className="w-56 max-h-96 overflow-y-auto">
                        <DropdownMenuLabel>{item.label}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          {item.subItems!.map((sub) => {
                            const subActive = isSubItemActive(sub);
                            if (sub.comingSoon) {
                              return (
                                <DropdownMenuItem key={sub.id} disabled className="opacity-60 flex justify-between">
                                  <span>{sub.label}</span>
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">Wkrótce</Badge>
                                </DropdownMenuItem>
                              );
                            }
                            return (
                              <DropdownMenuItem key={sub.id} asChild className={cn(subActive && "bg-primary/10 text-primary font-medium")}>
                                <Link prefetch={false} href={sub.href}>
                                  <span>{sub.label}</span>
                                </Link>
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                );
              }

              // Subitems in expanded mode -> Collapsible
              const defaultOpen = item.subItems!.some((sub) => currentUrl.startsWith(sub.href));

              return (
                <Collapsible
                  key={item.id}
                  asChild
                  defaultOpen={defaultOpen}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip={item.label} isActive={active}>
                        <Icon className="size-4 shrink-0" />
                        <span>{item.label}</span>
                        <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 text-muted-foreground" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.subItems!.map((sub) => {
                          const subActive = isSubItemActive(sub);
                          if (sub.comingSoon) {
                            return (
                              <SidebarMenuSubItem key={sub.id}>
                                <SidebarMenuSubButton aria-disabled="true" className="cursor-not-allowed opacity-60 text-xs">
                                  <span className="truncate">{sub.label}</span>
                                  <Badge variant="secondary" className="ml-auto text-[10px] px-1 py-0 h-3.5">
                                    Wkrótce
                                  </Badge>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          }

                          return (
                            <SidebarMenuSubItem key={sub.id}>
                              <SidebarMenuSubButton asChild isActive={subActive}>
                                <Link prefetch={false} href={sub.href}>
                                  <span className="truncate">{sub.label}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}
