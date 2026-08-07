"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@repo/database"

export type AuditorSummary = {
  id: string;
  imie_i_nazwisko: string;
  telefon: string | null;
  email: string | null;
  certyfikat_fgaz: string | null;
  fgaz_valid_until: Date | null;
  uprawnienia_sep: boolean;
  max_promien_dojazdu_km: number | null;
  preferowane_marki: string[];
  leadsCount: number;
}

export async function getAuditors(): Promise<AuditorSummary[]> {
  const auditors = await prisma.audytorzy.findMany({
    include: {
      leady: true
    },
    orderBy: {
      imie_i_nazwisko: 'asc'
    }
  });

  return auditors.map(a => ({
    id: a.id,
    imie_i_nazwisko: a.imie_i_nazwisko,
    telefon: a.telefon,
    email: a.email,
    certyfikat_fgaz: a.certyfikat_fgaz,
    fgaz_valid_until: a.fgaz_valid_until,
    uprawnienia_sep: a.uprawnienia_sep,
    max_promien_dojazdu_km: a.max_promien_dojazdu_km,
    preferowane_marki: a.preferowane_marki,
    leadsCount: a.leady.length
  }));
}

export async function deleteAuditorAction(id: string) {
  await prisma.audytorzy.delete({
    where: { id }
  });
  revalidatePath('/auditors');
}
