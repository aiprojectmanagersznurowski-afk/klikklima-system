const dotenv = require('dotenv');
dotenv.config({ path: '../../.env' });

async function run() {
  const headers = {
      'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  };
  const res = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + `/rest/v1/outdoor_units?model_code=eq.ROG14KBTA2`, { headers });
  const data = await res.json();
  console.log("outdoor_unit ROG14KBTA2:", data);
}
run();
