"use server";

import { unstable_noStore as noStore } from 'next/cache';
import { supabase } from "@/lib/supabaseClient";
import { getAdminClient } from "../../lib/supabaseAdminClient";
import { getStandardInstallationPriceNetto } from "../../lib/pricing/standard-installation-service";

export async function getLowestPriceForIndoorUnit(seriesName: string) {
  noStore();
  try {
    const { data: set, error } = await supabase
      .from('available_combinations')
      .select('total_price')
      .eq('series_name', seriesName)
      .order('total_price', { ascending: true })
      .limit(1)
      .single();

    if (error || !set) {
        return null;
    }

    // Get install price — cennik_uslug nie ma polityki anon SELECT (D-R1, migracja
    // 20260929100000_b2c_rls_public_catalog.sql), więc wymaga dedykowanego klienta serwisowego.
    try {
      await getAdminClient()
        .from('cennik_uslug')
        .select('koszt_b2c_netto')
        .eq('nazwa_uslugi', 'Montaż wzorcowy')
        .single();
    } catch {
      // Ignorujemy błędy odpytania legacy
    }
    
    // Dynamiczna wycena montażu standardowego dla 1 jednostki (Split 1:1)
    // @REQ: B2C-PRICE-FROM
    const baseInstall = await getStandardInstallationPriceNetto(1);
    
    return set.total_price + baseInstall; // Netto (equipment + 1 install)
  } catch (error) {
    console.error("Error fetching lowest price:", error);
    return null;
  }
}
