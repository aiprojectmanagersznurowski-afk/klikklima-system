const { execSync } = require('child_process');

const SQL = `
WITH unnested AS (
  SELECT mss.id as set_id, elem->>'code' as code, ou.brand
  FROM multi_split_sets mss
  JOIN outdoor_units ou ON ou.id = mss.outdoor_unit_id
  CROSS JOIN jsonb_array_elements(mss.indoor_units_json) as elem
  WHERE mss.id = 1
),
prices AS (
  SELECT u.set_id, u.code, MIN(iu.price_netto) as min_price
  FROM unnested u
  JOIN indoor_units iu ON iu.brand = u.brand AND iu.model_code LIKE '%' || u.code || '%'
  GROUP BY u.set_id, u.code
)
SELECT set_id, SUM(min_price) FROM prices GROUP BY set_id;
`;
// Wait, we can't easily run SQL without psql or pg package.
