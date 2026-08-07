"use server"

import { prisma } from "@repo/database"
import { revalidatePath } from "next/cache"

export type CrewSummary = {
  id: string;
  nazwa: string;
  telefon_kontaktowy: string | null;
  koordynator_imie_nazwisko: string | null;
  certyfikat_fgaz: string | null;
  uprawnienia_sep: boolean;
  promien_dzialania_km: number | null;
  liczba_brygad: number;
  aktywny: boolean;
  installationsCount: number;
  zdjecie_url: string | null;
}

export async function getCrews(): Promise<CrewSummary[]> {
  const crews = await prisma.zespoly_monterskie.findMany({
    include: {
      instalacje: {
        where: {
          status: 'COMPLETED'
        }
      }
    },
    orderBy: {
      nazwa: 'asc'
    }
  });

  return crews.map(c => ({
    id: c.id,
    nazwa: c.nazwa,
    telefon_kontaktowy: c.telefon_kontaktowy,
    koordynator_imie_nazwisko: c.koordynator_imie_nazwisko,
    certyfikat_fgaz: c.certyfikat_fgaz,
    uprawnienia_sep: c.uprawnienia_sep,
    promien_dzialania_km: c.promien_dzialania_km,
    liczba_brygad: c.liczba_brygad,
    aktywny: c.aktywny,
    installationsCount: c.instalacje.length,
    zdjecie_url: c.zdjecie_url
  }));
}

export async function updateCrewAvatar(crewId: string, path: string) {
  await prisma.zespoly_monterskie.update({
    where: { id: crewId },
    data: { zdjecie_url: path }
  });
  revalidatePath('/crews');
}

export async function deleteCrewAction(id: string) {
  await prisma.zespoly_monterskie.delete({
    where: { id }
  });
  revalidatePath('/crews');
}
