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
  const indoor = await fetchSupa('indoor_units', 'select=count');
  console.log("Indoor units count:", indoor);
  const outdoor = await fetchSupa('outdoor_units', 'select=count');
  console.log("Outdoor units count:", outdoor);
  const single = await fetchSupa('single_split_sets', 'select=count');
  console.log("Single split count:", single);
  const multi = await fetchSupa('multi_split_sets', 'select=count');
  console.log("Multi split count:", multi);
  const combs = await fetchSupa('available_combinations', 'select=count');
  console.log("Combinations count:", combs);
}
run();
