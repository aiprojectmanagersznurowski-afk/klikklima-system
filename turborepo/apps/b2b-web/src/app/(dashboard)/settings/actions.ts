"use server"

import { prisma } from "@repo/database"
import type { LegalDocumentKind } from "@repo/database"
import { revalidatePath } from "next/cache"
import { can, ROLES } from "@klikklima/contracts"
import { getCurrentActorRole, getCurrentUser } from "../../../utils/supabase/server"
import { deleteJustificationSchema, type DeleteJustificationInput } from "../../../lib/audit/delete-justification-schema"
import { roleChangeSchema } from "../../../lib/audit/role-change-schema"

/**
 * SEC-AUTHZ-USER-MGMT: `role` tutaj to dana WEJŚCIOWA nowego konta (kogo dodajemy
 * i z jaką rolą), nigdy tożsamość WYWOŁUJĄCEGO — ta idzie wyłącznie z sesji
 * (getCurrentActorRole), tak jak w auditors/actions.ts i crews/actions.ts. Bramka
 * autoryzacji musi wykonać się PRZED jakimkolwiek zapytaniem do Prismy (fail-closed),
 * a nieznana wartość `role` (spoza ROLES) jest odrzucana jako błąd walidacji danych,
 * niezależnie od uprawnień wywołującego.
 */
export async function addAuthorizedUser(email: string, role: string) {
  try {
    const actorRole = await getCurrentActorRole()
    if (!actorRole || can(actorRole, 'authorized_users', 'create') !== 'yes') {
      return { success: false, error: "Brak uprawnień do dodania konta." }
    }

    if (!email) {
      return { success: false, error: "Email jest wymagany" }
    }

    if (!(ROLES as readonly string[]).includes(role)) {
      return { success: false, error: "Nieprawidłowa rola." }
    }

    await prisma.authorizedUser.create({
      data: {
        email,
        role
      }
    })

    revalidatePath("/settings")
    return { success: true }
  } catch (error: any) {
    if (error.code === 'P2002') {
      return { success: false, error: "Ten email został już dodany." }
    }
    console.error("Failed to add user:", error)
    return { success: false, error: "Wystąpił błąd podczas dodawania konta." }
  }
}

export type CreateLegalDocumentVersionDraftResult = {
  success: boolean
  error?: string
  id?: string
  versionNo?: number
}

/**
 * FLD-LEGAL-DOC-VERSION: szkic nowej wersji dokumentu prawnego (zgoda RODO / regulamin
 * pracowniczy). Numer wersji (`versionNo`) to MAX(versionNo)+1 w obrębie `documentKind`,
 * liczone WEWNĄTRZ jednej transakcji — dwa równoległe utworzenia szkicu nie mogą dostać
 * tego samego numeru (dziś brak sekwencji DB, WO FLD-CONSENT-DOCS). Szkic nigdy nie
 * powstaje jako obowiązujący ani opublikowany — wersjonowanie zaczyna się od publikacji
 * (publishLegalDocumentVersionAction), nie od zapisu roboczego.
 */
export async function createLegalDocumentVersionDraftAction(
  documentKind: string,
  content: string
): Promise<CreateLegalDocumentVersionDraftResult> {
  const actorRole = await getCurrentActorRole()
  if (!actorRole || can(actorRole, 'legal_document_versions', 'create') !== 'yes') {
    return { success: false, error: "Brak uprawnień do utworzenia wersji dokumentu." }
  }

  const LEGAL_DOCUMENT_KINDS: readonly string[] = ['RODO_CONSENT', 'EMPLOYEE_TERMS']
  if (!LEGAL_DOCUMENT_KINDS.includes(documentKind)) {
    return { success: false, error: "Nieprawidłowy rodzaj dokumentu." }
  }

  if (!content || content.trim().length === 0) {
    return { success: false, error: "Treść dokumentu jest wymagana." }
  }

  const kind = documentKind as LegalDocumentKind

  try {
    const created = await prisma.$transaction(async (tx) => {
      const last = await tx.legalDocumentVersion.findFirst({
        where: { documentKind: kind },
        orderBy: { versionNo: 'desc' },
      })

      const versionNo = (last?.versionNo ?? 0) + 1

      return tx.legalDocumentVersion.create({
        data: {
          documentKind: kind,
          content,
          versionNo,
          publishedAt: null,
          isCurrent: false,
        },
      })
    })

    revalidatePath('/settings')
    return { success: true, id: created.id, versionNo: created.versionNo }
  } catch (error) {
    console.error("Failed to create legal document version draft:", error)
    return { success: false, error: "Wystąpił błąd podczas tworzenia szkicu wersji dokumentu." }
  }
}

