"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createCustomerAction } from "./actions"
import { createCustomerSchema, type CreateCustomerFormValues } from "./create-customer-schema"

export function CreateCustomerDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<CreateCustomerFormValues>({
    resolver: zodResolver(createCustomerSchema),
    mode: "onChange",
    defaultValues: {
      imieINazwisko: "",
      email: "",
      telefon: "",
    },
  })

  const onSubmit = async (values: CreateCustomerFormValues) => {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const result = await createCustomerAction(values)
      if (!result.success) {
        setSubmitError(result.error ?? "Nie udało się dodać klienta.")
        setIsSubmitting(false)
        return
      }
      setSuccess(true)
      router.refresh()
      setTimeout(() => {
        onClose()
      }, 800)
    } catch (e) {
      setSubmitError("Błąd podczas dodawania klienta.")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="relative z-50 w-full max-w-md bg-card rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Dodaj klienta</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="imieINazwisko" className="text-sm font-medium text-foreground">
              Imię i nazwisko <span className="text-destructive">*</span>
            </label>
            <input
              id="imieINazwisko"
              type="text"
              placeholder="np. Jan Kowalski"
              aria-invalid={!!errors.imieINazwisko}
              className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary text-sm transition-shadow placeholder:text-muted-foreground aria-invalid:border-destructive aria-invalid:ring-destructive/20"
              {...register("imieINazwisko")}
            />
            {errors.imieINazwisko && (
              <p className="text-sm text-destructive font-medium">{errors.imieINazwisko.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              placeholder="jan.kowalski@example.com"
              aria-invalid={!!errors.email}
              className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary text-sm transition-shadow placeholder:text-muted-foreground aria-invalid:border-destructive aria-invalid:ring-destructive/20"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-destructive font-medium">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="telefon" className="text-sm font-medium text-foreground">
              Telefon
            </label>
            <input
              id="telefon"
              type="text"
              placeholder="np. 600 100 200"
              aria-invalid={!!errors.telefon}
              className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary text-sm transition-shadow placeholder:text-muted-foreground aria-invalid:border-destructive aria-invalid:ring-destructive/20"
              {...register("telefon")}
            />
            {errors.telefon && (
              <p className="text-sm text-destructive font-medium">{errors.telefon.message}</p>
            )}
          </div>

          {submitError && (
            <p className="text-sm text-destructive font-medium" role="alert">{submitError}</p>
          )}
          {success && (
            <p className="text-sm font-medium text-foreground" role="status">Klient został dodany.</p>
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
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {isSubmitting ? "Dodawanie..." : "Dodaj klienta"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
