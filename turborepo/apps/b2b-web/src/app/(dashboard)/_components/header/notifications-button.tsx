"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function NotificationsButton() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
          asChild
        >
          <Link href="/notifications">
            <Bell className="size-4" />
            <span className="sr-only">Powiadomienia</span>
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <span>Centrum powiadomień</span>
      </TooltipContent>
    </Tooltip>
  );
}
