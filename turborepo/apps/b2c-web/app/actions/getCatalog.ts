"use server";

import { supabase } from "@/lib/supabaseClient";
import { BestsellerProduct } from "./getBestsellers";

export interface CatalogData {
  products: BestsellerProduct[];
}

export async function getCatalog(): Promise<CatalogData> {
  try {
    const { data: indoorDevices, error: indoorError } = await supabase
      .from('indoor_units')
      .select('*')
      .order('price_netto', { ascending: true });

    if (indoorError) throw indoorError;

    const { data: cennik, error: cenError } = await supabase
      .from('cennik_uslug')
      .select('koszt_b2c_netto')
      .eq('nazwa_uslugi', 'Montaż wzorcowy')
      .single();

    const installNetto = cennik ? Number(cennik.koszt_b2c_netto) : 1500;

    const mapProduct = (d: any): BestsellerProduct => {
      const brandLogo = d.brand === 'Fuji Electric' ? 'FE' 
        : d.brand === 'Haier' ? 'HA' 
        : d.brand.substring(0, 2).toUpperCase();

      const features = [
        d.has_wifi ? { iconName: "Wifi", label: "WIFI w standardzie" } : null,
        d.has_presence_sensor ? { iconName: "Eye", label: "Czujnik obecności" } : null,
        d.is_silent_mode ? { iconName: "Wind", label: "Tryb cichy" } : null,
      ].filter(Boolean) as any;

      return {
        id: d.id,
        brand: d.brand,
        brandLogo: brandLogo,
        model: d.series_name || d.model_code, // Używamy series_name zamiast model_code, jeśli dostępne
        power: `${d.cooling_capacity_kw} kW`,
        img: d.image_url || "https://images.unsplash.com/photo-1572081790780-1a7739896259?w=600&h=400&fit=crop&auto=format",
        deviceNettoPrice: Number(d.price_netto),
        installNettoPrice: installNetto,
        tag: d.is_bestseller ? "Bestseller" : undefined,
        marketingDesc: d.marketing_description || "",
        features: features,
        gallery: [],
        _raw: d
      };
    };

    const allProducts = (indoorDevices || []).map(mapProduct);

    // Grupowanie po series_name aby ograniczyć liczbę kafelków
    const grouped = new Map<string, BestsellerProduct>();
    
    for (const p of allProducts) {
      const key = `${p.brand}-${p.model}`; // p.model to series_name
      const existing = grouped.get(key);
      if (!existing || p.deviceNettoPrice < existing.deviceNettoPrice) {
        grouped.set(key, p);
      }
    }

    const products = Array.from(grouped.values()).sort((a, b) => a.deviceNettoPrice - b.deviceNettoPrice);

    return {
      products
    };
  } catch (err) {
    console.error("Błąd podczas pobierania katalogu:", err);
    return { products: [] };
  }
}
