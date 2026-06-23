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
  const multiSets = await fetchSupa('multi_split_sets', 'select=id,indoor_units_json');
  const nulls = multiSets.filter(s => !s.indoor_units_json || !Array.isArray(s.indoor_units_json));
  console.log("Rows with null/invalid json:", nulls.length);
}
run();
