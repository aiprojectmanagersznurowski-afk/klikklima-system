"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, LayoutDashboard, Users, FolderKanban, Box, BarChart3, Sparkles, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { baseNavItems } from "@/navigation/sidebar-items";

interface FlatSearchItem {
  id: string;
  group: string;
  label: string;
  href: string;
  icon?: any;
}

const navSearchItems: FlatSearchItem[] = baseNavItems.flatMap((item) => {
  if (item.subItems && item.subItems.length > 0) {
    return item.subItems.map((sub) => ({
      id: `${item.id}-${sub.id}`,
      group: item.label,
      label: sub.label,
      href: sub.href,
      icon: item.icon,
    }));
  }
  return [
    {
      id: item.id,
      group: "Główne",
      label: item.label,
      href: item.href || "#",
      icon: item.icon,
    },
  ];
});

export function SearchDialog() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "j" || e.key === "k") && (e.metaKey || e.ctrlKey)) {
        // Only intercept if not inside an input/textarea
        const target = e.target as HTMLElement;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
          return;
        }
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const groups = React.useMemo(() => {
    const map = new Map<string, FlatSearchItem[]>();
    for (const item of navSearchItems) {
      if (!map.has(item.group)) {
        map.set(item.group, []);
      }
      map.get(item.group)!.push(item);
    }
    return Array.from(map.entries());
  }, []);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground justify-between gap-2 border-border/80 bg-background/50 hover:bg-muted/60 shadow-2xs w-48 sm:w-64"
      >
        <div className="flex items-center gap-1.5 truncate">
          <Search className="size-3.5 shrink-0" />
          <span className="truncate">Nawiguj do strony...</span>
        </div>
        <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Wpisz nazwę strony, etapu lub modułu..." />
        <CommandList>
          <CommandEmpty>Nie znaleziono takiej strony.</CommandEmpty>
          {groups.map(([groupName, items], index) => (
            <React.Fragment key={groupName}>
              {index > 0 && <CommandSeparator />}
              <CommandGroup heading={groupName}>
                {items.map((item) => {
                  const Icon = item.icon || LayoutDashboard;
                  return (
                    <CommandItem
                      key={item.id}
                      value={`${item.group} ${item.label}`}
                      onSelect={() => handleSelect(item.href)}
                      className="cursor-pointer"
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground mr-2" />
                      <span>{item.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </React.Fragment>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
