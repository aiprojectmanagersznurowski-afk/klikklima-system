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
    const { data: devices, error: devError } = await supabase
      .from('urzadzenia')
      .select('*')
      .order('cena_katalogowa_netto', { ascending: true });

    if (devError) throw devError;

    const { data: cennik, error: cenError } = await supabase
      .from('cennik_uslug')
      .select('koszt_b2c_netto')
      .eq('nazwa_uslugi', 'Montaż wzorcowy')
      .single();

    const installNetto = cennik ? Number(cennik.koszt_b2c_netto) : 1500;

    const mapProduct = (d: any): BestsellerProduct => {
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
        marketingDesc: d.opis_marketingowy || "",
        features: d.cechy_json || [],
        gallery: d.galeria_json || [],
      };
    };

    const singleSplit = (devices || []).filter(d => d.typ === 'wew_single').map(mapProduct);
    const multiInternal = (devices || []).filter(d => d.typ === 'wew_multi').map(mapProduct);
    const multiExternal = (devices || []).filter(d => d.typ === 'zew_multi').map(mapProduct);

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
