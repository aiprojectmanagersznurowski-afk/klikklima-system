"use server"

import { prisma } from "@repo/database"
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
