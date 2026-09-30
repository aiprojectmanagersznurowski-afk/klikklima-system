"use client";

import React, { useState, useTransition, useMemo } from "react";
import {
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Layers,
  Home,
  Wrench,
  Search,
  Sparkles,
  Calculator,
  ArrowRightLeft,
  RotateCcw,
} from "lucide-react";
import type { Role } from "@klikklima/contracts";
import { can } from "@klikklima/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  calculateStandardInstallation,
  type StandardInstallationConfig,
  type StandardInstallationItemConfig,
  type StandardInstallationMultiplier,
  type PricingItemForStandardCalculation,
} from "../../../../lib/pricing/standard-installation-schema";
import { updateStandardInstallationConfigAction } from "./actions";

export type AvailablePriceItem = {
  id: string;
  name: string;
  unit: string;
  scope: string;
  category: string | null;
  description: string | null;
  isActive: boolean;
  versions: {
    id: string;
    salePriceNet: unknown;
    crewCostNet: unknown;
    isCurrent: boolean;
  }[];
};

export type StandardInstallationClientProps = {
  availablePriceItems: AvailablePriceItem[];
  initialConfig: StandardInstallationConfig | null;
  actorRole: Role;
};

// 9 domyślnych pozycji montażu wzorcowego z dokumentacji technicznej i cennika robocizny
const DEFAULT_BLUEPRINT_NAMES: Array<{
  nameFragment: string;
  multiplier: StandardInstallationMultiplier;
  quantity: number;
}> = [
  { nameFragment: "podłączenie ściennej", multiplier: "PER_INDOOR_UNIT", quantity: 1 },
  { nameFragment: "instalacja freonowa 1/4 i 3/8", multiplier: "PER_INDOOR_UNIT", quantity: 3 },
  { nameFragment: "koryta na instalację freonową", multiplier: "PER_INDOOR_UNIT", quantity: 3 },
  { nameFragment: "przewiert", multiplier: "PER_INDOOR_UNIT", quantity: 1 },
  { nameFragment: "skropliny grawitacyjnie giętkie", multiplier: "PER_INDOOR_UNIT", quantity: 3 },
  { nameFragment: "uruchomienie", multiplier: "PER_INSTALLATION", quantity: 1 },
  { nameFragment: "dł przewodu zasilającego", multiplier: "PER_INSTALLATION", quantity: 5 },
  { nameFragment: "wpięcie zasilania do gniazda na sztywno", multiplier: "PER_INSTALLATION", quantity: 1 },
  { nameFragment: "jedn zew stoi na podstawach kauczukowych", multiplier: "PER_INSTALLATION", quantity: 1 },
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function StandardInstallationClient({
  availablePriceItems,
  initialConfig,
  actorRole,
}: StandardInstallationClientProps) {
  const canEdit = can(actorRole, "system_config", "update") === "yes";

  // Słownik mapujący ID pozycji na dane cenowe
  const priceItemsMap = useMemo(() => {
    const map = new Map<string, PricingItemForStandardCalculation>();
    for (const item of availablePriceItems) {
      const currentVersion = item.versions.find((v) => v.isCurrent) ?? item.versions[0];
      const salePriceNet = currentVersion?.salePriceNet != null ? Number(currentVersion.salePriceNet) : 0;
      const crewCostNet = currentVersion?.crewCostNet != null ? Number(currentVersion.crewCostNet) : 0;
      map.set(item.id, {
        id: item.id,
        name: item.name,
        unit: item.unit,
        salePriceNet,
        crewCostNet,
      });
    }
    return map;
  }, [availablePriceItems]);

  // Pomocnik do wygenerowania domyślnych pozycji wzorcowych
  const generateBlueprintItems = (): StandardInstallationItemConfig[] => {
    const matched: StandardInstallationItemConfig[] = [];
    for (const bp of DEFAULT_BLUEPRINT_NAMES) {
      const found = availablePriceItems.find((p) =>
        p.name.toLowerCase().includes(bp.nameFragment.toLowerCase())
      );
      if (found) {
        matched.push({
          priceListItemId: found.id,
          multiplier: bp.multiplier,
          quantity: bp.quantity,
        });
      }
    }
    return matched;
  };

  const initialItems = useMemo<StandardInstallationItemConfig[]>(() => {
    if (initialConfig?.items && initialConfig.items.length > 0) {
      return initialConfig.items;
    }
    return generateBlueprintItems();
  }, [initialConfig, availablePriceItems]);

  const [items, setItems] = useState<StandardInstallationItemConfig[]>(initialItems);
  const [notes, setNotes] = useState<string>(initialConfig?.notes ?? "");
  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Stan dialogu dodawania pozycji
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedMultiplierForAdd, setSelectedMultiplierForAdd] = useState<StandardInstallationMultiplier>("PER_INDOOR_UNIT");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  // Dostępne kategorie
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const item of availablePriceItems) {
      if (item.category) cats.add(item.category);
    }
    return Array.from(cats).sort();
  }, [availablePriceItems]);

  // Pozycje cennika, które jeszcze nie są dodane do standardu
  const unconfiguredPriceItems = useMemo(() => {
    const usedIds = new Set(items.map((i) => i.priceListItemId));
    return availablePriceItems.filter((p) => {
      if (usedIds.has(p.id)) return false;
      if (categoryFilter !== "ALL" && p.category !== categoryFilter) return false;
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.category && p.category.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [availablePriceItems, items, categoryFilter, searchQuery]);

  // Podział na sekcje
  const indoorUnitItems = useMemo(
    () => items.filter((i) => i.multiplier === "PER_INDOOR_UNIT"),
    [items]
  );
  const installationItems = useMemo(
    () => items.filter((i) => i.multiplier === "PER_INSTALLATION"),
    [items]
  );

  // Kalkulacja live dla 1, 2 i 3 jednostek
  const calc1Unit = useMemo(() => calculateStandardInstallation(items, priceItemsMap, 1), [items, priceItemsMap]);
  const calc2Units = useMemo(() => calculateStandardInstallation(items, priceItemsMap, 2), [items, priceItemsMap]);
  const calc3Units = useMemo(() => calculateStandardInstallation(items, priceItemsMap, 3), [items, priceItemsMap]);

  // Sumaryczna stawka na jednostkę wewnętrzną i na instalację
  const ratePerIndoorUnitNet = useMemo(() => {
    return indoorUnitItems.reduce((acc, item) => {
      const p = priceItemsMap.get(item.priceListItemId);
      return acc + (p?.salePriceNet ?? 0) * item.quantity;
    }, 0);
  }, [indoorUnitItems, priceItemsMap]);

  const ratePerInstallationNet = useMemo(() => {
    return installationItems.reduce((acc, item) => {
      const p = priceItemsMap.get(item.priceListItemId);
      return acc + (p?.salePriceNet ?? 0) * item.quantity;
    }, 0);
  }, [installationItems, priceItemsMap]);

  // Aktualizacja ilości
  const handleQuantityChange = (priceListItemId: string, newQuantity: number) => {
    if (newQuantity <= 0) return;
    setItems((prev) =>
      prev.map((i) => (i.priceListItemId === priceListItemId ? { ...i, quantity: newQuantity } : i))
    );
  };

  // Zmiana mnożnika (przeniesienie między sekcjami)
  const handleToggleMultiplier = (priceListItemId: string) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.priceListItemId === priceListItemId) {
          const nextMult: StandardInstallationMultiplier =
            i.multiplier === "PER_INDOOR_UNIT" ? "PER_INSTALLATION" : "PER_INDOOR_UNIT";
          return { ...i, multiplier: nextMult };
        }
        return i;
      })
    );
  };

  // Usunięcie ze standardu
  const handleRemoveItem = (priceListItemId: string) => {
    setItems((prev) => prev.filter((i) => i.priceListItemId !== priceListItemId));
  };

  // Dodanie ze słownika cennika
  const handleAddItem = (priceListItemId: string, defaultQuantity: number = 1) => {
    setItems((prev) => [
      ...prev,
      {
        priceListItemId,
        multiplier: selectedMultiplierForAdd,
        quantity: defaultQuantity,
      },
    ]);
    setIsAddDialogOpen(false);
  };

  // Przywrócenie wzorca
  const handleResetToBlueprint = () => {
    const bp = generateBlueprintItems();
    setItems(bp);
    setStatusMessage({
      type: "success",
      text: "Wczytano 9 pozycji wzorcowych. Pamiętaj, aby kliknąć „Zapisz konfigurację”, aby utrwalić zmiany w bazie.",
    });
  };

  // Zapis konfiguracji do bazy
  const handleSave = () => {
    if (!canEdit) return;
    setStatusMessage(null);

    startTransition(async () => {
      const result = await updateStandardInstallationConfigAction({
        items,
        notes: notes.trim() !== "" ? notes.trim() : undefined,
      });

      if (result.success) {
        setStatusMessage({
          type: "success",
          text: "Konfiguracja montażu standardowego została pomyślnie zapisana i zaktualizowana w audit_log.",
        });
      } else {
        setStatusMessage({
          type: "error",
          text: result.error ?? "Wystąpił błąd podczas zapisywania konfiguracji.",
        });
      }
    });
  };

  const renderSectionTable = (
    sectionItems: StandardInstallationItemConfig[],
    sectionMultiplier: StandardInstallationMultiplier,
    title: string,
    description: string,
    icon: React.ReactNode,
    rateTotal: number
  ) => {
    return (
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                {icon}
              </div>
              <div>
                <CardTitle className="text-base font-semibold">{title}</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  {description}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <span className="text-xs text-muted-foreground block">
                  {sectionMultiplier === "PER_INDOOR_UNIT" ? "Suma na 1 pokój:" : "Suma na układ:"}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {formatCurrency(rateTotal)} netto
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={!canEdit}
                onClick={() => {
                  setSelectedMultiplierForAdd(sectionMultiplier);
                  setIsAddDialogOpen(true);
                }}
                className="h-8 gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Dodaj pozycję</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {sectionItems.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Brak pozycji w tej sekcji. Kliknij „Dodaj pozycję”, aby wybrać pozycję z cennika.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[30%]">Pozycja cennikowa</TableHead>
                    <TableHead className="w-[12%]">Ilość bazowa</TableHead>
                    <TableHead className="w-[10%]">Jedn.</TableHead>
                    <TableHead className="w-[14%] text-right">Cena jedn. netto</TableHead>
                    <TableHead className="w-[14%] text-right">Wartość netto</TableHead>
                    <TableHead className="w-[12%] text-right">Koszt ekipy</TableHead>
                    <TableHead className="w-[8%] text-center">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sectionItems.map((item) => {
                    const priceInfo = priceItemsMap.get(item.priceListItemId);
                    const name = priceInfo?.name ?? `Pozycja [${item.priceListItemId}]`;
                    const unit = priceInfo?.unit ?? "szt";
                    const salePrice = priceInfo?.salePriceNet ?? 0;
                    const crewCost = priceInfo?.crewCostNet ?? 0;
                    const totalSale = Math.round(salePrice * item.quantity * 100) / 100;
                    const totalCrew = Math.round(crewCost * item.quantity * 100) / 100;

                    return (
                      <TableRow key={item.priceListItemId} className="hover:bg-muted/40">
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span className="text-sm text-foreground">{name}</span>
                            <span className="text-xs text-muted-foreground font-mono">
                              ID: {item.priceListItemId.slice(0, 8)}...
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {canEdit ? (
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="number"
                                min={0.1}
                                step={item.quantity % 1 === 0 ? 1 : 0.5}
                                max={1000}
                                value={item.quantity}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val)) handleQuantityChange(item.priceListItemId, val);
                                }}
                                className="h-8 w-20 text-center font-mono text-sm"
                              />
                            </div>
                          ) : (
                            <span className="font-mono text-sm">{item.quantity}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {unit}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(salePrice)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold text-foreground">
                          {formatCurrency(totalSale)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {formatCurrency(totalCrew)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={!canEdit}
                              title="Przełącz sekcję (na jednostkę / na układ)"
                              onClick={() => handleToggleMultiplier(item.priceListItemId)}
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            >
                              <ArrowRightLeft className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={!canEdit}
                              title="Usuń ze standardu"
                              onClick={() => handleRemoveItem(item.priceListItemId)}
                              className="h-8 w-8 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Montaż standardowy
            </h1>
            <Badge variant={canEdit ? "default" : "secondary"} className="text-xs">
              {canEdit ? "Tryb konfiguratora" : "Tylko odczyt"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            Definicja wzorcowego pakietu montażowego — wspólne źródło ilości pozycji cennika
            dla konfiguratora Triage B2C oraz wyceny audytora. Zmiana cen w cenniku automatycznie
            aktualizuje wycenę standardu.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            disabled={!canEdit || isPending}
            onClick={handleResetToBlueprint}
            className="h-9 gap-1.5"
            title="Przywraca 9 pozycji z cennika robocizny"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Wczytaj wzorzec</span>
          </Button>

          <Button
            size="sm"
            disabled={!canEdit || isPending}
            onClick={handleSave}
            className="h-9 gap-1.5 shadow-sm"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>Zapisz konfigurację</span>
          </Button>
        </div>
      </div>

      {/* Komunikat o stanie */}
      {statusMessage && (
        <div
          className={`flex items-center gap-2.5 p-3.5 rounded-lg border text-sm ${
            statusMessage.type === "success"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
              : "bg-destructive/10 text-destructive border-destructive/20"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <p className="flex-1">{statusMessage.text}</p>
        </div>
      )}

      {/* Live Calculator / Wycena Standardu dla 1, 2 i 3 pomieszczeń */}
      <Card className="bg-muted/30 border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">
                Kalkulator i Podgląd Wyceny Standardu (na żywo)
              </CardTitle>
            </div>
            <div className="text-xs text-muted-foreground">
              Formuła: (stawka jednostkowa × N) + stawka układu
            </div>
          </div>
          <CardDescription className="text-xs">
            Poniższe kwoty wynikają bezpośrednio z aktualnych cen w cenniku oraz zdefiniowanych poniżej ilości.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1 jednostka - Single Split */}
            <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Single-Split
                </span>
                <Badge variant="outline" className="text-xs font-mono">1 pokój</Badge>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-foreground">
                  {formatCurrency(calc1Unit.totalSalePriceNet)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  brutto (VAT 8%): <span className="font-semibold">{formatCurrency(calc1Unit.totalSalePriceNet * 1.08)}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-border/60 text-xs space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Koszt ekipy:</span>
                  <span className="font-mono">{formatCurrency(calc1Unit.totalCrewCostNet)}</span>
                </div>
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                  <span>Marża ({calc1Unit.marginPercent}%):</span>
                  <span className="font-mono">{formatCurrency(calc1Unit.marginNet)}</span>
                </div>
              </div>
            </div>

            {/* 2 jednostki - Multi Split 2x */}
            <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Multi-Split 2x
                </span>
                <Badge variant="outline" className="text-xs font-mono">2 pokoje</Badge>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-foreground">
                  {formatCurrency(calc2Units.totalSalePriceNet)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  brutto (VAT 8%): <span className="font-semibold">{formatCurrency(calc2Units.totalSalePriceNet * 1.08)}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-border/60 text-xs space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Koszt ekipy:</span>
                  <span className="font-mono">{formatCurrency(calc2Units.totalCrewCostNet)}</span>
                </div>
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                  <span>Marża ({calc2Units.marginPercent}%):</span>
                  <span className="font-mono">{formatCurrency(calc2Units.marginNet)}</span>
                </div>
              </div>
            </div>

            {/* 3 jednostki - Multi Split 3x */}
            <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Multi-Split 3x
                </span>
                <Badge variant="outline" className="text-xs font-mono">3 pokoje</Badge>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-foreground">
                  {formatCurrency(calc3Units.totalSalePriceNet)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  brutto (VAT 8%): <span className="font-semibold">{formatCurrency(calc3Units.totalSalePriceNet * 1.08)}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-border/60 text-xs space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Koszt ekipy:</span>
                  <span className="font-mono">{formatCurrency(calc3Units.totalCrewCostNet)}</span>
                </div>
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                  <span>Marża ({calc3Units.marginPercent}%):</span>
                  <span className="font-mono">{formatCurrency(calc3Units.marginNet)}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sekcja 1: Na każdą jednostkę wewnętrzną */}
      {renderSectionTable(
        indoorUnitItems,
        "PER_INDOOR_UNIT",
        "Pozycje na każdą jednostkę wewnętrzną (pomieszczenie)",
        "Ilości tych pozycji są automatycznie mnożone przez liczbę jednostek wewnętrznych w zestawie (np. 1 dla Single, 2 dla Dual, 3 dla Trial).",
        <Home className="h-4 w-4" />,
        ratePerIndoorUnitNet
      )}

      {/* Sekcja 2: Na całą instalację (układ) */}
      {renderSectionTable(
        installationItems,
        "PER_INSTALLATION",
        "Pozycje ryczałtowe na cały układ (instalację)",
        "Pozycje jednorazowe, występujące raz w całym montażu niezależnie od liczby pokoi (np. zasilanie elektryczne, uruchomienie, podstawa agregatu).",
        <Wrench className="h-4 w-4" />,
        ratePerInstallationNet
      )}

      {/* Dialog dodawania pozycji z cennika */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Dodaj pozycję do:{" "}
              {selectedMultiplierForAdd === "PER_INDOOR_UNIT"
                ? "Na jednostkę wewnętrzną"
                : "Na cały układ"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Szukaj po nazwie pozycji..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-9 px-3 rounded-md border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="ALL">Wszystkie kategorie</option>
                {availableCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto border rounded-lg border-border divide-y divide-border">
            {unconfiguredPriceItems.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Brak pasujących pozycji cennika do dodania.
              </div>
            ) : (
              unconfiguredPriceItems.map((item) => {
                const currentVersion = item.versions.find((v) => v.isCurrent) ?? item.versions[0];
                const salePrice = currentVersion?.salePriceNet != null ? Number(currentVersion.salePriceNet) : 0;
                const crewCost = currentVersion?.crewCostNet != null ? Number(currentVersion.crewCostNet) : 0;

                return (
                  <div
                    key={item.id}
                    className="p-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-0.5 max-w-[70%]">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground">{item.name}</span>
                        {item.category && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {item.category}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3">
                        <span>Jedn: <strong className="font-mono">{item.unit}</strong></span>
                        <span>Cena sprzedaży: <strong className="font-mono text-foreground">{formatCurrency(salePrice)}</strong></span>
                        <span>Koszt ekipy: <strong className="font-mono">{formatCurrency(crewCost)}</strong></span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAddItem(item.id, 1)}
                      className="h-8 gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Dodaj
                    </Button>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="ghost" size="sm" onClick={() => setIsAddDialogOpen(false)}>
              Zamknij
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
