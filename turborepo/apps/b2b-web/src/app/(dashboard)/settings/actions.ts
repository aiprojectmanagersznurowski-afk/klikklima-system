"use server"

import { prisma } from "@repo/database"
import { revalidatePath } from "next/cache"

export async function addAuthorizedUser(email: string, role: string) {
  try {
    if (!email) {
      return { success: false, error: "Email jest wymagany" }
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
