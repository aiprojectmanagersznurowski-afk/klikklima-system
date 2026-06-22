"use server";

import { supabase } from "@/lib/supabaseClient";

export interface Feature {
  iconName: string;
  label: string;
}

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
  marketingDesc?: string;
  features?: Feature[];
  gallery?: { id: string; src: string; alt: string }[];
  _raw?: any;
}

export async function getBestsellers(): Promise<BestsellerProduct[]> {
  try {
    // 1. Pobieramy zestawy single_split, które są oznaczone jako bestseller
    const { data: sets, error: devError } = await supabase
      .from('single_split_sets')
      .select(`
        *,
        indoor_units!inner(*),
        outdoor_units!inner(*)
      `)
      .eq('is_bestseller', true)
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
    const products: BestsellerProduct[] = (sets || []).map((s: any) => {
      const d = s.indoor_units;
      const out = s.outdoor_units;

      // Skrót loga (Fuji Electric -> FE, Haier -> HA)
      const brandLogo = d.brand === 'Fuji Electric' ? 'FE' 
        : d.brand === 'Haier' ? 'HA' 
        : d.brand.substring(0, 2).toUpperCase();

      const features = [
        d.has_wifi ? { iconName: "Wifi", label: "WIFI w standardzie" } : null,
        d.has_presence_sensor ? { iconName: "Eye", label: "Czujnik obecności" } : null,
        d.is_silent_mode ? { iconName: "Wind", label: "Tryb cichy" } : null,
      ].filter(Boolean) as Feature[];

      return {
        id: s.id, // ID Zestawu
        brand: d.brand,
        brandLogo: brandLogo,
        model: d.series_name, // Na froncie bestsellerów wyświetlamy serię!
        power: `${d.cooling_capacity_kw} kW`,
        img: d.image_url || "https://images.unsplash.com/photo-1572081790780-1a7739896259?w=600&h=400&fit=crop&auto=format",
        deviceNettoPrice: Number(s.set_price_netto) || Number(d.price_netto) || 0, // Fallback dla wygody
        installNettoPrice: installNetto,
        tag: s.is_bestseller ? "Bestseller" : undefined,
        marketingDesc: d.marketing_description || "",
        features: features,
        gallery: [],
        _raw: s // Zwracamy całego seta do Modala!
      };
    });

    return products;
  } catch (err) {
    console.error("Błąd podczas pobierania urządzeń:", err);
    return []; // Zwróć pusto lub fallback
  }
}
