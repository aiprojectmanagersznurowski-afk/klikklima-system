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
  const indoors = await fetchSupa('indoor_units', 'series_name=eq.KJCAL');
  console.log("KJCAL indoors:", indoors.map(i => ({ model: i.model_code, kw: i.cooling_capacity_kw })));
}
run();
