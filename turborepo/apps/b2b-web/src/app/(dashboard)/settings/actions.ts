"use server"

import { prisma } from "@repo/database"
import type { LegalDocumentKind } from "@repo/database"
import { revalidatePath } from "next/cache"
import { can, ROLES } from "@klikklima/contracts"
import { getCurrentActorRole } from "../../../utils/supabase/server"

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

export async function deleteAuthorizedUser(id: string) {
  try {
    const actorRole = await getCurrentActorRole()
    if (!actorRole || can(actorRole, 'authorized_users', 'delete') !== 'yes') {
      return { success: false, error: "Brak uprawnień do usunięcia konta." }
    }

    await prisma.authorizedUser.delete({
      where: { id }
    })

    revalidatePath("/settings")
    return { success: true }
  } catch (error) {
    console.error("Failed to delete user:", error)
    return { success: false, error: "Wystąpił błąd podczas usuwania konta." }
  }
}
