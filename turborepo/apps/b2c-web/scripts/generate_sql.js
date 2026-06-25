const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../scraped_data_with_prices.json');
const rawData = fs.readFileSync(dataPath, 'utf-8');
const data = JSON.parse(rawData);

let sql = `-- Wygenerowany skrypt migracyjny dla danych Fuji Electric (Single & Multi)\n\n`;

sql += `-- 0. Dodaj kolumne features jesli nie istnieje\n`;
sql += `ALTER TABLE public.indoor_units ADD COLUMN IF NOT EXISTS features JSONB;\n\n`;

sql += `-- 1. Insert Indoor Units\n`;
for (const unit of data.indoor_units) {
    const features = unit.features ? `'${JSON.stringify(unit.features).replace(/'/g, "''")}'::jsonb` : 'NULL';
    const price = unit.price_netto ? unit.price_netto : 'NULL';
    
    sql += `INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('${unit.model_code}', '${unit.series_name}', '${unit.brand}', ${unit.cooling_capacity_kw}, ${unit.is_single_compatible}, ${unit.is_multi_compatible}, ${price}, ${features})
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;\n`;
}

sql += `\n-- 2. Insert Outdoor Units\n`;
for (const unit of data.outdoor_units) {
    const price = unit.price_netto ? unit.price_netto : 'NULL';
    sql += `INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('${unit.model_code}', '${unit.brand}', '${unit.type}', ${unit.cooling_capacity_kw}, ${unit.max_indoor_units}, ${price})
ON CONFLICT (model_code) DO UPDATE SET 
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;\n`;
}

sql += `\n-- 3. Insert Single Split Sets\n`;
for (const set of data.single_split_sets) {
    const price = set.set_price_netto ? set.set_price_netto : 'NULL';
    sql += `
INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, ${price}
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = '${set.indoor_model}' AND o.model_code = '${set.outdoor_model}'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;
`;
}

sql += `\n-- 4. Insert Multi Split Sets\n`;
for (const set of data.multi_split_sets) {
    const indoorJsonStr = JSON.stringify(set.indoor_units_json).replace(/'/g, "''");
    const name = `Zestaw ${set.supported_rooms_count}-pokojowy (${set.outdoor_model})`;
    const price = set.set_price_netto ? set.set_price_netto : 'NULL';
    sql += `
INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT '${name}', o.id, ${set.supported_rooms_count}, '${indoorJsonStr}'::jsonb, ${price}
FROM public.outdoor_units o
WHERE o.model_code = '${set.outdoor_model}';
`;
}

fs.writeFileSync(path.join(__dirname, '../insert_scraped.sql'), sql);
console.log('Successfully generated insert_scraped.sql');

