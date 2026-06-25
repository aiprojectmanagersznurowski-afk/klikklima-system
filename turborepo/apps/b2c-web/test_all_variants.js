const SIZES = ['Do 20 m²', '21-25 m²', '26-35 m²', 'Powyżej 35 m²'];
const getKwForSize = (size) => {
  if (size === 'Do 20 m²') return 2.0;
  if (size === '21-25 m²') return 2.5;
  if (size === '26-35 m²') return 3.4;
  if (size === 'Powyżej 35 m²') return 5.0;
  return 2.5;
};
const getCodeForSize = (size) => {
  if (size === 'Do 20 m²') return "07";
  if (size === '21-25 m²') return "09";
  if (size === '26-35 m²') return "12";
  if (size === 'Powyżej 35 m²') return "18";
  return "09";
};

function getCombinations(length) {
  if (length === 1) return SIZES.map(s => [s]);
  const smaller = getCombinations(length - 1);
  const result = [];
  for (const s of SIZES) {
    for (const sm of smaller) {
      result.push([s, ...sm]);
    }
  }
  return result;
}

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
  const allWew = await fetchSupa('indoor_units', 'is_multi_compatible=eq.true&order=cooling_capacity_kw.asc,price_netto.asc');
  const zewDevices = await fetchSupa('outdoor_units', `type=eq.MULTI&order=cooling_capacity_kw.asc,price_netto.asc`);
  const multiSets = await fetchSupa('multi_split_sets', `select=*,outdoor_units!inner(*)`);

  let successCount = 0;
  let errorCount = 0;
  let failedVariants = [];

  for (let roomCount = 1; roomCount <= 5; roomCount++) {
    const combs = getCombinations(roomCount);
    for (const comb of combs) {
      const roomSizes = {};
      comb.forEach((s, i) => roomSizes[i+1] = s);
      
      let totalNeededKw = 0;
      for (let i = 1; i <= roomCount; i++) {
        totalNeededKw += getKwForSize(roomSizes[i]);
      }
      
      const internalUnits = [];
      for (let i = 1; i <= roomCount; i++) {
        const neededKw = getKwForSize(roomSizes[i]);
        const matching = (allWew || []).find(d => d.series_name === 'KJCAL' && d.cooling_capacity_kw >= neededKw);
        if (matching) {
          internalUnits.push(matching);
        } else {
          break;
        }
      }

      if (internalUnits.length === roomCount) {
        const requiredCodes = comb.map(s => getCodeForSize(s)).sort();
        const brandMultiSets = multiSets.filter(s => s.outdoor_units.brand === 'Fuji Electric' && s.supported_rooms_count === roomCount);
        let bestMatch = null;
        for (const set of brandMultiSets) {
          const setCodes = (set.indoor_units_json).map((i) => i.code).sort();
          if (setCodes.length === requiredCodes.length && setCodes.every((v, i) => v === requiredCodes[i])) {
            bestMatch = set;
            break;
          }
        }

        let zewDevice = null;
        if (bestMatch) {
          zewDevice = bestMatch.outdoor_units;
        } else {
          zewDevice = zewDevices.find(z => z.brand === 'Fuji Electric' && z.max_indoor_units >= roomCount && z.cooling_capacity_kw >= totalNeededKw * 0.8);
        }

        if (zewDevice) {
          successCount++;
        } else {
          errorCount++;
          failedVariants.push(comb.join(', '));
        }
      } else {
        errorCount++;
        failedVariants.push(comb.join(', ') + ' (Brak j. wew.)');
      }
    }
  }

  console.log(`✅ Success (found valid variant): ${successCount}`);
  console.log(`❌ Failed (no variant found): ${errorCount}`);
}

run();
