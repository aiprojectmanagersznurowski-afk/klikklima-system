"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Plus,
  FileUp,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Tag,
  DollarSign,
  Package,
} from "lucide-react"
import type { Role } from "@klikklima/contracts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatusPill } from "@/components/ui/status-pill"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  createPriceListItemSchema,
  updatePriceSchema,
  type CreatePriceListItemInput,
  type UpdatePriceInput,
} from "../../../../lib/pricing/pricing-schema"
import {
  createPriceListItemAction,
  updatePriceAction,
  togglePriceListItemActiveAction,
  importPriceListAction,
} from "./actions"

export type PricingItemWithVersion = {
  id: string
  name: string
  unit: string
  scope: string
  category: string | null
  description: string | null
  isActive: boolean
  versions: {
    id: string
    salePriceNet: any
    crewCostNet: any
    isCurrent: boolean
  }[]
}

export type PricingSettingsClientProps = {
  items: PricingItemWithVersion[]
  actorRole: Role
}

function formatPrice(val: number | string | null | undefined): string {
  if (val === null || val === undefined) return "brak danych"
  const num = typeof val === "number" ? val : Number(val)
  if (Number.isNaN(num)) return "brak danych"
  return `${num.toFixed(2).replace(".", ",")} zł`
}

const CATEGORY_LABELS: Record<string, string> = {
  MATERIAL: "Materiał",
  LABOR: "Robocizna",
  MATERIAL_LABOR: "Materiał + Robocizna",
}

const SCOPE_LABELS: Record<string, string> = {
  ROOM: "Pomieszczenie",
  INSTALLATION: "Instalacja (ogólne)",
}

