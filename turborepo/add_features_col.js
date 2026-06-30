async function run() {
  const url = `https://txaizdqdpxpvodmkagqn.supabase.co/rest/v1/rpc/exec_sql`;
  const sql = `ALTER TABLE public.indoor_units ADD COLUMN IF NOT EXISTS features JSONB;`;
  // We can't easily run DDL via REST API unless we have an exec_sql RPC function.
  // Wait, I can just use psql if I had the connection string, or I can use the same approach I used earlier to run `insert_scraped.sql` which was `node check_db.js`? No, wait, how did I run insert_scraped.sql previously?
  // I didn't. The user ran it in the Supabase UI. "uruchomilem skrypt: insert_scraped.sql ale 'available combinations' jest nadal puste"
}
