const fs = require('fs');
const path = require('path');

const oldDataPath = path.join(__dirname, '../scraped_data.json');
const newDataPath = path.join(__dirname, '../scraped_data_with_prices.json');

const oldData = JSON.parse(fs.readFileSync(oldDataPath, 'utf-8'));
let newData = JSON.parse(fs.readFileSync(newDataPath, 'utf-8'));

newData.multi_split_sets = oldData.multi_split_sets;

fs.writeFileSync(newDataPath, JSON.stringify(newData, null, 2));
console.log('Merged multi_split_sets into scraped_data_with_prices.json');
