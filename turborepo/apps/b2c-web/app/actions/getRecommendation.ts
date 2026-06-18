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

    const getKwForSize = (size: string) => {
      if (size === 'Do 25 m²') return 2.5;
      if (size === '26-35 m²') return 3.5;
      if (size === '36-50 m²') return 5.0;
      if (size === 'Powyżej 50 m²') return 7.0;
      return 2.5;
    };

    // Pobranie ceny montażu z bazy
    const { data: cennik, error: cennikError } = await supabase
      .from('cennik_uslug')
      .select('koszt_b2c_netto')
      .eq('nazwa_uslugi', 'Montaż jednostki wew i zew do 4m')
      .limit(1)
      .single();

    const installPricePerRoomNetto = (cennik && !cennikError) ? Number(cennik.koszt_b2c_netto) : 1500;
    const totalInstallNetto = installPricePerRoomNetto * roomCount;

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
      
      const totalDevicesPrice = Number(device.cena_katalogowa_netto);
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
