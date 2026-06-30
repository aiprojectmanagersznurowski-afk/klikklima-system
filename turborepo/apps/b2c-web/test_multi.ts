import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string);

async function check() {
  const { data: indoor } = await supabase.from('indoor_units').select('brand').limit(1);
  console.log("Indoor units sample:", indoor);
  
  const { data: outdoor } = await supabase.from('outdoor_units').select('brand').limit(1);
  console.log("Outdoor units sample:", outdoor);
  
  const { data: mss } = await supabase.from('multi_split_sets').select('*').limit(1);
  console.log("Multi split sets count:", mss?.length);
  
  const { data, error } = await supabase.from('available_combinations').select('*').eq('type', 'MULTI').limit(5);
  console.log('Error:', error);
  console.log('MULTI combos count:', data ? data.length : 0);
}
check();