export type UpdateLegalDocumentVersionDraftResult = { success: boolean; error?: string }

/**
 * FLD-LEGAL-DOC-VERSION: edycja treści szkicu. Prawdziwym strażnikiem niezmienności
 * opublikowanej wersji jest wyzwalacz `legal_document_versions_freeze_published_trg`
 * w bazie (AC1/AC2) — ta akcja jest dodatkową warstwą obrony: odrzuca próbę edycji
 * już opublikowanej wersji (`publishedAt !== null`) przed wysłaniem jakiegokolwiek
 * zapytania update.
 */
export async function updateLegalDocumentVersionDraftAction(
  versionId: string,
  content: string
): Promise<UpdateLegalDocumentVersionDraftResult> {
  const actorRole = await getCurrentActorRole()
  if (!actorRole || can(actorRole, 'legal_document_versions', 'update') !== 'yes') {
    return { success: false, error: "Brak uprawnień do edycji wersji dokumentu." }
  }

  const version = await prisma.legalDocumentVersion.findUnique({ where: { id: versionId } })
  if (!version) {
    return { success: false, error: "Wersja dokumentu nie została znaleziona." }
  }

  if (version.publishedAt !== null) {
    return { success: false, error: "Nie można edytować już opublikowanej wersji." }
  }

  await prisma.legalDocumentVersion.update({
    where: { id: versionId },
    data: { content },
  })

  revalidatePath('/settings')
  return { success: true }
}

export type PublishLegalDocumentVersionResult = { success: boolean; error?: string }

/**
 * FLD-LEGAL-DOC-VERSION: publikacja wersji jako obowiązującej dla danego rodzaju
 * dokumentu. Kolejność w transakcji ma znaczenie (AC2/AC4): najpierw zdjęcie
 * `isCurrent` z poprzednio obowiązującej wersji TEGO SAMEGO rodzaju (częściowy indeks
 * unikalny w bazie jest sprawdzany na bieżąco, nie dopiero przy commit), dopiero potem
 * ustawienie nowej wersji jako obowiązującej wraz z `publishedAt`. `updateMany` na
 * starej wersji wysyła wyłącznie `{ isCurrent: false }` — ta wersja jest już
 * opublikowana, więc wyzwalacz freeze odrzuciłby próbę zmiany czegokolwiek innego.
 */
export async function publishLegalDocumentVersionAction(
  versionId: string
): Promise<PublishLegalDocumentVersionResult> {
  const actorRole = await getCurrentActorRole()
  if (!actorRole || can(actorRole, 'legal_document_versions', 'update') !== 'yes') {
    return { success: false, error: "Brak uprawnień do publikacji wersji dokumentu." }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const version = await tx.legalDocumentVersion.findUnique({ where: { id: versionId } })
      if (!version) {
        return { success: false, error: "Wersja dokumentu nie została znaleziona." }
      }

      await tx.legalDocumentVersion.updateMany({
        where: {
          documentKind: version.documentKind,
          isCurrent: true,
          NOT: { id: versionId },
        },
        data: { isCurrent: false },
      })

      await tx.legalDocumentVersion.update({
        where: { id: versionId },
        data: { isCurrent: true, publishedAt: version.publishedAt ?? new Date() },
      })

      return { success: true }
    })

    if (result.success) {
      revalidatePath('/settings')
    }

    return result
  } catch (error) {
    console.error("Failed to publish legal document version:", error)
    return { success: false, error: "Wystąpił błąd podczas publikacji wersji dokumentu." }
  }
}

export async function deleteAuthorizedUser(
  id: string,
  input: DeleteJustificationInput
) {
  let actorRole
  try {
    actorRole = await getCurrentActorRole()
  } catch (error) {
    console.error("Failed to resolve actor role:", error)
    return { success: false, error: "Brak uprawnień do usunięcia konta." }
  }
  if (!actorRole || can(actorRole, 'authorized_users', 'delete') !== 'yes') {
    return { success: false, error: "Brak uprawnień do usunięcia konta." }
  }

  let actorEmail: string | undefined
  try {
    const {
      data: { user },
    } = await getCurrentUser()
    actorEmail = user?.email
  } catch (error) {
    console.error("Failed to resolve actor email:", error)
    return { success: false, error: "Brak uprawnień do usunięcia konta." }
  }
  if (!actorEmail) {
    return { success: false, error: "Brak uprawnień do usunięcia konta." }
  }

  const parsed = deleteJustificationSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: "Nieprawidłowe dane uzasadnienia lub podstawy prawnej." }
  }
  const { justification, legalBasis } = parsed.data

  try {
    await prisma.$transaction(async (tx) => {
      await tx.authorizedUser.delete({
        where: { id }
      })
      await tx.auditLog.create({
        data: {
          operation: 'delete',
          resource: 'authorized_users',
          recordId: id,
          actorEmail,
          actorRole,
          justification,
          legalBasis,
        },
      })
    })

    revalidatePath("/settings")
    return { success: true }
  } catch (error) {
    console.error("Failed to delete user:", error)
    return { success: false, error: "Wystąpił błąd podczas usuwania konta." }
  }
}

