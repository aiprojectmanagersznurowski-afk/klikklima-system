"use server"

import { prisma } from "@repo/database"
import { revalidatePath } from "next/cache"

export type CustomerSummary = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  createdAt: Date;
  leadsCount: number;
  installationsCount: number;
}

export async function getCustomers(): Promise<CustomerSummary[]> {
  const customers = await prisma.klienci.findMany({
    include: {
      leady: {
        include: {
          instalacje: true
        }
      },
    },
    orderBy: {
      created_at: 'desc',
    }
  });

  return customers.map(c => {
    let installationsCount = 0;
    c.leady.forEach(lead => {
      installationsCount += lead.instalacje.length;
    });

    return {
      id: c.id,
      name: c.imie_i_nazwisko || "Nieznany",
      email: c.email,
      phone: c.telefon,
      createdAt: c.created_at,
      leadsCount: c.leady.length,
      installationsCount,
    }
  });
}

export async function deleteCustomerAction(id: string) {
  // UWAGA: Twarde usunięcie klienta (tylko admin)
  // W Prisma dzięki onDelete: Cascade (jeśli jest) powiązane encje by zniknęły.
  // Jeśli nie ma cascade, musimy zrobić to ręcznie. 
  // Na razie polegamy na constraintach Prisma (np. setNull).
  await prisma.klienci.delete({
    where: { id }
  });

  revalidatePath('/customers');
}

export async function addCustomerAddress(klientId: string, ulicaMiasto: string) {
  await prisma.adresy.create({
    data: {
      klient_id: klientId,
      ulica_miasto: ulicaMiasto
    }
  });
  
  revalidatePath(`/customers/${klientId}`);
}