export function PricingSettingsClient({ items, actorRole }: PricingSettingsClientProps) {
  const isAdmin = actorRole === "admin"
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Dialog edycji ceny
  const [editingItem, setEditingItem] = useState<PricingItemWithVersion | null>(null)
  // Dialog dodawania pozycji
  const [isAddOpen, setIsAddOpen] = useState(false)
  // Dialog importu CSV
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [csvFileContent, setCsvFileContent] = useState<string>("")

  // Formularz edycji ceny
  const editForm = useForm<UpdatePriceInput>({
    resolver: zodResolver(updatePriceSchema),
  })

  // Formularz dodania nowej pozycji
  const addForm = useForm<CreatePriceListItemInput>({
    resolver: zodResolver(createPriceListItemSchema),
    defaultValues: {
      unit: "szt",
      scope: "ROOM",
      category: "LABOR",
    },
  })

  const openEditDialog = (item: PricingItemWithVersion) => {
    setErrorMessage(null)
    setSuccessMessage(null)
    setEditingItem(item)
    const currentVer = item.versions[0]
    editForm.reset({
      itemId: item.id,
      salePriceNet: currentVer ? String(currentVer.salePriceNet) : "0.00",
      crewCostNet: currentVer && currentVer.crewCostNet !== null ? String(currentVer.crewCostNet) : "",
    })
  }

  const handleEditSubmit = (data: UpdatePriceInput) => {
    setErrorMessage(null)
    setSuccessMessage(null)
    startTransition(async () => {
      const res = await updatePriceAction(data)
      if (res.success) {
        setSuccessMessage("Zaktualizowano cenę pozycji.")
        setEditingItem(null)
      } else {
        setErrorMessage(res.error || "Błąd podczas zmiany ceny.")
      }
    })
  }

  const handleAddSubmit = (data: CreatePriceListItemInput) => {
    setErrorMessage(null)
    setSuccessMessage(null)
    startTransition(async () => {
      const res = await createPriceListItemAction(data)
      if (res.success) {
        setSuccessMessage("Dodano nową pozycję do cennika.")
        setIsAddOpen(false)
        addForm.reset()
      } else {
        setErrorMessage(res.error || "Błąd podczas tworzenia pozycji.")
      }
    })
  }

  const handleToggleActive = (itemId: string, currentActive: boolean) => {
    setErrorMessage(null)
    setSuccessMessage(null)
    startTransition(async () => {
      const res = await togglePriceListItemActiveAction({
        itemId,
        isActive: !currentActive,
      })
      if (res.success) {
        setSuccessMessage(!currentActive ? "Przywrócono pozycję." : "Wycofano pozycję.")
      } else {
        setErrorMessage(res.error || "Błąd podczas zmiany statusu.")
      }
    })
  }

  const handleImportSubmit = () => {
    if (!csvFileContent.trim()) {
      setErrorMessage("Wybierz plik CSV przed importem.")
      return
    }
    setErrorMessage(null)
    setSuccessMessage(null)
    startTransition(async () => {
      const res = await importPriceListAction(csvFileContent)
      if (res.success) {
        setSuccessMessage("Pomyślnie zaimportowano cennik.")
        setIsImportOpen(false)
        setCsvFileContent("")
      } else {
        setErrorMessage(res.error || "Błąd podczas importu cennika.")
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cennik wyceny</h1>
          <p className="text-sm text-muted-foreground">
            Zarządzanie katalogiem pozycji kosztorysowych, stawkami sprzedaży i kosztami ekipy.
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setErrorMessage(null)
                setIsImportOpen(true)
              }}
              disabled={isPending}
            >
              <FileUp className="w-4 h-4 mr-1.5" />
              Import CSV
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setErrorMessage(null)
                setIsAddOpen(true)
              }}
              disabled={isPending}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Dodaj pozycję
            </Button>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="p-3 text-sm rounded-lg bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3 text-sm rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="rounded-md border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b text-muted-foreground uppercase text-xs">
              <tr>
                <th className="px-4 py-3">Nazwa pozycji</th>
                <th className="px-4 py-3">Zasięg</th>
                <th className="px-4 py-3">Kategoria</th>
                <th className="px-4 py-3">Jedn.</th>
                <th className="px-4 py-3 text-right">Cena sprzedaży netto</th>
                <th className="px-4 py-3 text-right">Koszt ekipy netto</th>
                <th className="px-4 py-3 text-center">Status</th>
                {isAdmin && <th className="px-4 py-3 text-right">Akcje</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="px-4 py-8 text-center text-muted-foreground">
                    Brak pozycji w cenniku. Użyj przycisku &quot;Dodaj pozycję&quot; lub zaimportuj plik CSV.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const currentVer = item.versions[0]
                  const salePriceFormatted = currentVer
                    ? formatPrice(currentVer.salePriceNet)
                    : "brak ceny"
                  const crewCostFormatted = currentVer && currentVer.crewCostNet !== null
                    ? formatPrice(currentVer.crewCostNet)
                    : "brak danych"

                  return (
                    <tr
                      key={item.id}
                      className={item.isActive ? "hover:bg-muted/30" : "opacity-60 bg-muted/20"}
                    >
                      <td className="px-4 py-3 font-medium">
                        <div className="flex flex-col">
                          <span>{item.name}</span>
                          {item.description && (
                            <span className="text-xs text-muted-foreground line-clamp-1">
                              {item.description}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {SCOPE_LABELS[item.scope] || item.scope}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.category ? CATEGORY_LABELS[item.category] || item.category : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono">
                        {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right font-medium font-mono">
                        {salePriceFormatted}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                        {crewCostFormatted}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusPill
                          label={item.isActive ? "Aktywna" : "Wycofana"}
                          tone={item.isActive ? "info" : "neutral"}
                        />
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(item)}
                              disabled={isPending}
                              title="Zmień cenę"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span className="sr-only">Edytuj cenę</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleActive(item.id, item.isActive)}
                              disabled={isPending}
                              title={item.isActive ? "Wycofaj pozycję" : "Przywróć pozycję"}
                            >
                              {item.isActive ? (
                                <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                              )}
                              <span className="sr-only">
                                {item.isActive ? "Wycofaj" : "Przywróć"}
                              </span>
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialog zmiany ceny (AC3, AC5) */}
      <Dialog open={editingItem !== null} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zmiana ceny pozycji</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              <div className="text-sm font-medium">{editingItem.name}</div>
              <p className="text-xs text-muted-foreground">
                Każda zmiana kwoty tworzy nową wersję w cenniku. Ceny historyczne w istniejących
                ofertach pozostaną niezmienione.
              </p>

              <input type="hidden" {...editForm.register("itemId")} />

              <div className="space-y-1.5">
                <Label htmlFor="salePriceNet">Cena sprzedaży netto (zł) *</Label>
                <Input
                  id="salePriceNet"
                  placeholder="np. 140,50"
                  {...editForm.register("salePriceNet")}
                />
                {editForm.formState.errors.salePriceNet && (
                  <p className="text-xs text-destructive">
                    {editForm.formState.errors.salePriceNet.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="crewCostNet">Koszt ekipy netto (zł, opcjonalny)</Label>
                <Input
                  id="crewCostNet"
                  placeholder="np. 30,00 (puste = brak danych)"
                  {...editForm.register("crewCostNet")}
                />
                {editForm.formState.errors.crewCostNet && (
                  <p className="text-xs text-destructive">
                    {editForm.formState.errors.crewCostNet.message}
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingItem(null)}
                  disabled={isPending}
                >
                  Anuluj
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                  Zapisz nową cenę
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog dodawania nowej pozycji (AC6) */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nowa pozycja w cenniku</DialogTitle>
          </DialogHeader>
          <form onSubmit={addForm.handleSubmit(handleAddSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nazwa pozycji *</Label>
              <Input
                id="name"
                placeholder="np. Przejście przez ścianę żelbetową"
                {...addForm.register("name")}
              />
              {addForm.formState.errors.name && (
                <p className="text-xs text-destructive">{addForm.formState.errors.name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="unit">Jednostka *</Label>
                <select
                  id="unit"
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                  {...addForm.register("unit")}
                >
                  <option value="szt">szt</option>
                  <option value="mb">mb</option>
                  <option value="m">m</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="scope">Zasięg *</Label>
                <select
                  id="scope"
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                  {...addForm.register("scope")}
                >
                  <option value="ROOM">Pomieszczenie (ROOM)</option>
                  <option value="INSTALLATION">Instalacja ogólne (INSTALLATION)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category">Kategoria</Label>
              <select
                id="category"
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                {...addForm.register("category")}
              >
                <option value="LABOR">Robocizna (LABOR)</option>
                <option value="MATERIAL">Materiał (MATERIAL)</option>
                <option value="MATERIAL_LABOR">Materiał + Robocizna (MATERIAL_LABOR)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="add_salePriceNet">Cena sprzedaży netto (zł) *</Label>
                <Input
                  id="add_salePriceNet"
                  placeholder="np. 150,00"
                  {...addForm.register("salePriceNet")}
                />
                {addForm.formState.errors.salePriceNet && (
                  <p className="text-xs text-destructive">
                    {addForm.formState.errors.salePriceNet.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add_crewCostNet">Koszt ekipy netto (zł)</Label>
                <Input
                  id="add_crewCostNet"
                  placeholder="np. 40,00"
                  {...addForm.register("crewCostNet")}
                />
                {addForm.formState.errors.crewCostNet && (
                  <p className="text-xs text-destructive">
                    {addForm.formState.errors.crewCostNet.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Opis (opcjonalny)</Label>
              <Input
                id="description"
                placeholder="Dodatkowe informacje o pozycji"
                {...addForm.register("description")}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddOpen(false)}
                disabled={isPending}
              >
                Anuluj
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                Dodaj pozycję
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog importu CSV */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import cennika z pliku CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Wybierz plik CSV zawierający kolumny: item_name, unit, scope, sale_price_net,
              crew_cost_net, category, description.
            </p>
            <Input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  const reader = new FileReader()
                  reader.onload = (event) => {
                    setCsvFileContent((event.target?.result as string) || "")
                  }
                  reader.readAsText(file)
                }
              }}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsImportOpen(false)}
                disabled={isPending}
              >
                Anuluj
              </Button>
              <Button onClick={handleImportSubmit} disabled={isPending || !csvFileContent}>
                {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                Importuj
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
