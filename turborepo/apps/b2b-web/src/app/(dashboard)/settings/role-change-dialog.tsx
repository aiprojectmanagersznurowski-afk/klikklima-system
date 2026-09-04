"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AUDIT_REQUIREMENTS, ROLES, type Role } from "@klikklima/contracts"
import {
  roleChangeSchema,
  type RoleChangeInput,
} from "@/lib/audit/role-change-schema"
import type { UpdateAuthorizedUserRoleResult } from "./actions"

/**
 * SEC-AUDIT-LOG-ROLE-CHANGE (AC13): dialog zmiany roli konta `authorized_users`.
 * Kopiuje wzorzec `DeleteJustificationDialog` (react-hook-form + zodResolver, uzasadnienie
 * i podstawa prawna) i dokłada pole `role` — jedyne pole, którego tamten wzorzec nie ma.
 * Docelowa rola pochodzi WYŁĄCZNIE ze słownika `ROLES` z `@klikklima/contracts` (jedno
 * źródło prawdy, ADR-002 / SEC-AUTHZ-USER-MGMT) — obecna rola użytkownika jest wykluczona
 * z listy wyboru, bo "zmiana na tę samą rolę" nie ma sensu w UI (serwer i tak obsłuży
 * to jako no-op, patrz `updateAuthorizedUserRoleAction`).
 */
export function RoleChangeDialog({
  userEmail,
  currentRole,
  onConfirm,
  onClose,
  onSuccess,
}: {
  userEmail: string
  currentRole: string
  onConfirm: (values: RoleChangeInput) => Promise<UpdateAuthorizedUserRoleResult>
  onClose: () => void
  onSuccess: (result: UpdateAuthorizedUserRoleResult) => void
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const availableRoles = (ROLES as readonly Role[]).filter((role) => role !== currentRole)

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<RoleChangeInput>({
    resolver: zodResolver(roleChangeSchema),
    mode: "onChange",
    defaultValues: {
      role: undefined,
      justification: "",
      legalBasis: undefined,
    },
  })

  const onSubmit = async (values: RoleChangeInput) => {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const result = await onConfirm(values)
      if (!result.success) {
        setSubmitError(result.error ?? "Nie udało się zmienić roli konta.")
        setIsSubmitting(false)
        return
      }
      onSuccess(result)
    } catch (e) {
      setSubmitError("Błąd podczas zmiany roli konta.")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="relative z-50 w-full max-w-md bg-card rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Zmień rolę konta</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Zmiana roli konta <span className="font-medium text-foreground">{userEmail}</span>. Operacja jest
            rejestrowana w dzienniku audytu.
          </p>

          <div className="space-y-1.5">
            <label htmlFor="role" className="text-sm font-medium text-foreground">
              Nowa rola <span className="text-destructive">*</span>
            </label>
            <select
              id="role"
              defaultValue=""
              aria-invalid={!!errors.role}
              className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary text-sm transition-shadow aria-invalid:border-destructive aria-invalid:ring-destructive/20"
              {...register("role")}
            >
              <option value="" disabled>
                Wybierz nową rolę...
              </option>
              {availableRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            {errors.role && (
              <p className="text-sm text-destructive font-medium">{errors.role.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="justification" className="text-sm font-medium text-foreground">
              Uzasadnienie <span className="text-destructive">*</span>
            </label>
            <textarea
              id="justification"
              rows={3}
              placeholder="Min. 10 znaków, np. zmiana zakresu obowiązków, awans, błędnie nadana rola..."
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
            <Button type="submit" disabled={!isValid || isSubmitting} className="rounded-md">
              {isSubmitting ? "Zapisywanie..." : "Zmień rolę"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
