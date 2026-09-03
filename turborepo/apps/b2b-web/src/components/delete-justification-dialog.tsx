"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AUDIT_REQUIREMENTS } from "@klikklima/contracts"
import {
  deleteJustificationSchema,
  type DeleteJustificationInput,
  type DeleteActionResult,
} from "@/lib/audit/delete-justification-schema"

/**
 * SEC-AUDIT-LOG-DELETE: dialog uzasadnienia usunięcia, współdzielony przez
 * wszystkie moduły panelu B2B (leads, installations, incidents, services,
 * logistics, settings/authorized_users). Zastępuje `window.confirm()` —
 * AC12. Wzorowany na `AnonymizeClientModal`
 * (`apps/b2b-web/src/app/(dashboard)/customers/customers-client.tsx`),
 * którego kształtu (react-hook-form + zodResolver, brak preselekcji
 * `legalBasis`) nie duplikuje ręcznie.
 */
export function DeleteJustificationDialog({
  title,
  description,
  confirmLabel = "Usuń",
  pendingLabel = "Usuwanie...",
  onConfirm,
  onClose,
  onSuccess,
}: {
  title: string
  description: React.ReactNode
  confirmLabel?: string
  pendingLabel?: string
  onConfirm: (values: DeleteJustificationInput) => Promise<DeleteActionResult>
  onClose: () => void
  onSuccess: () => void
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<DeleteJustificationInput>({
    resolver: zodResolver(deleteJustificationSchema),
    mode: "onChange",
    defaultValues: {
      justification: "",
      // Brak domyślnej podstawy prawnej — operator musi ją świadomie wybrać
      // (SEC-AUDIT-LOG-DELETE, wzorem CLIENT-ANONYMIZATION-RODO).
      legalBasis: undefined,
    },
  })

  const onSubmit = async (values: DeleteJustificationInput) => {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const result = await onConfirm(values)
      if (!result.success) {
        setSubmitError(result.error ?? "Nie udało się usunąć rekordu.")
        setIsSubmitting(false)
        return
      }
      onSuccess()
    } catch (e) {
      setSubmitError("Błąd podczas usuwania rekordu.")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="relative z-50 w-full max-w-md bg-card rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">{description}</p>

          <div className="space-y-1.5">
            <label htmlFor="justification" className="text-sm font-medium text-foreground">
              Uzasadnienie <span className="text-destructive">*</span>
            </label>
            <textarea
              id="justification"
              rows={3}
              placeholder="Min. 10 znaków, np. żądanie klienta, błędny wpis testowy..."
              aria-invalid={!!errors.justification}
              className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary text-sm transition-shadow placeholder:text-muted-foreground aria-invalid:border-destructive aria-invalid:ring-destructive/20"
              {...register("justification")}
            />
            {errors.justification && (
              <p className="text-sm text-destructive font-medium">{errors.justification.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="legalBasis" className="text-sm font-medium text-foreground">
              Podstawa prawna <span className="text-destructive">*</span>
            </label>
            <select
              id="legalBasis"
              defaultValue=""
              aria-invalid={!!errors.legalBasis}
              className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary text-sm transition-shadow aria-invalid:border-destructive aria-invalid:ring-destructive/20"
              {...register("legalBasis")}
            >
              <option value="" disabled>
                Wybierz podstawę prawną...
              </option>
              {AUDIT_REQUIREMENTS.legalBases.map((basis) => (
                <option key={basis} value={basis}>
                  {basis}
                </option>
              ))}
            </select>
            {errors.legalBasis && (
              <p className="text-sm text-destructive font-medium">{errors.legalBasis.message}</p>
            )}
          </div>

          {submitError && (
            <p className="text-sm text-destructive font-medium" role="alert">{submitError}</p>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 text-sm font-medium text-foreground bg-background border border-input rounded-md hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
            >
              Anuluj
            </button>
            <Button type="submit" variant="destructive" disabled={!isValid || isSubmitting} className="rounded-md">
              {isSubmitting ? pendingLabel : confirmLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
