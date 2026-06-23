import { supabase } from "./apps/b2c-web/lib/supabaseClient";

async function run() {
  const roomCount = 5;
  const roomSizes = {
    1: '26-35 m²',
    2: '26-35 m²',
    3: '26-35 m²',
    4: '26-35 m²',
    5: '26-35 m²'
  };
  const seriesLine = 'KJCAL';

  const getKwForSize = (size) => {
    if (size === 'Do 25 m²') return 2.0;
    if (size === '26-35 m²') return 2.5;
    if (size === '36-50 m²') return 3.4;
    if (size === 'Powyżej 50 m²') return 5.0;
    return 2.5;
  };

  const getCodeForSize = (size) => {
    if (size === 'Do 25 m²') return "07";
    if (size === '26-35 m²') return "09";
    if (size === '36-50 m²') return "12";
    if (size === 'Powyżej 50 m²') return "18";
    return "09";
  };

  let totalNeededKw = 0;
  for (let i = 1; i <= roomCount; i++) {
    totalNeededKw += getKwForSize(roomSizes[i]);
  }
  
  console.log("Total needed Kw:", totalNeededKw);

  const { data: allWew, error: wewError } = await supabase
    .from('indoor_units')
    .select('*')
    .eq('is_multi_compatible', true)
    .order('cooling_capacity_kw', { ascending: true })
    .order('price_netto', { ascending: true });

  let seriesCandidates = Array.from(new Set((allWew || []).map(d => d.series_name))).filter(Boolean);
  if (seriesLine) {
    seriesCandidates = [seriesLine, ...seriesCandidates.filter(s => s !== seriesLine)];
  }
  
  console.log("Checking series:", seriesCandidates[0]);

  const { data: zewDevices } = await supabase
    .from('outdoor_units')
    .select('*')
    .eq('type', 'MULTI')
    .gte('max_indoor_units', roomCount)
    .order('cooling_capacity_kw', { ascending: true })
    .order('price_netto', { ascending: true });

  const { data: multiSets } = await supabase
    .from('multi_split_sets')
    .select('*, outdoor_units!inner(*)')
    .eq('supported_rooms_count', roomCount);

  console.log("Total outdoor units for 5 rooms:", zewDevices?.length);
  console.log("Total multiSets for 5 rooms:", multiSets?.length);

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
        console.log(`Series ${series} rejected. No matching indoor unit for neededKw: ${neededKw}`);
        valid = false;
        break;
      }
    }

    if (valid && internalUnits.length > 0) {
      const brand = internalUnits[0].brand;
      let zewDevice = null;
      let setPriceNetto = 0;

      const requiredCodes = [];
      for (let i = 1; i <= roomCount; i++) {
         requiredCodes.push(getCodeForSize(roomSizes[i]));
      }
      requiredCodes.sort();

      const brandMultiSets = (multiSets || []).filter(s => s.outdoor_units.brand === brand);
      let bestMatch = null;
      for (const set of brandMultiSets) {
        const setCodes = (set.indoor_units_json).map((i) => i.code).sort();
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

      if (bestMatch) {
        console.log(`Found multi_split_set for ${series}! Outdoor: ${bestMatch.outdoor_units.model_code}`);
        zewDevice = bestMatch.outdoor_units;
      } else {
        zewDevice = (zewDevices || []).find(z => z.brand === brand && z.cooling_capacity_kw >= totalNeededKw * 0.8);
        if (zewDevice) {
           console.log(`Found raw outdoor unit for ${series}! Outdoor: ${zewDevice.model_code}`);
        } else {
           console.log(`NO OUTDOOR UNIT FOUND for ${series}.`);
        }
      }

      if (zewDevice) {
        recommendations.push({ series, zewDevice: zewDevice.model_code });
      }
    }
  }

  console.log("Final Recommendations:", recommendations);
}

run().catch(console.error);
