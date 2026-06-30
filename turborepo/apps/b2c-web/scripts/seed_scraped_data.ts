import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';

// Load variables manually since we might run outside Next.js context
import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Loading scraped data...');
  const dataPath = path.join(__dirname, '../scraped_data.json');
  const rawData = await fs.readFile(dataPath, 'utf-8');
  const data = JSON.parse(rawData);

  console.log(`Found ${data.indoor_units.length} indoor units, ${data.outdoor_units.length} outdoor units.`);

  // 1. Insert Indoor Units
  console.log('\n--- Inserting Indoor Units ---');
  for (const unit of data.indoor_units) {
    const { error } = await supabase
      .from('indoor_units')
      .upsert({
        model_code: unit.model_code,
        series_name: unit.series_name,
        brand: unit.brand,
        cooling_capacity_kw: unit.cooling_capacity_kw,
        is_single_compatible: unit.is_single_compatible,
        is_multi_compatible: unit.is_multi_compatible,
        features: unit.features, // assuming we add this column or ignore it for now
      }, { onConflict: 'model_code' });
    
    if (error && error.code !== 'PGRST116') {
      // PGRST116 is sometimes returned if we don't select, but we just insert
      // Wait, 'features' might not exist in indoor_units.
      // Let's insert without features first if it fails, or just omit it.
      console.log(`Failed to insert ${unit.model_code}: ${error.message}. Retrying without features...`);
      const { error: err2 } = await supabase
        .from('indoor_units')
        .upsert({
          model_code: unit.model_code,
          series_name: unit.series_name,
          brand: unit.brand,
          cooling_capacity_kw: unit.cooling_capacity_kw,
          is_single_compatible: unit.is_single_compatible,
          is_multi_compatible: unit.is_multi_compatible
        }, { onConflict: 'model_code' });
      if (err2) console.error(`Still failed for ${unit.model_code}:`, err2.message);
      else console.log(`Inserted ${unit.model_code} (without features)`);
    } else {
      console.log(`Inserted ${unit.model_code}`);
    }
  }

  // 2. Insert Outdoor Units
  console.log('\n--- Inserting Outdoor Units ---');
  for (const unit of data.outdoor_units) {
    const { error } = await supabase
      .from('outdoor_units')
      .upsert({
        model_code: unit.model_code,
        brand: unit.brand,
        type: unit.type,
        cooling_capacity_kw: unit.cooling_capacity_kw,
        max_indoor_units: unit.max_indoor_units
      }, { onConflict: 'model_code' });
      
    if (error) console.error(`Error inserting ${unit.model_code}:`, error.message);
    else console.log(`Inserted ${unit.model_code}`);
  }

  // Fetch inserted IDs
  const { data: indoorRecords } = await supabase.from('indoor_units').select('id, model_code');
  const { data: outdoorRecords } = await supabase.from('outdoor_units').select('id, model_code');

  const indoorMap = new Map(indoorRecords?.map(r => [r.model_code, r.id]));
  const outdoorMap = new Map(outdoorRecords?.map(r => [r.model_code, r.id]));

  // 3. Insert Single Split Sets
  console.log('\n--- Inserting Single Split Sets ---');
  for (const set of data.single_split_sets) {
    const indoorId = indoorMap.get(set.indoor_model);
    const outdoorId = outdoorMap.get(set.outdoor_model);
    
    if (!indoorId || !outdoorId) {
      console.error(`Skipping single set ${set.indoor_model} + ${set.outdoor_model} (Missing IDs)`);
      continue;
    }

    const { error } = await supabase
      .from('single_split_sets')
      .upsert({
        indoor_unit_id: indoorId,
        outdoor_unit_id: outdoorId
      }, { onConflict: 'indoor_unit_id, outdoor_unit_id' });
      
    if (error) console.error(`Error inserting set ${set.indoor_model}:`, error.message);
    else console.log(`Inserted Single Set: ${set.indoor_model}`);
  }

  // 4. Insert Multi Split Sets
  console.log('\n--- Inserting Multi Split Sets ---');
  for (const set of data.multi_split_sets) {
    const outdoorId = outdoorMap.get(set.outdoor_model);
    if (!outdoorId) {
      console.error(`Skipping multi set for ${set.outdoor_model} (Missing ID)`);
      continue;
    }

    const { error } = await supabase
      .from('multi_split_sets')
      .insert({
        name: `Zestaw ${set.supported_rooms_count}-pokojowy (${set.outdoor_model})`,
        outdoor_unit_id: outdoorId,
        supported_rooms_count: set.supported_rooms_count,
        indoor_units_json: set.indoor_units_json
      });
      
    if (error) console.error(`Error inserting multi set for ${set.outdoor_model}:`, error.message);
    else console.log(`Inserted Multi Set for ${set.outdoor_model} (${set.supported_rooms_count} rooms)`);
  }

  console.log('\nDone seeding!');
}

main().catch(console.error);
