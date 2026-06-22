const fs = require('fs');
const crypto = require('crypto');

function generateUUID() {
    return crypto.randomUUID();
}

function calculateArea(kw) {
    if (!kw) return null;
    if (kw <= 2.5) return 25;
    if (kw <= 3.5) return 35;
    if (kw <= 5.0) return 50;
    return 70;
}

function generateSQL() {
    const rawData = JSON.parse(fs.readFileSync('./apps/b2c-web/data/fuji-raw.json', 'utf8'));
    const setsData = JSON.parse(fs.readFileSync('./apps/b2c-web/data/fuji-raw-sets.json', 'utf8'));
    
    let sql = `-- MIGRACJA DANYCH FUJI ELECTRIC\n\n`;
    
    const indoorIdMap = {}; // modelCode -> uuid
    const outdoorIdMap = {}; // modelCode -> uuid
    
    // Create base models lookup
    const baseIndoorModels = {};
    for (const indoor of rawData['Wewnętrzne']) {
        baseIndoorModels[indoor.modelCode] = indoor;
    }
    
    // Find all required indoor models from sets
    const requiredIndoorCodes = new Set();
    for (const set of setsData['Zestawy Single (Klimatyzatory Ścienne)']) {
        requiredIndoorCodes.add(set.indoorModelCode);
    }
    
    // Generate indoor units
    sql += `-- WSTAWIANIE JEDNOSTEK WEWNĘTRZNYCH\n`;
    for (const code of requiredIndoorCodes) {
        const isBVariant = code.endsWith('-B');
        const baseCode = isBVariant ? code.slice(0, -2) : code;
        
        let indoor = baseIndoorModels[baseCode];
        if (!indoor) {
            console.warn(`Brak danych bazowych dla modelu: ${baseCode}`);
            continue;
        }
        
        const id = generateUUID();
        indoorIdMap[code] = id;
        
        const color = isBVariant ? 'Grafitowy' : 'Biały';
        const recommendedArea = calculateArea(indoor.coolingCapacityKw);
        
        // Cechy z setsData
        const setConfig = setsData['Zestawy Single (Klimatyzatory Ścienne)'].find(s => s.indoorModelCode === code);
        const hasWifi = setConfig ? setConfig.hasWifi : indoor.hasWifi;
        const hasPresence = setConfig ? setConfig.hasPresenceSensor : indoor.hasPresenceSensor;
        const isSilent = setConfig ? setConfig.isSilentMode : indoor.isSilentMode;

        sql += `INSERT INTO indoor_units (id, model_code, series_name, brand, is_single_compatible, is_multi_compatible, cooling_capacity_kw, heating_capacity_kw, power_consumption_cooling_kw, power_consumption_heating_kw, dimensions, noise_level_min_db, has_wifi, has_presence_sensor, is_silent_mode, price_netto, image_url, marketing_description, color, recommended_area_m2) VALUES ('${id}', '${code}', '${indoor.seriesName}', 'Fuji Electric', ${indoor.isSingleCompatible}, ${indoor.isMultiCompatible}, ${indoor.coolingCapacityKw}, ${indoor.heatingCapacityKw}, ${indoor.powerConsumptionCoolingKw || 'NULL'}, ${indoor.powerConsumptionHeatingKw || 'NULL'}, '${indoor.dimensions}', ${indoor.noiseLevelMinDb}, ${hasWifi}, ${hasPresence}, ${isSilent}, 0, NULL, NULL, '${color}', ${recommendedArea});\n`;
    }
    
    sql += `\n-- WSTAWIANIE JEDNOSTEK ZEWNĘTRZNYCH\n`;
    for (const outdoor of rawData['Zewnętrzne']) {
        const id = generateUUID();
        outdoorIdMap[outdoor.modelCode] = id;
        
        sql += `INSERT INTO outdoor_units (id, model_code, brand, type, max_indoor_units, cooling_capacity_kw, heating_capacity_kw, max_total_indoor_capacity_kw, dimensions, price_netto, image_url) VALUES ('${id}', '${outdoor.modelCode}', 'Fuji Electric', '${outdoor.type === "MULTI" || outdoor.type === "MULTI SYMULTANICZNY" ? "MULTI" : "SINGLE"}', ${outdoor.maxIndoorUnits || 1}, ${outdoor.coolingCapacityKw}, ${outdoor.heatingCapacityKw}, ${outdoor.maxTotalIndoorCapacityKw || 'NULL'}, '${outdoor.dimensions}', 0, NULL);\n`;
    }

    // Dodanie outdoor_units do singli, jeżeli ich nie ma w pliku w sekcji "Zewnętrzne"
    for (const set of setsData['Zestawy Single (Klimatyzatory Ścienne)']) {
        if (!outdoorIdMap[set.outdoorModelCode]) {
            const id = generateUUID();
            outdoorIdMap[set.outdoorModelCode] = id;
            sql += `INSERT INTO outdoor_units (id, model_code, brand, type, max_indoor_units, cooling_capacity_kw, heating_capacity_kw, max_total_indoor_capacity_kw, dimensions, price_netto, image_url) VALUES ('${id}', '${set.outdoorModelCode}', 'Fuji Electric', 'SINGLE', 1, NULL, NULL, NULL, NULL, 0, NULL);\n`;
        }
    }

    sql += `\n-- WSTAWIANIE GOTOWYCH ZESTAWÓW SINGLE-SPLIT\n`;
    for (const set of setsData['Zestawy Single (Klimatyzatory Ścienne)']) {
        const indoorId = indoorIdMap[set.indoorModelCode];
        const outdoorId = outdoorIdMap[set.outdoorModelCode];
        
        if (indoorId && outdoorId) {
            const id = generateUUID();
            sql += `INSERT INTO single_split_sets (id, indoor_unit_id, outdoor_unit_id, seer, scop, energy_class_cooling, energy_class_heating, set_price_netto, is_bestseller) VALUES ('${id}', '${indoorId}', '${outdoorId}', NULL, NULL, NULL, NULL, 0, false);\n`;
        }
    }
    
    sql += `\n-- WSTAWIANIE GOTOWYCH ZESTAWÓW MULTI-SPLIT\n`;
    for (const set of setsData['Zestawy MultiSplit (Kombinacje)']) {
        const outdoorId = outdoorIdMap[set.outdoorModelCode];
        if (outdoorId) {
            const id = generateUUID();
            const jsonArr = JSON.stringify(set.indoorModelCodes.map(code => { return { code: code } }));
            sql += `INSERT INTO multi_split_sets (id, name, outdoor_unit_id, indoor_units_json, supported_rooms_count, set_price_netto, is_bestseller) VALUES ('${id}', 'Zestaw Multi ${set.outdoorModelCode}', '${outdoorId}', '${jsonArr}'::jsonb, ${set.indoorModelCodes.length}, 0, false);\n`;
        }
    }
    
    fs.writeFileSync('./fuji_seed.sql', sql, 'utf8');
    console.log('Wygenerowano fuji_seed.sql');
}

generateSQL();
