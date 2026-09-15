"use client";

import React, { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Edit, Loader2 } from "lucide-react";
import { updateLeadData } from "./actions";
import { can, type Role } from "@klikklima/contracts";

interface EditLeadModalProps {
  leadId: string;
  initialData: {
    name: string;
    phone: string;
    email: string;
    address: string;
    estimatedQuote: string;
  };
  defaultOpen?: boolean;
  actorRole: Role | null;
}

export function EditLeadModal({ leadId, initialData, defaultOpen = false, actorRole }: EditLeadModalProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [formData, setFormData] = useState(initialData);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const canUpdateLead = !!actorRole && can(actorRole, "leads", "update") === "yes";

  if (!canUpdateLead) {
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = () => {
    setError("");
    startTransition(async () => {
      const res = await updateLeadData(leadId, formData);
      if (res.success) {
        setOpen(false);
      } else {
        setError(res.error || "Wystąpił błąd");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {canUpdateLead && (
        <DialogTrigger
          render={
            <Button variant="default" size="sm" className="gap-2">
              <Edit size={14} /> Edytuj dane
            </Button>
          }
        />
      )}
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edytuj dane Leada</DialogTitle>
        </DialogHeader>

        {error && <div className="text-destructive text-sm font-medium mb-4">{error}</div>}

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground">Imię i nazwisko</label>
            <input
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="flex h-10 w-full rounded-md border border-border bg-input-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          
          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground">Telefon</label>
            <input
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="flex h-10 w-full rounded-md border border-border bg-input-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground">Email</label>
            <input
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              className="flex h-10 w-full rounded-md border border-border bg-input-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground">Adres montażu</label>
            <input
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="flex h-10 w-full rounded-md border border-border bg-input-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground">Estymowana wycena (PLN)</label>
            <input
              name="estimatedQuote"
              value={formData.estimatedQuote}
              onChange={handleChange}
              className="flex h-10 w-full rounded-md border border-border bg-input-background px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Anuluj
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Zapisz zmiany
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
