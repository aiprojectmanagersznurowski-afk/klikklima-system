const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'scripts/generate_sql.js');
let code = fs.readFileSync(filePath, 'utf-8');

// We need to inject the logic to duplicate outdoor units
const outdoorLoopStart = `for (const unit of data.outdoor_units) {
    const price = unit.price_netto ? unit.price_netto : 'NULL';
    
    sql += \`INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('\${unit.model_code}', '\${unit.brand}', '\${unit.type}', \${unit.cooling_capacity_kw}, \${unit.max_indoor_units}, \${price})
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;\\n\`;

    // ADDED LOGIC FOR GENERAL MULTI
    if (unit.type === 'MULTI' && unit.brand === 'Fuji Electric') {
        const generalModel = unit.model_code.replace('ROG', 'AOHG');
        sql += \`INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('\${generalModel}', 'GENERAL', '\${unit.type}', \${unit.cooling_capacity_kw}, \${unit.max_indoor_units}, \${price})
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;\\n\`;
    }
}`;

code = code.replace(/for \(const unit of data\.outdoor_units\) \{[\s\S]*?price_netto;\\n`;\n\}/, outdoorLoopStart);


// We need to inject the logic to duplicate multi_split_sets
const multiLoopStart = `for (const set of data.multi_split_sets) {
    const indoorJsonStr = JSON.stringify(set.indoor_units_json).replace(/'/g, "''");
    const price = set.set_price_netto ? set.set_price_netto : 'NULL';
    
    // GENERAL SET
    let nameGeneral = \`Zestaw \${set.supported_rooms_count}-pokojowy (\${set.outdoor_model})\`;
    sql += \`
INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT '\${nameGeneral}', o.id, \${set.supported_rooms_count}, '\${indoorJsonStr}'::jsonb, \${price}
FROM public.outdoor_units o
WHERE o.model_code = '\${set.outdoor_model}';
\`;

    // FUJI SET
    const fujiModel = set.outdoor_model.replace('AOHG', 'ROG');
    let nameFuji = \`Zestaw \${set.supported_rooms_count}-pokojowy (\${fujiModel})\`;
    sql += \`
INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT '\${nameFuji}', o.id, \${set.supported_rooms_count}, '\${indoorJsonStr}'::jsonb, \${price}
FROM public.outdoor_units o
WHERE o.model_code = '\${fujiModel}';
\`;
}`;

code = code.replace(/for \(const set of data\.multi_split_sets\) \{[\s\S]*?\}[\s\S]*?(?=fs\.writeFileSync)/, multiLoopStart + '\n\n');

fs.writeFileSync(filePath, code);
console.log('Patched generate_sql.js again');
