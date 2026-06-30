const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://txaizdqdpxpvodmkagqn.supabase.co', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('available_combinations').select('*').eq('type', 'MULTI').limit(10);
  console.log('Error:', error);
  console.log('Data count:', data ? data.length : 0);
  console.log('Data:', data);
}
// We don't have anon key here, I can't just run this directly. Let's write a pure PG query using psql if possible? 
// No, I don't have db connection string.