export type UpdateAuthorizedUserRoleResult = { success: boolean; error?: string; changed?: boolean }
export type UpdateAuthorizedUserRoleInput = { role: string; justification: string; legalBasis: string }

/**
 * SEC-AUDIT-LOG-ROLE-CHANGE: sentinel odróżniający odmowę z powodu ochrony ostatniego
 * konta `admin` (D3, ochrona WĄSKA) od innych błędów transakcji — złapany wyłącznie
 * w zewnętrznym catch tej akcji, nigdy nie ucieka poza nią.
 */
class LastAdminError extends Error {}

/**
 * SEC-AUDIT-LOG-ROLE-CHANGE: zmiana roli istniejącego konta `authorized_users`.
 * Kolejność: bramka RBAC (fail-closed) -> tożsamość wywołującego z sesji -> walidacja
 * Zod (`roleChangeSchema`, rozszerzenie `deleteJustificationSchema`, AC15) -> jedna
 * transakcja Serializable: odczyt konta docelowego PO ID (AC20), no-op bez zapisu gdy
 * rola się nie zmienia (AC9/AC10), ochrona ostatniego admina liczona WEWNĄTRZ transakcji
 * (AC7/AC8/AC17), update roli, wpis audytowy z prefiksem stara -> nowa rola doklejonym
 * PRZED tekstem operatora (D2, AC19) bez naruszania progu 10 znaków liczonego od
 * surowego tekstu operatora.
 */
export async function updateAuthorizedUserRoleAction(
  id: string,
  input: UpdateAuthorizedUserRoleInput
): Promise<UpdateAuthorizedUserRoleResult> {
  let actorRole
  try {
    actorRole = await getCurrentActorRole()
  } catch (error) {
    console.error("Failed to resolve actor role:", error)
    return { success: false, error: "Brak uprawnień do zmiany roli konta." }
  }
  if (!actorRole || can(actorRole, 'authorized_users', 'update') !== 'yes') {
    return { success: false, error: "Brak uprawnień do zmiany roli konta." }
  }

  let actorEmail: string | undefined
  try {
    const {
      data: { user },
    } = await getCurrentUser()
    actorEmail = user?.email
  } catch (error) {
    console.error("Failed to resolve actor email:", error)
    return { success: false, error: "Brak uprawnień do zmiany roli konta." }
  }
  if (!actorEmail) {
    return { success: false, error: "Brak uprawnień do zmiany roli konta." }
  }

  const parsed = roleChangeSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: "Nieprawidłowe dane zmiany roli." }
  }
  const { role: nextRole, justification, legalBasis } = parsed.data

  try {
    const result = await prisma.$transaction(async (tx) => {
      const target = await tx.authorizedUser.findUnique({ where: { id } })
      if (!target) {
        return { success: false, error: "Konto nie zostało znalezione." }
      }

      if (target.role === nextRole) {
        return { success: true, changed: false, error: "Rola konta nie uległa zmianie." }
      }

      if (target.role === 'admin') {
        const adminCount = await tx.authorizedUser.count({ where: { role: 'admin' } })
        if (adminCount <= 1) {
          throw new LastAdminError("Nie można odebrać roli jedynemu kontu administratora.")
        }
      }

      await tx.authorizedUser.update({
        where: { id },
        data: { role: nextRole },
      })

      await tx.auditLog.create({
        data: {
          operation: 'role_change',
          resource: 'authorized_users',
          recordId: id,
          actorEmail,
          actorRole,
          justification: `${target.role} → ${nextRole} | ${justification}`,
          legalBasis,
        },
      })

      return { success: true, changed: true }
    }, { isolationLevel: 'Serializable' })

    if (result.success) {
      revalidatePath('/settings')
    }
    return result
  } catch (error) {
    if (error instanceof LastAdminError) {
      return { success: false, error: "Nie można odebrać roli jedynemu kontu administratora." }
    }
    console.error("Failed to update user role:", error)
    return { success: false, error: "Wystąpił błąd podczas zmiany roli konta." }
  }
}
