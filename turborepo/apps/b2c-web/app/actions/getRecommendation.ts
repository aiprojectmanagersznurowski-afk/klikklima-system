"use server";

import { supabase } from "@/lib/supabaseClient";

export interface RoomSizes {
  [key: number]: string;
}

export async function getRecommendation(roomCount: number, roomSizes: RoomSizes) {
  try {
    if (!roomCount || roomCount < 1) {
      throw new Error("Brak danych o pokojach");
    }

    // Funkcja pomocnicza: metraż -> zapotrzebowanie kW
    const getKwForSize = (size: string) => {
      if (size === 'Do 25 m²') return 2.5;
      if (size === '26-35 m²') return 3.5;
      if (size === '36-50 m²') return 5.0;
      if (size === 'Powyżej 50 m²') return 7.0;
      return 2.5;
    };

    if (roomCount === 1) {
      // SCENARIUSZ: SINGLE SPLIT
      const neededKw = getKwForSize(roomSizes[1]);
      
      const { data: device, error } = await supabase
        .from('urzadzenia')
        .select('*')
        .eq('typ', 'wew_single')
        .gte('moc_chlodnicza_kw', neededKw)
        .order('moc_chlodnicza_kw', { ascending: true })
        .order('cena_katalogowa_netto', { ascending: true })
        .limit(1)
        .single();
        
      if (error) throw error;
      
      return {
        success: true,
        type: 'single',
        internalUnits: [device],
        externalUnit: null,
        totalDevicesPrice: Number(device.cena_katalogowa_netto)
      };
      
    } else {
      // SCENARIUSZ: MULTI SPLIT
      const internalUnits = [];
      let totalNeededKw = 0;
      
      // Dla każdego pokoju dobieramy jednostkę wewnętrzną multi
      for (let i = 1; i <= roomCount; i++) {
        const neededKw = getKwForSize(roomSizes[i]);
        totalNeededKw += neededKw;
        
        const { data: wewDevice, error: wewError } = await supabase
          .from('urzadzenia')
          .select('*')
          .eq('typ', 'wew_multi')
          .gte('moc_chlodnicza_kw', neededKw)
          .order('moc_chlodnicza_kw', { ascending: true })
          .limit(1)
          .single();
          
        if (wewError) throw wewError;
        internalUnits.push(wewDevice);
      }
      
      // Dobieramy jednostkę zewnętrzną multi (agregat)
      const { data: zewDevice, error: zewError } = await supabase
        .from('urzadzenia')
        .select('*')
        .eq('typ', 'zew_multi')
        .gte('ilosc_portow', roomCount)
        .gte('moc_chlodnicza_kw', totalNeededKw * 0.8) // Współczynnik jednoczesności dla multi (80%)
        .order('moc_chlodnicza_kw', { ascending: true })
        .limit(1)
        .single();
        
      if (zewError) throw zewError;
      
      // Sumujemy ceny
      const internalPrice = internalUnits.reduce((sum, d) => sum + Number(d.cena_katalogowa_netto), 0);
      const totalDevicesPrice = internalPrice + Number(zewDevice.cena_katalogowa_netto);
      
      return {
        success: true,
        type: 'multi',
        internalUnits,
        externalUnit: zewDevice,
        totalDevicesPrice
      };
    }
    
  } catch (err: any) {
    console.error("getRecommendation Error:", err);
    return { success: false, error: err.message };
  }
}
