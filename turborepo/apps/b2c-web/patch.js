const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'scripts/generate_sql.js');
let code = fs.readFileSync(filePath, 'utf-8');

code = code.replace(
    `WHERE o.model_code = '\${set.outdoor_model}';`,
    `WHERE o.model_code = '\${set.outdoor_model.replace('AOHG', 'ROG')}';`
);

fs.writeFileSync(filePath, code);
console.log('Patched generate_sql.js');
