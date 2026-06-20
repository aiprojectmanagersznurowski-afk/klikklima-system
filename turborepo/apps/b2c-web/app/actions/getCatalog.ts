"use server";

import { supabase } from "@/lib/supabaseClient";
import { BestsellerProduct } from "./getBestsellers";

export interface CatalogData {
  singleSplit: BestsellerProduct[];
  multiInternal: BestsellerProduct[];
  multiExternal: BestsellerProduct[];
}

export async function getCatalog(): Promise<CatalogData> {
  try {
    const { data: indoorDevices, error: indoorError } = await supabase
      .from('indoor_units')
      .select('*')
      .order('price_netto', { ascending: true });

    if (indoorError) throw indoorError;

    const { data: outdoorDevices, error: outdoorError } = await supabase
      .from('outdoor_units')
      .select('*')
      .order('price_netto', { ascending: true });

    if (outdoorError) throw outdoorError;

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
      ].filter(Boolean);

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
    };

    const singleSplit = (indoorDevices || []).filter(d => d.is_single_compatible).map(mapProduct);
    const multiInternal = (indoorDevices || []).filter(d => d.is_multi_compatible).map(mapProduct);
    const multiExternal = (outdoorDevices || []).filter(d => d.type === 'MULTI').map(mapProduct);

    return {
      singleSplit,
      multiInternal,
      multiExternal,
    };
  } catch (err) {
    console.error("Błąd podczas pobierania katalogu:", err);
    return { singleSplit: [], multiInternal: [], multiExternal: [] };
  }
}
