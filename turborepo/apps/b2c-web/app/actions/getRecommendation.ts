"use server";

import { unstable_noStore as noStore } from 'next/cache';
import { supabase } from "@/lib/supabaseClient";
import { DISQUALIFICATION_RULES, disqualifyingRules, BUILDING_TYPE_IDS, type TriageAnswers } from "@klikklima/contracts";

export interface RoomSizes {
  [key: number]: string;
}

/**
 * Wynik z ekranu Eksperta — kontrakt zabrania automatycznej wyceny dla tej
 * konfiguracji (`contracts/triage.contract.mjs`, DISQUALIFICATION_RULES).
 * Świadomie bez pól cenowych i bez `recommendations` (WO B2C-TRIAGE-DISQUALIFY, AC7-9).
 */
const EXPERT_SCREEN_OUTCOME = DISQUALIFICATION_RULES[0].outcome; // 'EXPERT_SCREEN' — z kontraktu, nie literał

export async function getRecommendation(
  roomCount: number,
  roomSizes: RoomSizes,
  seriesLine?: string | null,
  buildingType?: string | null
) {
  noStore();

  // Odrzucenie po typie — bez niejawnej koercji JS. `roomCount` z sieci potrafi
  // przyjść jako string ("5"); `!roomCount || roomCount < 1` przepuszcza to
  // dalej niejawną koercją. Fail-closed: jeśli nie potwierdzimy, że wejście
  // jest liczbą, kierujemy tak samo jak realną dyskwalifikację (AC9).
  if (typeof roomCount !== 'number' || !Number.isFinite(roomCount)) {
    return { success: false, outcome: EXPERT_SCREEN_OUTCOME };
  }

  // Jedyne źródło prawdy o dyskwalifikacji — kontrakt, nie własny switch/case.
  // Sprawdzane PRZED jakimkolwiek zapytaniem do bazy.
  // Fail-closed: wartość spoza słownika BUILDING_TYPE_IDS (np. surowa etykieta PL
  // zamiast identyfikatora) nie ma cicho ominąć COMMERCIAL_PROPERTY — traktujemy ją
  // tak samo jak realną dyskwalifikację (recenzja WO B2C-TRIAGE-DISQUALIFY, MAJOR).
  if (buildingType && !BUILDING_TYPE_IDS.includes(buildingType as (typeof BUILDING_TYPE_IDS)[number])) {
    return { success: false, outcome: EXPERT_SCREEN_OUTCOME };
  }

  const answers: TriageAnswers = { ROOM_COUNT: roomCount };
  if (buildingType) {
    answers.BUILDING_TYPE = buildingType;
  }
  if (disqualifyingRules(answers).length > 0) {
    return { success: false, outcome: EXPERT_SCREEN_OUTCOME };
  }

  try {
    if (!roomCount || roomCount < 1) {
      throw new Error("Brak danych o pokojach");
    }

    const getCodeForSize = (size: string) => {
      if (size === 'Do 20 m²') return "07";
      if (size === '21-25 m²') return "09";
      if (size === '26-35 m²') return "12";
      if (size === 'Powyżej 35 m²') return "18";
      return "09";
    };

    // Budujemy sizes_hash z wybranych rozmiarów pokojów
    const requiredCodes = [];
    for (let i = 1; i <= roomCount; i++) {
        requiredCodes.push(getCodeForSize(roomSizes[i]));
    }
    const hash = requiredCodes.sort().join('-');

    // Cena montażu
    const { data: cennik, error: cennikError } = await supabase
      .from('cennik_uslug')
      .select('koszt_b2c_netto')
      .eq('nazwa_uslugi', 'Montaż wzorcowy')
      .limit(1)
      .single();

    const installPricePerRoomNetto = (cennik && !cennikError) ? Number(cennik.koszt_b2c_netto) : 1200;
    const totalInstallNetto = installPricePerRoomNetto * roomCount;

    // Szukamy dostępnych wariantów z Materialized View
    let query = supabase
      .from('available_combinations')
      .select('*')
      .eq('room_count', roomCount)
      .eq('sizes_hash', hash)
      .eq('is_available', true);

    if (seriesLine) {
        // Jeśli podano serię (z modalu), dajemy jej najwyższy priorytet,
        // ale sortowanie zrobimy w JS dla pewności, pobierając wszystko pasujące do hasha.
    }
    
    const { data: combinations, error: combError } = await query;
    
    if (combError || !combinations || combinations.length === 0) {
        throw new Error("Nie znaleziono pasujących wariantów dla tej konfiguracji.");
    }

    // Sortowanie by preferowana seria była na szczycie (jeśli podano)
    let sortedCombinations = [...combinations];
    if (seriesLine) {
        const exactMatchIdx = sortedCombinations.findIndex(c => c.series_name === seriesLine);
        if (exactMatchIdx > 0) {
            const match = sortedCombinations.splice(exactMatchIdx, 1)[0];
            sortedCombinations.unshift(match);
        } else if (exactMatchIdx === -1) {
            const partialIdx = sortedCombinations.findIndex(c => c.series_name && c.series_name.includes(seriesLine));
            if (partialIdx > 0) {
                const match = sortedCombinations.splice(partialIdx, 1)[0];
                sortedCombinations.unshift(match);
            }
        }
    }

    // Wybieramy max 3 różne warianty
    const top3 = sortedCombinations.slice(0, 3);

    // Aby UI działało poprawnie, musimy "dokleić" obiekty internalUnits i externalUnit do tych wyników
    const recommendations = [];

    for (const combo of top3) {
        const { data: outdoorUnit } = await supabase
            .from('outdoor_units')
            .select('*')
            .eq('id', combo.outdoor_unit_id)
            .single();

        const internalUnits = [];
        const codesToFetch = combo.sizes_hash.split('-');
        
        for (const code of codesToFetch) {
            const { data: indoorUnit } = await supabase
                .from('indoor_units')
                .select('*')
                .eq('series_name', combo.series_name)
                .eq('brand', combo.brand)
                .like('model_code', `%${code}%`)
                .order('price_netto', { ascending: true })
                .limit(1)
                .single();
                
            if (indoorUnit) {
                internalUnits.push(indoorUnit);
            }
        }

        const totalNetto = Number(combo.total_devices_price) + totalInstallNetto;
        const totalBrutto = Math.round(totalNetto * 1.08);

        recommendations.push({
            type: combo.type.toLowerCase(), // 'single' lub 'multi'
            internalUnits,
            externalUnit: outdoorUnit,
            totalDevicesPrice: Number(combo.total_devices_price),
            totalInstallNetto,
            totalNetto,
            totalBrutto
        });
    }

    if (recommendations.length === 0) {
        throw new Error("Błąd podczas ładowania szczegółów wariantów.");
    }

    return {
      success: true,
      recommendations
    };
    
  } catch (err: any) {
    console.error("getRecommendation Error:", err);
    return { success: false, error: err.message };
  }
}
