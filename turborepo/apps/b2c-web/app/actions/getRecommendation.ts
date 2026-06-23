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
      if (size === 'Do 25 m²') return 2.0;
      if (size === '26-35 m²') return 2.5;
      if (size === '36-50 m²') return 3.4;
      if (size === 'Powyżej 50 m²') return 5.0;
      return 2.5;
    };

    const getCodeForSize = (size: string) => {
      if (size === 'Do 25 m²') return "07";
      if (size === '26-35 m²') return "09";
      if (size === '36-50 m²') return "12";
      if (size === 'Powyżej 50 m²') return "18";
      return "09";
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
      
      let { data: allDevices, error } = await supabase
        .from('indoor_units')
        .select('*')
        .eq('is_single_compatible', true)
        .gte('cooling_capacity_kw', neededKw)
        .order('price_netto', { ascending: true });
        
      if (error) throw error;

      let { data: outDevices } = await supabase
        .from('outdoor_units')
        .select('*')
        .eq('type', 'SINGLE');
      
      const distinctSeriesMap = new Map();
      for (const d of (allDevices || [])) {
        const series = d.series_name || d.model_code || d.brand;
        if (!distinctSeriesMap.has(series)) {
          distinctSeriesMap.set(series, d);
        }
      }

      let distinctDevices = Array.from(distinctSeriesMap.values());

      if (seriesLine) {
        const preferredIdx = distinctDevices.findIndex(d => d.series_name === seriesLine);
        if (preferredIdx > 0) {
          const pref = distinctDevices.splice(preferredIdx, 1)[0];
          distinctDevices.unshift(pref);
        } else if (preferredIdx === -1) {
          // Spróbujmy znaleźć by częściowej nazwie, gdyby coś poszło nie tak
          const partialIdx = distinctDevices.findIndex(d => (d.series_name || '').includes(seriesLine));
          if (partialIdx > 0) {
            const pref = distinctDevices.splice(partialIdx, 1)[0];
            distinctDevices.unshift(pref);
          }
        }
      }

      const top3 = distinctDevices.slice(0, 3);
      
      if (top3.length === 0) {
        throw new Error("Nie znaleziono pasującej jednostki");
      }

      const recommendations = top3.map(device => {
        const outDevice = outDevices?.find(o => o.brand === device.brand && o.cooling_capacity_kw >= device.cooling_capacity_kw) || outDevices?.[0];
        const outPrice = outDevice ? Number(outDevice.price_netto) : 0;
        
        const totalDevicesPrice = (Number(device.price_netto) || 1000) + outPrice;
        const totalNetto = totalDevicesPrice + totalInstallNetto;
        const totalBrutto = Math.round(totalNetto * 1.08);

        return {
          type: 'single',
          internalUnits: [device],
          externalUnit: null,
          totalDevicesPrice,
          totalInstallNetto,
          totalNetto,
          totalBrutto
        };
      });

      return {
        success: true,
        recommendations
      };
      
    } else {
      // SCENARIUSZ: MULTI SPLIT
      let totalNeededKw = 0;
      for (let i = 1; i <= roomCount; i++) {
        totalNeededKw += getKwForSize(roomSizes[i]);
      }
      
      // Pobieramy wszystkie możliwe jednostki wewnętrzne (multi)
      let { data: allWew, error: wewError } = await supabase
        .from('indoor_units')
        .select('*')
        .eq('is_multi_compatible', true)
        .order('cooling_capacity_kw', { ascending: true })
        .order('price_netto', { ascending: true });
        
      if (wewError) throw wewError;

      // Unikalne serie wew
      let seriesCandidates = Array.from(new Set((allWew || []).map(d => d.series_name))).filter(Boolean);
      
      if (seriesLine) {
        seriesCandidates = [seriesLine, ...seriesCandidates.filter(s => s !== seriesLine)];
      }

      // Pobieramy agregaty bez mocnego filtrowania mocy tutaj, aby dać szansę multi_split_sets
      const { data: zewDevices, error: zewError } = await supabase
        .from('outdoor_units')
        .select('*')
        .eq('type', 'MULTI')
        .gte('max_indoor_units', roomCount)
        .order('cooling_capacity_kw', { ascending: true })
        .order('price_netto', { ascending: true });
        
      if (zewError) throw zewError;

      const { data: multiSets } = await supabase
        .from('multi_split_sets')
        .select('*, outdoor_units!inner(*)')
        .eq('supported_rooms_count', roomCount);

      const recommendations = [];

      for (const series of seriesCandidates) {
        if (recommendations.length >= 3) break;

        const internalUnits = [];
        let valid = true;
        for (let i = 1; i <= roomCount; i++) {
          const neededKw = getKwForSize(roomSizes[i]);
          const matching = (allWew || []).find(d => d.series_name === series && d.cooling_capacity_kw >= neededKw);
          
          if (matching) {
            internalUnits.push(matching);
          } else {
            valid = false;
            break;
          }
        }

        if (valid && internalUnits.length > 0) {
          const brand = internalUnits[0].brand;
          let zewDevice = null;
          let setPriceNetto = 0;

          // 1. Sprawdzamy czy jest zdefiniowany multi_split_set dla tych kodów
          const requiredCodes = [];
          for (let i = 1; i <= roomCount; i++) {
             requiredCodes.push(getCodeForSize(roomSizes[i]));
          }
          requiredCodes.sort();

          const brandMultiSets = (multiSets || []).filter(s => s.outdoor_units.brand === brand);
          let bestMatch = null;
          for (const set of brandMultiSets) {
            const setCodes = (set.indoor_units_json as any[]).map((i) => i.code).sort();
            let isMatch = true;
            for (let j = 0; j < requiredCodes.length; j++) {
              if (setCodes[j] !== requiredCodes[j]) {
                isMatch = false;
                break;
              }
            }
            if (isMatch) {
              bestMatch = set;
              break;
            }
          }

          const combinedInternalPrice = internalUnits.reduce((sum, d) => sum + (Number(d.price_netto) || 1500), 0);

          if (bestMatch) {
            zewDevice = bestMatch.outdoor_units;
            setPriceNetto = Number(bestMatch.set_price_netto) > 0 ? Number(bestMatch.set_price_netto) : (combinedInternalPrice + Number(zewDevice.price_netto));
          } else {
            // 2. Fallback: znajdujemy najmniejszy agregat o wymaganej mocy (totalNeededKw * 0.8)
            zewDevice = (zewDevices || []).find(z => z.brand === brand && z.cooling_capacity_kw >= totalNeededKw * 0.8);
            if (zewDevice) {
               setPriceNetto = combinedInternalPrice + Number(zewDevice.price_netto);
            }
          }

          if (zewDevice) {
            const totalNetto = setPriceNetto + totalInstallNetto;
            const totalBrutto = Math.round(totalNetto * 1.08);
            
            recommendations.push({
              type: 'multi',
              internalUnits,
              externalUnit: zewDevice,
              totalDevicesPrice: setPriceNetto,
              totalInstallNetto,
              totalNetto,
              totalBrutto
            });
          }
        }
      }

      if (recommendations.length === 0) {
        throw new Error("Żadna z serii nie była w stanie pokryć wymogów dla wszystkich pomieszczeń.");
      }

      return {
        success: true,
        recommendations
      };
    }
    
  } catch (err: any) {
    console.error("getRecommendation Error:", err);
    return { success: false, error: err.message };
  }
}
