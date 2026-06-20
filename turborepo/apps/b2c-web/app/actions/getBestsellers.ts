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
    // 1. Pobieramy urządzenia
    // Możemy przefiltrować po is_bestseller albo po prostu wziąć kilka pierwszych wew_single
    const { data: devices, error: devError } = await supabase
      .from('indoor_units')
      .select('*')
      .eq('is_single_compatible', true)
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
      const brandLogo = d.brand === 'Fuji Electric' ? 'FE' 
        : d.brand === 'Haier' ? 'HA' 
        : d.brand.substring(0, 2).toUpperCase();

      const features = [
        d.has_wifi ? { iconName: "Wifi", label: "WIFI w standardzie" } : null,
        d.has_presence_sensor ? { iconName: "Eye", label: "Czujnik obecności" } : null,
        d.is_silent_mode ? { iconName: "Wind", label: "Tryb cichy" } : null,
      ].filter(Boolean) as Feature[];

      return {
        id: d.id,
        brand: d.brand,
        brandLogo: brandLogo,
        model: d.model_code,
        power: `${d.cooling_capacity_kw} kW`,
        img: d.image_url || "https://images.unsplash.com/photo-1572081790780-1a7739896259?w=600&h=400&fit=crop&auto=format",
        deviceNettoPrice: Number(d.price_netto),
        installNettoPrice: installNetto,
        tag: d.is_bestseller ? "Bestseller" : undefined,
        marketingDesc: d.marketing_description || "",
        features: features,
        gallery: [],
      };
    });

    return products;
  } catch (err) {
    console.error("Błąd podczas pobierania urządzeń:", err);
    return []; // Zwróć pusto lub fallback
  }
}
