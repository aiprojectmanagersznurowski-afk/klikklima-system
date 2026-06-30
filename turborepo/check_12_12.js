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
  const combs = await fetchSupa('available_combinations', 'sizes_hash=eq.12-12&select=series_name,brand,outdoor_model,total_devices_price&order=total_devices_price.asc&limit=5');
  console.log("Combinations for 12-12:");
  console.dir(combs, {depth: null});
}
run();
