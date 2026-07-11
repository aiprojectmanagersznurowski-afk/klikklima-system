const crypto = require('crypto');
const fs = require('fs');

function uuidv4() {
  return crypto.randomUUID();
}

function randomName() {
  const first = ["Jan", "Piotr", "Anna", "Maria", "Tomasz", "Krzysztof", "Katarzyna", "Michał", "Agnieszka", "Marcin", "Paweł", "Magdalena", "Jakub", "Karolina", "Maciej"];
  const last = ["Kowalski", "Nowak", "Wiśniewski", "Wójcik", "Kowalczyk", "Kamiński", "Lewandowski", "Zieliński", "Szymański", "Woźniak", "Dąbrowski", "Kozłowski", "Jankowski", "Mazur", "Kaczmarek"];
  return `${first[Math.floor(Math.random() * first.length)]} ${last[Math.floor(Math.random() * last.length)]}`;
}

function randomPhone() {
  return `+48 ${Math.floor(100000000 + Math.random() * 900000000)}`;
}

function randomAddress() {
  const cities = ["Warszawa", "Kraków", "Łódź", "Wrocław", "Poznań", "Gdańsk", "Szczecin", "Bydgoszcz", "Lublin", "Katowice"];
  const streets = ["Polna", "Leśna", "Słoneczna", "Krótka", "Szkolna", "Ogrodowa", "Lipowa", "Brzozowa", "Łąkowa", "Kwiatowa", "Mickiewicza", "Kościuszki", "Długa", "Krzywa"];
  return `ul. ${streets[Math.floor(Math.random() * streets.length)]} ${Math.floor(1 + Math.random() * 150)}, ${cities[Math.floor(Math.random() * cities.length)]}`;
}

function randomConfiguration() {
  const brands = ["Daikin (Premium)", "Mitsubishi Electric", "Gree (Ekonomiczny)", "Panasonic", "LG Dual Inverter"];
  const prices = ["4 500 PLN", "5 200 PLN", "6 800 PLN", "7 500 PLN", "9 900 PLN", "12 500 PLN", "3 800 PLN"];
  const b = brands[Math.floor(Math.random() * brands.length)];
  const p = prices[Math.floor(Math.random() * prices.length)];
  return { config: `{"zestaw_montazowy": "${b}", "klimatyzatory": 1}`, price: p };
}

const numRecords = 6000;
const recordsPerFile = 2000;
const batchSize = 500;

const statuses = [
  "NEW_LEAD", "AUDITOR_ASSIGNED", "AUDIT_COMPLETED", "QUOTE_ACCEPTED", "PAID", 
  "AWAITING_INSTALLATION", "HARDWARE_SHIPPED", "HARDWARE_DELIVERED", 
  "INSTALLATION_IN_PROGRESS", "INSTALLATION_COMPLETED"
];

for (let fileIdx = 0; fileIdx < Math.ceil(numRecords / recordsPerFile); fileIdx++) {
  let sqlOutput = '';
  
  for (let batch = 0; batch < Math.ceil(recordsPerFile / batchSize); batch++) {
    const currentBatchSize = Math.min(batchSize, recordsPerFile - batch * batchSize);
    
    let klienciSql = 'INSERT INTO public.klienci (id, imie_i_nazwisko, email, telefon) VALUES\n';
    let adresySql = 'INSERT INTO public.adresy (id, klient_id, ulica_miasto) VALUES\n';
    let leadySql = 'INSERT INTO public.leady (id, klient_id, adres_id, status, wybrana_konfiguracja, estymowana_wycena) VALUES\n';

    for (let i = 0; i < currentBatchSize; i++) {
      const clientId = uuidv4();
      const addressId = uuidv4();
      const leadId = uuidv4();

      const name = randomName();
      const email = `${name.replace(' ', '.').toLowerCase()}${Math.floor(Math.random() * 1000)}@example.com`;
      const phone = randomPhone();
      
      klienciSql += `('${clientId}', '${name}', '${email}', '${phone}')${i === currentBatchSize - 1 ? ';' : ','}\n`;
      
      const address = randomAddress();
      adresySql += `('${addressId}', '${clientId}', '${address}')${i === currentBatchSize - 1 ? ';' : ','}\n`;
      
      const { config, price } = randomConfiguration();
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      leadySql += `('${leadId}', '${clientId}', '${addressId}', '${status}', '${config}', '${price}')${i === currentBatchSize - 1 ? ';' : ','}\n`;
    }

    sqlOutput += klienciSql + '\n\n' + adresySql + '\n\n' + leadySql + '\n\n';
  }

  const fileName = `insert_6000_leads_part${fileIdx + 1}.sql`;
  fs.writeFileSync(fileName, sqlOutput);
  console.log(`SQL generated: ${fileName}`);
}
