"use server";

import { supabase } from "@/lib/supabaseClient";

export interface RoomSizes {
  [key: number]: string;
}

export async function getRecommendation(roomCount: number, roomSizes: RoomSizes, seriesLine?: string | null) {
  try {
    if (!roomCount || roomCount < 1) {
      throw new Error("Brak danych o pokojach");
    }

    const getKwForSize = (size: string) => {
      if (size === 'Do 25 m²') return 2.5;
      if (size === '26-35 m²') return 3.5;
      if (size === '36-50 m²') return 5.0;
      if (size === 'Powyżej 50 m²') return 7.0;
      return 2.5;
    };

    const { data: cennik, error: cennikError } = await supabase
      .from('cennik_uslug')
      .select('koszt_b2c_netto')
      .eq('nazwa_uslugi', 'Montaż wzorcowy')
      .limit(1)
      .single();

    const installPricePerRoomNetto = (cennik && !cennikError) ? Number(cennik.koszt_b2c_netto) : 1500;
    const totalInstallNetto = installPricePerRoomNetto * roomCount;

    if (roomCount === 1) {
      // SCENARIUSZ: SINGLE SPLIT
      const neededKw = getKwForSize(roomSizes[1]);
      
      let query = supabase
        .from('indoor_units')
        .select('*')
        .eq('is_single_compatible', true)
        .gte('cooling_capacity_kw', neededKw)
        .order('cooling_capacity_kw', { ascending: true })
        .order('price_netto', { ascending: true })
        .limit(1);

      if (seriesLine) {
        query = query.eq('series_name', seriesLine);
      }
        
      const { data: device, error } = await query.single();
        
      if (error) throw error;
      
      const totalDevicesPrice = Number(device.price_netto) || 3000; // Zabezpieczenie dla 0 zł
      const totalNetto = totalDevicesPrice + totalInstallNetto;
      const totalBrutto = Math.round(totalNetto * 1.08); // VAT 8% na budownictwo mieszkaniowe

      return {
        success: true,
        type: 'single',
        internalUnits: [device],
        externalUnit: null,
        totalDevicesPrice,
        totalInstallNetto,
        totalNetto,
        totalBrutto
      };
      
    } else {
      // SCENARIUSZ: MULTI SPLIT
      const internalUnits = [];
      let totalNeededKw = 0;
      
      // Dla każdego pokoju dobieramy jednostkę wewnętrzną multi
      for (let i = 1; i <= roomCount; i++) {
        const neededKw = getKwForSize(roomSizes[i]);
        totalNeededKw += neededKw;
        
        let wewQuery = supabase
          .from('indoor_units')
          .select('*')
          .eq('is_multi_compatible', true)
          .gte('cooling_capacity_kw', neededKw)
          .order('cooling_capacity_kw', { ascending: true })
          .limit(1);

        if (seriesLine) {
          wewQuery = wewQuery.eq('series_name', seriesLine);
        }
          
        const { data: wewDevice, error: wewError } = await wewQuery.single();
          
        if (wewError) throw wewError;
        internalUnits.push(wewDevice);
      }
      
      // Dobieramy jednostkę zewnętrzną multi (agregat)
      const { data: zewDevice, error: zewError } = await supabase
        .from('outdoor_units')
        .select('*')
        .eq('type', 'MULTI')
        .gte('max_indoor_units', roomCount)
        .gte('cooling_capacity_kw', totalNeededKw * 0.8) // Współczynnik jednoczesności dla multi (80%)
        .order('cooling_capacity_kw', { ascending: true })
        .limit(1)
        .single();
        
      if (zewError) throw zewError;
      
      // Sumujemy ceny
      const internalPrice = internalUnits.reduce((sum, d) => sum + (Number(d.price_netto) || 1500), 0);
      const totalDevicesPrice = internalPrice + (Number(zewDevice.price_netto) || 4500);
      const totalNetto = totalDevicesPrice + totalInstallNetto;
      const totalBrutto = Math.round(totalNetto * 1.08); // VAT 8% na budownictwo mieszkaniowe
      
      return {
        success: true,
        type: 'multi',
        internalUnits,
        externalUnit: zewDevice,
        totalDevicesPrice,
        totalInstallNetto,
        totalNetto,
        totalBrutto
      };
    }
    
  } catch (err: any) {
    console.error("getRecommendation Error:", err);
    return { success: false, error: err.message };
  }
}
