"use client";

import React, { useState, useTransition } from "react";
import {
  Bell,
  RefreshCw,
  Send,
  AlertTriangle,
  CheckCircle,
  Clock,
  Mail,
  MessageSquare,
  Smartphone,
  RotateCcw,
} from "lucide-react";
import { retryNotificationAction, triggerQueueDispatchAction } from "./actions";

interface NotificationItem {
  id: string;
  notificationId: string;
  templateKey: string;
  channel: string;
  recipientType: string;
  recipientAddress: string | null;
  status: string;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: string | Date | null;
  deadLetteredAt: string | Date | null;
  createdAt: string | Date;
}

interface NotificationsClientProps {
  initialItems: NotificationItem[];
  total: number;
}

export function NotificationsClient({ initialItems, total }: NotificationsClientProps) {
  const [items, setItems] = useState<NotificationItem[]>(initialItems);
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const filteredItems = items.filter((item) => {
    if (activeTab === "ALL") return true;
    return item.status === activeTab;
  });

  const handleRetry = (id: string) => {
    startTransition(async () => {
      try {
        const res = await retryNotificationAction(id);
        if (res.success && res.item) {
          setItems((prev) =>
            prev.map((it) => (it.id === id ? { ...it, ...res.item, status: "PENDING" } : it))
          );
          setMessage({ text: "Wiadomość została przywrócona do kolejki oczekujących" });
        }
      } catch (err) {
        setMessage({ text: err instanceof Error ? err.message : "Błąd ponawiania", isError: true });
      }
    });
  };

  const handleTriggerDispatch = () => {
    startTransition(async () => {
      try {
        const res = await triggerQueueDispatchAction();
        if (res.success) {
          setMessage({
            text: `Wysyłka zakończona. Przetworzono: ${res.result.processedCount}, wysłano: ${res.result.sentCount}, odroczono: ${res.result.deferredCount}, błędów: ${res.result.failedCount}`,
          });
        }
      } catch (err) {
        setMessage({ text: err instanceof Error ? err.message : "Błąd uruchamiania wysyłki", isError: true });
      }
    });
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "SMS":
        return <MessageSquare className="w-4 h-4 text-primary" />;
      case "EMAIL":
        return <Mail className="w-4 h-4 text-primary" />;
      case "PUSH":
        return <Smartphone className="w-4 h-4 text-primary" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SENT":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
            <CheckCircle className="w-3 h-3" />
            Wysłano
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
            <Clock className="w-3 h-3" />
            Oczekuje
          </span>
        );
      case "DEAD_LETTER":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive font-semibold">
            <AlertTriangle className="w-3 h-3" />
            Dead Letter
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" />
            Centrum Powiadomień
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Zarządzanie kolejką wysyłkową SMS, E-mail i Push (idempotentny silnik NTF-GATEWAY)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleTriggerDispatch}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            Wyślij oczekujące
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg text-sm flex items-center justify-between ${
            message.isError
              ? "bg-destructive/10 text-destructive border border-destructive/20"
              : "bg-muted text-foreground border border-border"
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs hover:underline ml-4">
            Zamknij
          </button>
        </div>
      )}

      {/* Zakładki filtrów statusów */}
      <div className="flex border-b border-border gap-2">
        {[
          { key: "ALL", label: "Wszystkie" },
          { key: "PENDING", label: "Oczekujące" },
          { key: "SENT", label: "Wysłane" },
          { key: "DEAD_LETTER", label: "Dead Letter" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tabela kolejki powiadomień */}
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground">
              <tr>
                <th className="py-3 px-4 font-medium">Kanał</th>
                <th className="py-3 px-4 font-medium">ID / Szablon</th>
                <th className="py-3 px-4 font-medium">Odbiorca</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium">Próby</th>
                <th className="py-3 px-4 font-medium">Data / Zaplanowano</th>
                <th className="py-3 px-4 font-medium text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    Brak powiadomień dla wybranego filtra.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {getChannelIcon(item.channel)}
                        <span className="font-semibold text-xs">{item.channel}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-foreground">{item.notificationId}</div>
                      <div className="text-xs text-muted-foreground font-mono">{item.templateKey}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-foreground">{item.recipientAddress || "—"}</div>
                      <div className="text-xs text-muted-foreground">{item.recipientType}</div>
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(item.status)}</td>
                    <td className="py-3 px-4">
                      <div className="text-xs font-mono">
                        {item.attempts} / 5
                        {item.lastError && (
                          <div
                            className="text-destructive truncate max-w-xs text-xs mt-0.5"
                            title={item.lastError}
                          >
                            {item.lastError}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      <div>Utworzono: {new Date(item.createdAt).toLocaleString("pl-PL")}</div>
                      {item.nextAttemptAt && (
                        <div className="text-primary mt-0.5">
                          Następna próba: {new Date(item.nextAttemptAt).toLocaleString("pl-PL")}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {item.status === "DEAD_LETTER" && (
                        <button
                          onClick={() => handleRetry(item.id)}
                          disabled={isPending}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Ponów
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
