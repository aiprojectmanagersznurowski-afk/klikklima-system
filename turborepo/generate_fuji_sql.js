const fs = require('fs');
const crypto = require('crypto');

function generateUUID() {
    return crypto.randomUUID();
}

function generateSQL() {
    const rawData = JSON.parse(fs.readFileSync('./apps/b2c-web/data/fuji-raw.json', 'utf8'));
    
    let sql = `-- MIGRACJA DANYCH FUJI ELECTRIC\n\n`;
    
    const indoorIdMap = {}; // modelCode -> uuid
    const outdoorIdMap = {}; // modelCode -> uuid
    
    sql += `-- WSTAWIANIE JEDNOSTEK WEWNĘTRZNYCH\n`;
    for (const indoor of rawData['Wewnętrzne']) {
        const id = generateUUID();
        indoorIdMap[indoor.modelCode] = id;
        
        sql += `INSERT INTO indoor_units (id, model_code, series_name, brand, is_single_compatible, is_multi_compatible, cooling_capacity_kw, heating_capacity_kw, power_consumption_cooling_kw, power_consumption_heating_kw, dimensions, noise_level_min_db, has_wifi, has_presence_sensor, is_silent_mode, price_netto, image_url, marketing_description) VALUES ('${id}', '${indoor.modelCode}', '${indoor.seriesName}', 'Fuji Electric', ${indoor.isSingleCompatible}, ${indoor.isMultiCompatible}, ${indoor.coolingCapacityKw}, ${indoor.heatingCapacityKw}, ${indoor.powerConsumptionCoolingKw || 'NULL'}, ${indoor.powerConsumptionHeatingKw || 'NULL'}, '${indoor.dimensions}', ${indoor.noiseLevelMinDb}, ${indoor.hasWifi}, ${indoor.hasPresenceSensor}, ${indoor.isSilentMode}, 0, NULL, NULL);\n`;
    }
    
    sql += `\n-- WSTAWIANIE JEDNOSTEK ZEWNĘTRZNYCH\n`;
    for (const outdoor of rawData['Zewnętrzne']) {
        const id = generateUUID();
        outdoorIdMap[outdoor.modelCode] = id;
        
        sql += `INSERT INTO outdoor_units (id, model_code, brand, type, max_indoor_units, cooling_capacity_kw, heating_capacity_kw, max_total_indoor_capacity_kw, dimensions, price_netto, image_url) VALUES ('${id}', '${outdoor.modelCode}', 'Fuji Electric', '${outdoor.type === "MULTI" || outdoor.type === "MULTI SYMULTANICZNY" ? "MULTI" : "SINGLE"}', ${outdoor.maxIndoorUnits || 1}, ${outdoor.coolingCapacityKw}, ${outdoor.heatingCapacityKw}, ${outdoor.maxTotalIndoorCapacityKw || 'NULL'}, '${outdoor.dimensions}', 0, NULL);\n`;
    }

    // Dodanie outdoor_units do singli, jeżeli ich nie ma w pliku w sekcji "Zewnętrzne" (bo katalog pokazał tylko Multi)
    // Tworzymy je w locie na podstawie sekcji Zestawy
    for (const set of rawData['Gotowe Zestawy Single']) {
        if (!outdoorIdMap[set.outdoorModelCode]) {
            const id = generateUUID();
            outdoorIdMap[set.outdoorModelCode] = id;
            sql += `INSERT INTO outdoor_units (id, model_code, brand, type, max_indoor_units, cooling_capacity_kw, heating_capacity_kw, max_total_indoor_capacity_kw, dimensions, price_netto, image_url) VALUES ('${id}', '${set.outdoorModelCode}', 'Fuji Electric', 'SINGLE', 1, NULL, NULL, NULL, NULL, 0, NULL);\n`;
        }
    }

    sql += `\n-- WSTAWIANIE GOTOWYCH ZESTAWÓW SINGLE-SPLIT\n`;
    for (const set of rawData['Gotowe Zestawy Single']) {
        const indoorId = indoorIdMap[set.indoorModelCode];
        const outdoorId = outdoorIdMap[set.outdoorModelCode];
        
        if (indoorId && outdoorId) {
            const id = generateUUID();
            sql += `INSERT INTO single_split_sets (id, indoor_unit_id, outdoor_unit_id, seer, scop, energy_class_cooling, energy_class_heating, set_price_netto) VALUES ('${id}', '${indoorId}', '${outdoorId}', ${set.seer}, ${set.scop}, '${set.energyClassCooling}', '${set.energyClassHeating}', 0);\n`;
        }
    }
    
    sql += `\n-- WSTAWIANIE GOTOWYCH ZESTAWÓW MULTI-SPLIT\n`;
    for (const set of rawData['Gotowe Zestawy MultiSplit']) {
        const outdoorId = outdoorIdMap[set.outdoorModelCode];
        if (outdoorId) {
            const id = generateUUID();
            
            // Map the "07", "09" codes to actual models logic isn't perfect since we lack the exact series, 
            // but we can try to find an indoor model that matches "07" or "09".
            // Since this is complex to map strictly without exact codes, we will just use placeholders or skip for now if it's too ambiguous.
            // Let's create a valid JSON structure
            const jsonArr = JSON.stringify(set.indoorModelCodes.map(code => { return { code: code } }));
            
            sql += `INSERT INTO multi_split_sets (id, name, outdoor_unit_id, indoor_units_json, supported_rooms_count, set_price_netto) VALUES ('${id}', 'Zestaw Multi ${set.outdoorModelCode}', '${outdoorId}', '${jsonArr}'::jsonb, ${set.indoorModelCodes.length}, 0);\n`;
        }
    }
    
    fs.writeFileSync('./fuji_seed.sql', sql, 'utf8');
    console.log('Wygenerowano fuji_seed.sql');
}

generateSQL();
