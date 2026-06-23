const SIZES = ['Do 25 m²', '26-35 m²', '36-50 m²', 'Powyżej 50 m²'];
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

async function fetchSupa(table, query) {
  const url = `https://txaizdqdpxpvodmkagqn.supabase.co/rest/v1/${table}?${query}`;
  const res = await fetch(url, {
    headers: {
      "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4YWl6ZHFkcHhwdm9kbWthZ3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NDU4NzEsImV4cCI6MjA5NzAyMTg3MX0.ANO7yu18Q846-EONpe2CuQMcBvZnByXOC-Dh4CjFuCk",
      "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4YWl6ZHFkcHhwdm9kbWthZ3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NDU4NzEsImV4cCI6MjA5NzAyMTg3MX0.ANO7yu18Q846-EONpe2CuQMcBvZnByXOC-Dh4CjFuCk"
    }
  });
  return res.json();
}

async function run() {
  const roomCount = 5;
  const roomSizes = { 1: '26-35 m²', 2: '26-35 m²', 3: '26-35 m²', 4: '26-35 m²', 5: '26-35 m²' };
  const seriesLine = 'KJCAL';

  let totalNeededKw = 0;
  for (let i = 1; i <= roomCount; i++) {
    totalNeededKw += getKwForSize(roomSizes[i]);
  }

  const allWew = await fetchSupa('indoor_units', 'is_multi_compatible=eq.true&order=cooling_capacity_kw.asc,price_netto.asc');
  
  let seriesCandidates = Array.from(new Set((allWew || []).map(d => d.series_name))).filter(Boolean);
  if (seriesLine) {
    seriesCandidates = [seriesLine, ...seriesCandidates.filter(s => s !== seriesLine)];
  }

  const zewDevices = await fetchSupa('outdoor_units', `type=eq.MULTI&max_indoor_units=gte.${roomCount}&order=cooling_capacity_kw.asc,price_netto.asc`);
  const multiSets = await fetchSupa('multi_split_sets', `select=*,outdoor_units!inner(*)&supported_rooms_count=eq.${roomCount}`);

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
        zewDevice = bestMatch.outdoor_units;
      } else {
        zewDevice = (zewDevices || []).find(z => z.brand === brand && z.cooling_capacity_kw >= totalNeededKw * 0.8);
      }

      if (zewDevice) {
        recommendations.push({ series, zewDevice: zewDevice.model_code });
      }
    }
  }
  
  console.log("Found:", recommendations);
}
run();
