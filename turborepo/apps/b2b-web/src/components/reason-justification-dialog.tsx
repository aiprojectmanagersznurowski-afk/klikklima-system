"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { deleteJustificationSchema } from "@/lib/audit/delete-justification-schema"

/**
 * SEC-AUDIT-LOG-MANUAL-STATUS (Fala B): wersja `DeleteJustificationDialog`
 * (`apps/b2b-web/src/components/delete-justification-dialog.tsx`) uproszczona
 * do samego pola uzasadnienia — bez wyboru podstawy prawnej, bo serwer
 * (`bypassLogisticsOrder`, `rollbackLogisticsOrder`) ustawia stałą
 * `legalBasis: 'OTHER'` po swojej stronie (D4 wariant (b), operator jej nie
 * wybiera). Próg `10` znaków po trim reużywa
 * `deleteJustificationSchema.shape.justification`, żeby walidacja klienta i
 * serwera nie mogły się rozjechać.
 */
const reasonOnlySchema = z.object({
  reason: deleteJustificationSchema.shape.justification,
})

type ReasonOnlyInput = z.infer<typeof reasonOnlySchema>

export function ReasonJustificationDialog({
  title,
  description,
  confirmLabel = "Potwierdź",
  pendingLabel = "Przetwarzanie...",
  placeholder = "Min. 10 znaków, opisz powód...",
  onConfirm,
  onClose,
  onSuccess,
}: {
  title: string
  description: React.ReactNode
  confirmLabel?: string
  pendingLabel?: string
  placeholder?: string
  onConfirm: (reason: string) => Promise<{ success: boolean; error?: string }>
  onClose: () => void
  onSuccess: () => void
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<ReasonOnlyInput>({
    resolver: zodResolver(reasonOnlySchema),
    mode: "onChange",
    defaultValues: {
      reason: "",
    },
  })

  const onSubmit = async (values: ReasonOnlyInput) => {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const result = await onConfirm(values.reason)
      if (!result.success) {
        setSubmitError(result.error ?? "Nie udało się wykonać akcji.")
        setIsSubmitting(false)
        return
      }
      onSuccess()
    } catch (e) {
      setSubmitError("Błąd podczas wykonywania akcji.")
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
            <label htmlFor="reason" className="text-sm font-medium text-foreground">
              Uzasadnienie <span className="text-destructive">*</span>
            </label>
            <textarea
              id="reason"
              rows={3}
              placeholder={placeholder}
              aria-invalid={!!errors.reason}
              className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary text-sm transition-shadow placeholder:text-muted-foreground aria-invalid:border-destructive aria-invalid:ring-destructive/20"
              {...register("reason")}
            />
            {errors.reason && (
              <p className="text-sm text-destructive font-medium">{errors.reason.message}</p>
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
            <Button type="submit" disabled={!isValid || isSubmitting} className="rounded-md">
              {isSubmitting ? pendingLabel : confirmLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
