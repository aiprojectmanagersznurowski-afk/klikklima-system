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

    const { data: outdoorDevices } = await supabase
      .from('outdoor_units')
      .select('*')
      .eq('type', 'SINGLE');

    const { data: cennik, error: cenError } = await supabase
      .from('cennik_uslug')
      .select('koszt_b2c_netto')
      .eq('nazwa_uslugi', 'Montaż wzorcowy')
      .single();

    const installNetto = cennik ? Number(cennik.koszt_b2c_netto) : 1500;

    const mapGroupToProduct = (devices: any[]): BestsellerProduct => {
      // Znajdź najtańsze urządzenie w grupie
      const cheapest = devices.reduce((prev, curr) => 
        (Number(curr.price_netto) < Number(prev.price_netto)) ? curr : prev
      , devices[0]);

      const brandLogo = cheapest.brand === 'Fuji Electric' ? 'FE' 
        : cheapest.brand === 'Haier' ? 'HA' 
        : cheapest.brand.substring(0, 2).toUpperCase();

      // Agregacja cech z całej serii
      const hasWifi = devices.some(d => d.has_wifi);
      const hasPresence = devices.some(d => d.has_presence_sensor);
      const hasSilent = devices.some(d => d.is_silent_mode);
      const isSingle = devices.some(d => d.is_single_compatible);
      const isMulti = devices.some(d => d.is_multi_compatible);
      
      const allAreas = devices.map(d => Number(d.recommended_area_m2) || (Number(d.cooling_capacity_kw) * 10)).filter(Boolean);

      const features = [
        hasWifi ? { iconName: "Wifi", label: "WIFI w standardzie" } : null,
        hasPresence ? { iconName: "Eye", label: "Czujnik obecności" } : null,
        hasSilent ? { iconName: "Wind", label: "Tryb cichy" } : null,
      ].filter(Boolean) as any;

      // Zbuduj surowy obiekt z zagregowanymi cechami
      const rawAggregated = {
        ...cheapest,
        has_wifi: hasWifi,
        has_presence_sensor: hasPresence,
        is_silent_mode: hasSilent,
        is_single_compatible: isSingle,
        is_multi_compatible: isMulti,
        all_areas: allAreas
      };

      // Dopasuj agregat dla najtańszej jednostki
      const outDevice = outdoorDevices?.find(o => o.brand === cheapest.brand && o.cooling_capacity_kw >= cheapest.cooling_capacity_kw) || outdoorDevices?.[0];
      const outPrice = outDevice ? Number(outDevice.price_netto) : 0;
      const deviceTotalNetto = Number(cheapest.price_netto) + outPrice;

      return {
        id: cheapest.id,
        brand: cheapest.brand,
        brandLogo: brandLogo,
        model: cheapest.series_name || cheapest.model_code, 
        power: `${cheapest.cooling_capacity_kw} kW`,
        img: cheapest.image_url || "https://images.unsplash.com/photo-1572081790780-1a7739896259?w=600&h=400&fit=crop&auto=format",
        deviceNettoPrice: deviceTotalNetto,
        installNettoPrice: installNetto,
        tag: cheapest.is_bestseller ? "Bestseller" : undefined,
        marketingDesc: cheapest.marketing_description || "",
        features: features,
        gallery: [],
        _raw: rawAggregated
      };
    };

    const groupedData = new Map<string, any[]>();
    for (const d of indoorDevices || []) {
      const key = `${d.brand}-${d.series_name || d.model_code}`;
      if (!groupedData.has(key)) groupedData.set(key, []);
      groupedData.get(key)!.push(d);
    }

    const products = Array.from(groupedData.values())
      .map(mapGroupToProduct)
      .sort((a, b) => a.deviceNettoPrice - b.deviceNettoPrice);

    return {
      products
    };
  } catch (err) {
    console.error("Błąd podczas pobierania katalogu:", err);
    return { products: [] };
  }
}
