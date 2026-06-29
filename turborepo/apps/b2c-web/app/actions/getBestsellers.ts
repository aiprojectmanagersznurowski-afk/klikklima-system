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
  startingPriceBrutto?: number;
}

export async function getBestsellers(): Promise<BestsellerProduct[]> {
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
      };

      // Dopasuj agregat
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
        tag: "Bestseller",
        marketingDesc: cheapest.marketing_description || "Nowoczesna stylistyka i zaawansowane funkcje, które idealnie wpasują się w każde wnętrze. Wysoka wydajność i cicha praca zapewniają komfort przez cały rok.",
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

    const productsRaw = Array.from(groupedData.values())
      .map(mapGroupToProduct)
      .sort((a, b) => a.deviceNettoPrice - b.deviceNettoPrice)
      .slice(0, 4); // Pobieramy 4 najtańsze/najpopularniejsze

    const { getLowestPriceForIndoorUnit } = await import('./getLowestPriceForIndoorUnit');
    const products = await Promise.all(productsRaw.map(async (p) => {
      const minNetto = await getLowestPriceForIndoorUnit(p._raw.series_name || p._raw.model_code);
      if (minNetto) {
        p.startingPriceBrutto = Math.round(minNetto * 1.08);
      } else {
        p.startingPriceBrutto = Math.round((p.deviceNettoPrice + p.installNettoPrice) * 1.08);
      }
      return p;
    }));

    return products;
  } catch (err) {
    console.error("Błąd podczas pobierania urządzeń:", err);
    return []; // Zwróć pusto lub fallback
  }
}
