"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ShieldAlert,
  Download,
  Search,
  UserX,
  History,
  AlertTriangle,
  CheckCircle2,
  X,
  Clock,
  Database,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusPill } from "@/components/ui/status-pill";
import { formatDate } from "@/lib/format-date";
import { AUDIT_REQUIREMENTS, type Role } from "@klikklima/contracts";
import type { PrivacyMetrics } from "@/lib/rodo/types";
import {
  anonymizeClientPrivacyAction,
  exportClientRodoAction,
  searchClientsForPrivacyAction,
  type PrivacyAuditLogEntry,
  type ClientSearchResult,
} from "./actions";

const anonymizeFormSchema = z.object({
  justification: z.string().trim().min(10, "Uzasadnienie musi mieć co najmniej 10 znaków."),
  legalBasis: z.string().min(1, "Wybierz podstawę prawną."),
});

type AnonymizeFormValues = z.infer<typeof anonymizeFormSchema>;

interface PrivacyClientProps {
  metrics: PrivacyMetrics;
  recentAuditLogs: PrivacyAuditLogEntry[];
  actorRole?: Role | null;
}

export function PrivacyClient({ metrics, recentAuditLogs, actorRole: _actorRole }: PrivacyClientProps) {
  const router = useRouter();

  // Stan wyszukiwarki
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ClientSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Stan operacji
  const [selectedClient, setSelectedClient] = useState<ClientSearchResult | null>(null);
  const [isAnonymizeModalOpen, setIsAnonymizeModalOpen] = useState(false);
  const [isSubmittingAnonymize, setIsSubmittingAnonymize] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Stan eksportu danych
  const [exportingClientId, setExportingClientId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset: resetAnonymizeForm,
    watch,
    formState: { errors, isValid },
  } = useForm<AnonymizeFormValues>({
    resolver: zodResolver(anonymizeFormSchema),
    mode: "onChange",
    defaultValues: {
      justification: "",
      legalBasis: "",
    },
  });

  const justificationValue = watch("justification") || "";

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      return;
    }
    setIsSearching(true);
    setSearchError(null);
    try {
      const res = await searchClientsForPrivacyAction(searchQuery);
      if (res.success) {
        setSearchResults(res.clients);
        if (res.clients.length === 0) {
          setSearchError("Nie znaleziono klientów spełniających kryteria.");
        }
      } else {
        setSearchError(res.error || "Błąd wyszukiwania klientów.");
      }
    } catch {
      setSearchError("Nie udało się połączyć z serwerem.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleOpenAnonymizeModal = (client: ClientSearchResult) => {
    setSelectedClient(client);
    resetAnonymizeForm();
    setIsAnonymizeModalOpen(true);
  };

  const handleAnonymizeSubmit = async (values: AnonymizeFormValues) => {
    if (!selectedClient) {
      return;
    }
    setIsSubmittingAnonymize(true);
    setActionMessage(null);

    try {
      const res = await anonymizeClientPrivacyAction(selectedClient.id, values);
      if (res.success) {
        setActionMessage({
          type: "success",
          text: `Dane klienta ${selectedClient.name || selectedClient.clientNumber || selectedClient.id} zostały pomyślnie zanonimizowane zgodnie z art. 17 RODO.`,
        });
        setIsAnonymizeModalOpen(false);
        setSelectedClient(null);
        // Odśwież wyniki wyszukiwania
        setSearchResults((prev) =>
          prev.map((c) => (c.id === selectedClient.id ? { ...c, isAnonymized: true, name: "Klient usunięty" } : c))
        );
        router.refresh();
      } else {
        setActionMessage({
          type: "error",
          text: res.error || "Wystąpił błąd podczas anonimizacji danych klienta.",
        });
      }
    } catch {
      setActionMessage({
        type: "error",
        text: "Wystąpił nieoczekiwany błąd sieciowy.",
      });
    } finally {
      setIsSubmittingAnonymize(false);
    }
  };

  const handleExportData = async (client: ClientSearchResult) => {
    setExportingClientId(client.id);
    setActionMessage(null);

    try {
      const res = await exportClientRodoAction(client.id);
      if (res.success && res.data) {
        // Pobierz plik JSON na komputerze operatora
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data, null, 2));
        const downloadAnchor = document.createElement("a");
        const filename = `rodo-export-${client.clientNumber || client.id}-${new Date().toISOString().slice(0, 10)}.json`;
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", filename);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();

        setActionMessage({
          type: "success",
          text: `Eksport danych RODO dla klienta ${client.name || client.clientNumber} został pomyślnie wygenerowany i pobrany.`,
        });
      } else {
        setActionMessage({
          type: "error",
          text: res.error || "Nie udało się wygenerować eksportu danych.",
        });
      }
    } catch {
      setActionMessage({
        type: "error",
        text: "Błąd podczas eksportowania danych klienta.",
      });
    } finally {
      setExportingClientId(null);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Nagłówek */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Ustawienia: Prywatność i RODO (GDPR)
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              Admin & Audyt
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Zarządzanie realizacją wniosków o usunięcie danych (Art. 17 RODO), eksportem danych (Art. 20 RODO)
            oraz monitorowanie rejestru zdarzeń audytowych.
          </p>
        </div>
      </div>

      {/* Komunikat o akcji */}
      {actionMessage && (
        <div
          className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm transition-all ${
            actionMessage.type === "success"
              ? "border-primary/20 bg-primary/10 text-primary"
              : "border-destructive/20 bg-destructive/10 text-destructive"
          }`}
          role="status"
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === "success" ? (
              <CheckCircle2 className="size-5 shrink-0" />
            ) : (
              <AlertTriangle className="size-5 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/5"
            aria-label="Zamknij powiadomienie"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Karty KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-2xs">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Klienci łącznie</CardTitle>
            <Database className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{metrics.totalClients}</div>
            <p className="text-xs text-muted-foreground mt-1">Wszystkie rekordy podmiotów</p>
          </CardContent>
        </Card>

        <Card className="shadow-2xs">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aktywne podmioty PII</CardTitle>
            <ShieldAlert className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{metrics.activeClients}</div>
            <p className="text-xs text-muted-foreground mt-1">Z przetwarzanymi danymi kontaktowymi</p>
          </CardContent>
        </Card>

        <Card className="shadow-2xs">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Zanonimizowane podmioty</CardTitle>
            <UserX className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{metrics.anonymizedClients}</div>
            <p className="text-xs text-muted-foreground mt-1">Realizacja wniosków o usunięcie</p>
          </CardContent>
        </Card>

        <Card className="shadow-2xs">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Okres retencji</CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{metrics.retentionDays} dni</div>
            <p className="text-xs text-muted-foreground mt-1">5 lat zgodnie z prawem i audytem</p>
          </CardContent>
        </Card>
      </div>

      {/* Wyszukiwanie klientów do obsługi wniosków RODO */}
      <Card className="shadow-2xs">
        <CardHeader className="border-b border-border">
          <div className="flex items-center gap-2">
            <Search className="size-5 text-primary" />
            <CardTitle className="text-base font-semibold text-foreground">
              Obsługa wniosków RODO (Prawo do bycia zapomnianym & Eksport danych)
            </CardTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Wyszukaj klienta po nazwisku, adresie e-mail, numerze telefonu lub identyfikatorze, aby
            zrealizować wniosek z art. 17 lub wygenerować kopię danych z art. 20 RODO.
          </p>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <form onSubmit={handleSearch} className="flex gap-3 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Wyszukaj klienta (np. Jan Kowalski, jan@poczta.pl, +48...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button type="submit" disabled={isSearching || !searchQuery.trim()}>
              {isSearching ? "Szukanie..." : "Wyszukaj"}
            </Button>
          </form>

          {searchError && (
            <div className="text-sm text-destructive font-medium flex items-center gap-2">
              <AlertTriangle className="size-4" />
              <span>{searchError}</span>
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase font-semibold text-muted-foreground bg-secondary/50">
                  <tr>
                    <th className="p-3">Nr klienta</th>
                    <th className="p-3">Klient</th>
                    <th className="p-3">Kontakt</th>
                    <th className="p-3">Status RODO</th>
                    <th className="p-3 text-right">Akcje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {searchResults.map((client) => (
                    <tr key={client.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="p-3 font-mono text-xs text-muted-foreground">
                        {client.clientNumber || "—"}
                      </td>
                      <td className="p-3 font-medium text-foreground">
                        {client.name || "Nieznany"}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground space-y-0.5">
                        <div>{client.email || "Brak e-mail"}</div>
                        <div>{client.phone || "Brak tel."}</div>
                      </td>
                      <td className="p-3">
                        {client.isAnonymized ? (
                          <StatusPill label="Zanonimizowany" tone="danger" />
                        ) : (
                          <StatusPill label="Aktywne PII" tone="neutral" />
                        )}
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportData(client)}
                          disabled={exportingClientId === client.id}
                          className="gap-1.5 text-xs"
                        >
                          <Download className="size-3.5" />
                          {exportingClientId === client.id ? "Eksport..." : "Eksport (Art. 20)"}
                        </Button>

                        {!client.isAnonymized && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleOpenAnonymizeModal(client)}
                            className="gap-1.5 text-xs"
                          >
                            <UserX className="size-3.5" />
                            Anonimizuj (Art. 17)
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dziennik audytowy zdarzeń RODO */}
      <Card className="shadow-2xs">
        <CardHeader className="border-b border-border flex flex-row items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <History className="size-5 text-primary" />
              <CardTitle className="text-base font-semibold text-foreground">
                Rejestr operacji RODO (Audit Log)
              </CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">
              Zarejestrowane zdarzenia anonimizacji danych osobowych w systemie (tabela append-only).
            </p>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {recentAuditLogs.length} ostatnich wpisów
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase font-semibold text-muted-foreground bg-secondary/50">
                <tr>
                  <th className="p-3">Data i czas</th>
                  <th className="p-3">Aktor (Admin)</th>
                  <th className="p-3">Podstawa prawna</th>
                  <th className="p-3">Uzasadnienie operacji</th>
                  <th className="p-3 text-right">Id rekordu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">
                      Brak zarejestrowanych operacji anonimizacji w dzienniku audytu.
                    </td>
                  </tr>
                ) : (
                  recentAuditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(log.createdAt, "yyyy-MM-dd HH:mm")}
                      </td>
                      <td className="p-3 text-xs font-medium text-foreground">
                        <div>{log.actorEmail}</div>
                        <div className="text-[11px] text-muted-foreground">{log.actorRole}</div>
                      </td>
                      <td className="p-3 text-xs">
                        <span className="font-mono bg-secondary px-2 py-0.5 rounded text-[11px] text-foreground border border-border">
                          {log.legalBasis}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-foreground max-w-md">
                        {log.justification}
                      </td>
                      <td className="p-3 text-right font-mono text-xs text-muted-foreground">
                        {log.recordId.slice(0, 8)}…
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal / Dialog Anonimizacji RODO */}
      {isAnonymizeModalOpen && selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-xl shadow-xl max-w-lg w-full p-6 space-y-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-destructive">
                  <ShieldAlert className="size-5" />
                  <h2 className="text-lg font-bold text-foreground">Anonimizacja danych klienta (Art. 17 RODO)</h2>
                </div>
                <p className="text-xs text-muted-foreground">
                  Operacja jest nieodwracalna. Wszystkie dane kontaktowe i lokalizacyjne klienta zostaną
                  trwale zanonimizowane.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAnonymizeModalOpen(false)}
                className="text-muted-foreground hover:text-foreground rounded-md p-1"
                aria-label="Zamknij"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="rounded-lg bg-secondary/50 border border-border p-3 text-xs space-y-1">
              <div className="font-medium text-foreground">
                Wybrany klient: {selectedClient.name || "Nieznany"}
              </div>
              <div className="text-muted-foreground">
                Nr klienta: {selectedClient.clientNumber || selectedClient.id}
              </div>
              <div className="text-muted-foreground">
                Kontakt: {selectedClient.email || "brak e-mail"}, {selectedClient.phone || "brak tel."}
              </div>
            </div>

            <form onSubmit={handleSubmit(handleAnonymizeSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Podstawa prawna operacji <span className="text-destructive">*</span>
                </label>
                <select
                  {...register("legalBasis")}
                  className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Wybierz podstawę prawną z rejestru...</option>
                  {AUDIT_REQUIREMENTS.legalBases.map((basis) => (
                    <option key={basis} value={basis}>
                      {basis === "RODO_ERASURE_REQUEST"
                        ? "RODO_ERASURE_REQUEST (Żądanie usunięcia danych art. 17)"
                        : basis === "OPERATIONAL_ERROR"
                        ? "OPERATIONAL_ERROR (Błąd operacyjny / błędny wpis)"
                        : basis === "DUPLICATE"
                        ? "DUPLICATE (Zdublowany rekord klienta)"
                        : basis === "COURT_ORDER"
                        ? "COURT_ORDER (Nakaz sądowy / postanowienie)"
                        : "OTHER (Inna podstawa)"}
                    </option>
                  ))}
                </select>
                {errors.legalBasis && (
                  <p className="text-xs text-destructive">{errors.legalBasis.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-semibold text-foreground">
                    Uzasadnienie operacji (min. 10 znaków) <span className="text-destructive">*</span>
                  </label>
                  <span
                    className={`font-mono ${
                      justificationValue.trim().length >= 10
                        ? "text-muted-foreground"
                        : "text-destructive font-medium"
                    }`}
                  >
                    {justificationValue.trim().length}/10 znaków
                  </span>
                </div>
                <Textarea
                  {...register("justification")}
                  placeholder="Wprowadź szczegółowe uzasadnienie żądania RODO (np. numer zgłoszenia, dane wnioskodawcy)..."
                  className="text-sm min-h-[90px]"
                />
                {errors.justification && (
                  <p className="text-xs text-destructive">{errors.justification.message}</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAnonymizeModalOpen(false)}
                  disabled={isSubmittingAnonymize}
                >
                  Anuluj
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={!isValid || isSubmittingAnonymize}
                  className="gap-2"
                >
                  <UserX className="size-4" />
                  {isSubmittingAnonymize ? "Anonimizowanie..." : "Potwierdź usunięcie (RODO)"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
