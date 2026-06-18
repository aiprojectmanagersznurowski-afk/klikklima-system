"use server";

import { supabase } from "@/lib/supabaseClient";

export interface BestsellerProduct {
  id: string;
  brand: string;
  brandLogo: string;
  model: string;
  power: string;
  img: string;
  deviceNettoPrice: number;
  installNettoPrice: number;
  tag?: string;
}

export async function getBestsellers(): Promise<BestsellerProduct[]> {
  try {
    // 1. Pobieramy urządzenia
    // Możemy przefiltrować po is_bestseller albo po prostu wziąć kilka pierwszych wew_single
    const { data: devices, error: devError } = await supabase
      .from('urzadzenia')
      .select('*')
      .eq('typ', 'wew_single')
      .limit(4);

    if (devError) throw devError;

    // 2. Pobieramy cenę montażu wzorcowego z cennika
    const { data: cennik, error: cenError } = await supabase
      .from('cennik_uslug')
      .select('koszt_b2c_netto')
      .eq('nazwa_uslugi', 'Montaż wzorcowy')
      .single();

    const installNetto = cennik ? Number(cennik.koszt_b2c_netto) : 1500;

    // 3. Mapujemy do interfejsu BestsellerProduct
    const products: BestsellerProduct[] = (devices || []).map((d: any) => {
      // Skrót loga (Fuji Electric -> FE, Haier -> HA)
      const brandLogo = d.producent === 'Fuji Electric' ? 'FE' 
        : d.producent === 'Haier' ? 'HA' 
        : d.producent.substring(0, 2).toUpperCase();

      return {
        id: d.id,
        brand: d.producent,
        brandLogo: brandLogo,
        model: d.kod_towaru,
        power: `${d.moc_chlodnicza_kw} kW`,
        img: d.obrazek_url || "https://images.unsplash.com/photo-1572081790780-1a7739896259?w=600&h=400&fit=crop&auto=format",
        deviceNettoPrice: Number(d.cena_katalogowa_netto),
        installNettoPrice: installNetto,
        tag: d.is_bestseller ? "Bestseller" : undefined,
      };
    });

    return products;
  } catch (err) {
    console.error("Błąd podczas pobierania urządzeń:", err);
    return []; // Zwróć pusto lub fallback
  }
}
