import { PrismaClient, LeadStatus, InstallationStatus, ShippingStatus } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const FIRST_NAMES_MALE = [
  "Jan", "Piotr", "Krzysztof", "Tomasz", "Michał", "Marcin", "Jakub", "Paweł",
  "Wojciech", "Andrzej", "Łukasz", "Grzegorz", "Maciej", "Bartłomiej", "Mateusz",
  "Adam", "Rafał", "Damian", "Szymon", "Filip", "Marek", "Robert", "Kamil"
];

const FIRST_NAMES_FEMALE = [
  "Anna", "Maria", "Magdalena", "Agnieszka", "Katarzyna", "Karolina", "Zofia", "Barbara",
  "Monika", "Ewa", "Aleksandra", "Natalia", "Joanna", "Patrycja", "Paulina", "Justyna",
  "Weronika", "Dominika", "Oliwia", "Julia", "Marta", "Dorota", "Kinga"
];

const LAST_NAMES = [
  "Nowak", "Kowalski", "Wiśniewski", "Wójcik", "Kowalczyk", "Kamiński", "Lewandowski",
  "Zieliński", "Szymański", "Woźniak", "Dąbrowski", "Kozłowski", "Jankowski", "Mazur",
  "Wojciechowski", "Kwiatkowski", "Krawczyk", "Kaczmarek", "Piotrowski", "Grabowski",
  "Pawłowski", "Michalski", "Król", "Wieczorek", "Jabłoński", "Wróbel", "Nowakowski",
  "Majewski", "Olszewski", "Stępień", "Malinowski", "Jaworski", "Górski"
];

const CITIES = [
  { city: "Warszawa", lat: 52.2297, lng: 21.0122, streets: ["Marszałkowska", "Nowy Świat", "Puławska", "Aleje Jerozolimskie", "Mokotowska", "Chłodna", "Obozowa", "Górczewska"] },
  { city: "Kraków", lat: 50.0647, lng: 19.9450, streets: ["Floriańska", "Grodzka", "Karmelicka", "Długa", "Starowiślna", "Dietla", "Czarnowiejska", "Wielicka"] },
  { city: "Wrocław", lat: 51.1079, lng: 17.0385, streets: ["Świdnicka", "Legnicka", "Powstańców Śląskich", "Grabieszyńska", "Oławska", "Trzebnicka", "Jedności Narodowej"] },
  { city: "Poznań", lat: 52.4064, lng: 16.9252, streets: ["Półwiejska", "Św. Marcin", "Głogowska", "Dąbrowskiego", "Bukowska", "Grunwaldzka", "Garbary"] },
  { city: "Gdańsk", lat: 54.3520, lng: 18.6466, streets: ["Długa", "Grunwaldzka", "Kartuska", "Słowackiego", "Al. Zwycięstwa", "Podwale Grodzkie", "Kołobrzeska"] },
  { city: "Łódź", lat: 51.7592, lng: 19.4560, streets: ["Piotrkowska", "Kościuszki", "Zachodnia", "Narutowicza", "Kilińskiego", "Pomorska", "Rzgowska"] },
  { city: "Katowice", lat: 50.2649, lng: 19.0238, streets: ["Korfantego", "3 Maja", "Mikołowska", "Warszawska", "Francuska", "Kościuszki", "Chorzowska"] },
  { city: "Lublin", lat: 51.2465, lng: 22.5684, streets: ["Krakowskie Przedmieście", "Lipowa", "Narutowicza", "Zana", "Spółdzielczości Pracy", "Kunickiego"] },
];

const PRODUCTS = [
  { brand: "Daikin", model: "Daikin Comfora FTXP35M", extModel: "RXP35M", price: 6800, capacityKw: 3.5 },
  { brand: "Mitsubishi Electric", model: "Mitsubishi MSZ-AY35VGKP", extModel: "MUZ-AY35VG", price: 7500, capacityKw: 3.5 },
  { brand: "Gree", model: "Gree Fairy Silver 3.5 kW", extModel: "GWH12ACC", price: 4900, capacityKw: 3.5 },
  { brand: "Panasonic", model: "Panasonic TZ Super-Compact", extModel: "CS-TZ35ZKEW", price: 5600, capacityKw: 3.5 },
  { brand: "LG", model: "LG Dual Inverter Artcool 3.5 kW", extModel: "AC12BK", price: 6200, capacityKw: 3.5 },
  { brand: "Daikin", model: "Daikin Stylish Black 5.0 kW", extModel: "RXA50A", price: 9800, capacityKw: 5.0 },
  { brand: "Mitsubishi Electric", model: "Mitsubishi Diamond 5.0 kW", extModel: "MUZ-LN50VG", price: 11200, capacityKw: 5.0 },
  { brand: "Gree", model: "Gree Amber Prestige 5.3 kW", extModel: "GWH18YE", price: 7900, capacityKw: 5.3 },
  { brand: "Daikin", model: "Multi-Split 2x Daikin Sensira", extModel: "2MXM50N", price: 14500, capacityKw: 5.0 },
  { brand: "Gree", model: "Multi-Split 3x Gree Lomo Luxury", extModel: "GWHD(24)NK6LO", price: 16800, capacityKw: 7.1 },
];

const LOST_REASONS = [
  { reason: "COMPETITOR", note: null },
  { reason: "PRICE_TOO_HIGH", note: null },
  { reason: "POSTPONED", note: null },
  { reason: "NO_CONTACT", note: null },
  { reason: "TECHNICAL_BLOCKER", note: null },
  { reason: "OTHER", note: "Klient zdecydował się na pompę ciepła zamiast klimatyzacji." },
  { reason: "OTHER", note: "Odłożenie inwestycji z powodu remontu generalnego dachu." },
];

const ALL_STAGES = [
  "NEW_LEAD",
  "AWAITING_AUDIT",
  "AUDIT_COMPLETED",
  "AWAITING_CREW_ASSIGNMENT",
  "HARDWARE_IN_WAREHOUSE",
  "HARDWARE_IN_TRANSIT",
  "AWAITING_INSTALLATION",
  "INSTALLATION_COMPLETED",
  "QUOTE_REJECTED",
  "ROLLBACK_RESCHEDULING",
  "ARCHIVED_LOST",
];

const LEADS_PER_STAGE = 20;

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomName() {
  const isMale = Math.random() > 0.5;
  const first = randomElement(isMale ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE);
  let last = randomElement(LAST_NAMES);
  // Simple Polish surname adjustment for female
  if (!isMale && last.endsWith("ski")) {
    last = last.slice(0, -3) + "ska";
  } else if (!isMale && last.endsWith("cki")) {
    last = last.slice(0, -3) + "cka";
  }
  return `${first} ${last}`;
}

function removeDiacritics(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/Ł/g, "L");
}

function randomPhone() {
  const prefix = ["50", "51", "53", "57", "60", "66", "69", "72", "73", "78", "79", "88"][Math.floor(Math.random() * 12)];
  const part1 = Math.floor(100 + Math.random() * 900);
  const part2 = Math.floor(100 + Math.random() * 900);
  return `+48 ${prefix}1 ${part1} ${part2}`;
}

function randomLocation() {
  const cityData = randomElement(CITIES);
  const street = randomElement(cityData.streets);
  const building = Math.floor(1 + Math.random() * 120);
  const apt = Math.random() > 0.4 ? ` m. ${Math.floor(1 + Math.random() * 45)}` : "";
  const address = `ul. ${street} ${building}${apt}, ${cityData.city}`;
  
  // Random small jitter ~ 0-2 km around city center
  const lat = cityData.lat + (Math.random() - 0.5) * 0.04;
  const lng = cityData.lng + (Math.random() - 0.5) * 0.06;

  return { address, lat, lng, city: cityData.city };
}

async function cleanDatabase() {
  console.log("=== KROK 1: Czyszczenie bazy danych ===");
  
  // 1. Serwisy i powiązane bookings
  console.log("Usuwanie serwisów...");
  await prisma.serwisy.deleteMany({});

  // 2. Usterki
  console.log("Usuwanie usterek...");
  await prisma.usterki_incidents.deleteMany({});

  // 3. Instalacje
  console.log("Usuwanie instalacji...");
  await prisma.instalacje.deleteMany({});

  // 4. Logistyka zamówień
  console.log("Usuwanie zamówień logistycznych...");
  await prisma.logistyka_zamowienia.deleteMany({});

  // 5. Bookings
  console.log("Usuwanie rezerwacji kalendarza (Booking)...");
  await prisma.booking.deleteMany({});

  // 6. Leady
  console.log("Usuwanie leadów...");
  await prisma.leady.deleteMany({});

  // 7. Adresy
  console.log("Usuwanie adresów...");
  await prisma.adresy.deleteMany({});

  // 8. Klienci
  console.log("Usuwanie klientów...");
  await prisma.klienci.deleteMany({});

  // 9. Reset sekwencji numeru projektu leadów
  console.log("Resetowanie sekwencji leads_project_number_seq do 1...");
  try {
    await prisma.$executeRawUnsafe(`ALTER SEQUENCE leads_project_number_seq RESTART WITH 1;`);
  } catch (err) {
    console.warn("Uwaga przy resecie sekwencji:", err.message);
  }

  console.log("Czyszczenie zakończone sukcesem!");
}

async function seedFunnel() {
  console.log("\n=== KROK 2: Generowanie nowych danych testowych ===");

  const auditors = await prisma.audytorzy.findMany({ select: { id: true, imie_i_nazwisko: true } });
  const crews = await prisma.zespoly_monterskie.findMany({ select: { id: true, nazwa: true } });

  console.log(`Dostępni audytorzy: ${auditors.length} (${auditors.map(a => a.imie_i_nazwisko).join(", ")})`);
  console.log(`Dostępne ekipy montażowe: ${crews.length} (${crews.map(c => c.nazwa).join(", ")})`);

  const now = new Date();
  let totalCreated = 0;

  for (const stage of ALL_STAGES) {
    console.log(`\nGenerowanie ${LEADS_PER_STAGE} leadów dla etapu: ${stage}...`);

    for (let i = 0; i < LEADS_PER_STAGE; i++) {
      const name = randomName();
      const cleanName = removeDiacritics(name).toLowerCase().replace(/\s+/g, ".");
      const email = `${cleanName}.${Math.floor(100 + Math.random() * 900)}@klient-testowy.pl`;
      const phone = randomPhone();
      const loc = randomLocation();
      const product = randomElement(PRODUCTS);

      // Krok 1: Klient
      const client = await prisma.klienci.create({
        data: {
          imie_i_nazwisko: name,
          email,
          telefon: phone,
          created_at: new Date(now.getTime() - (30 - i % 25) * 86400000 - Math.random() * 3600000),
        },
      });

      // Krok 2: Adres
      const address = await prisma.adresy.create({
        data: {
          klient_id: client.id,
          ulica_miasto: loc.address,
          latitude: loc.lat,
          longitude: loc.lng,
          created_at: client.created_at,
        },
      });

      // Krok 3: Wyznaczanie pól leada zależnie od etapu
      const roomArea = 20 + Math.floor(Math.random() * 45);
      const triage = {
        roomArea,
        roomsCount: product.capacityKw > 6 ? 2 : 1,
        buildingType: randomElement(["Mieszkanie w bloku", "Dom jednorodzinny", "Segment", "Kamienica"]),
        floor: Math.floor(Math.random() * 5),
        selectedDeviceLine: product.model,
        selectedExternalUnit: {
          brand: product.brand,
          model_code: product.extModel,
        },
      };

      const leadCreatedAt = client.created_at;
      let audytorId = null;
      let dataRezerwacji = null;
      let finalnaWycena = null;
      let quotedAt = null;
      let bucketEnteredAt = null;
      let lostReason = null;
      let lostReasonNote = null;
      let autoRejectedReason = null;
      let logisticsSlaPausedAt = null;
      let przewidywanyCzasMontazu = null;

      const auditor = auditors.length > 0 ? auditors[i % auditors.length] : null;
      const crew = crews.length > 0 ? crews[i % crews.length] : null;

      switch (stage) {
        case "NEW_LEAD":
          // Czysty nowy lead
          break;

        case "AWAITING_AUDIT":
          audytorId = auditor ? auditor.id : null;
          // Wizyta za 1 do 5 dni
          dataRezerwacji = new Date(now.getTime() + (1 + (i % 5)) * 86400000 + 10 * 3600000);
          break;

        case "AUDIT_COMPLETED":
          audytorId = auditor ? auditor.id : null;
          finalnaWycena = product.price;
          quotedAt = new Date(now.getTime() - (1 + (i % 4)) * 86400000);
          przewidywanyCzasMontazu = "1 dzień roboczy (4-6h)";
          break;

        case "AWAITING_CREW_ASSIGNMENT":
          audytorId = auditor ? auditor.id : null;
          finalnaWycena = product.price;
          quotedAt = new Date(now.getTime() - (3 + (i % 3)) * 86400000);
          dataRezerwacji = new Date(now.getTime() + (3 + (i % 7)) * 86400000 + 9 * 3600000);
          przewidywanyCzasMontazu = "1 dzień roboczy";
          break;

        case "HARDWARE_IN_WAREHOUSE":
          audytorId = auditor ? auditor.id : null;
          finalnaWycena = product.price;
          quotedAt = new Date(now.getTime() - (6 + (i % 4)) * 86400000);
          dataRezerwacji = new Date(now.getTime() + (4 + (i % 5)) * 86400000 + 9 * 3600000);
          przewidywanyCzasMontazu = "1 dzień roboczy";
          break;

        case "HARDWARE_IN_TRANSIT":
          audytorId = auditor ? auditor.id : null;
          finalnaWycena = product.price;
          quotedAt = new Date(now.getTime() - (8 + (i % 4)) * 86400000);
          dataRezerwacji = new Date(now.getTime() + (2 + (i % 4)) * 86400000 + 9 * 3600000);
          przewidywanyCzasMontazu = "1 dzień roboczy";
          break;

        case "AWAITING_INSTALLATION":
          audytorId = auditor ? auditor.id : null;
          finalnaWycena = product.price;
          quotedAt = new Date(now.getTime() - (10 + (i % 5)) * 86400000);
          dataRezerwacji = new Date(now.getTime() + (1 + (i % 3)) * 86400000 + 8 * 3600000);
          przewidywanyCzasMontazu = "1 dzień roboczy";
          break;

        case "INSTALLATION_COMPLETED":
          audytorId = auditor ? auditor.id : null;
          finalnaWycena = product.price;
          quotedAt = new Date(now.getTime() - (20 + (i % 10)) * 86400000);
          dataRezerwacji = new Date(now.getTime() - (5 + (i % 8)) * 86400000);
          przewidywanyCzasMontazu = "1 dzień roboczy";
          break;

        case "QUOTE_REJECTED":
          audytorId = auditor ? auditor.id : null;
          finalnaWycena = product.price;
          quotedAt = new Date(now.getTime() - (25 + (i % 15)) * 86400000);
          bucketEnteredAt = new Date(now.getTime() - (14 + (i % 10)) * 86400000);
          if (i % 2 === 0) {
            autoRejectedReason = "AUTO_REJECT_14_DAYS";
          }
          break;

        case "ROLLBACK_RESCHEDULING":
          audytorId = auditor ? auditor.id : null;
          finalnaWycena = product.price;
          quotedAt = new Date(now.getTime() - (15 + (i % 7)) * 86400000);
          bucketEnteredAt = new Date(now.getTime() - (2 + (i % 5)) * 86400000);
          logisticsSlaPausedAt = bucketEnteredAt;
          break;

        case "ARCHIVED_LOST":
          audytorId = auditor ? auditor.id : null;
          finalnaWycena = product.price;
          quotedAt = new Date(now.getTime() - (35 + (i % 20)) * 86400000);
          bucketEnteredAt = new Date(now.getTime() - (20 + (i % 10)) * 86400000);
          const lr = LOST_REASONS[i % LOST_REASONS.length];
          lostReason = lr.reason;
          lostReasonNote = lr.note;
          break;
      }

      // Krok 4: Utworzenie leada
      const lead = await prisma.leady.create({
        data: {
          klient_id: client.id,
          adres_id: address.id,
          status: stage,
          odpowiedzi_triage: triage,
          wybrana_konfiguracja: {
            zestaw_montazowy: product.model,
            klimatyzatory: triage.roomsCount,
            typ: product.model.includes("Multi") ? "multi_split" : "single_split",
            moc_kw: product.capacityKw,
          },
          estymowana_wycena: `${product.price.toLocaleString("pl-PL")} PLN`,
          finalna_wycena_pln: finalnaWycena,
          audytor_id: audytorId,
          data_rezerwacji: dataRezerwacji,
          quoted_at: quotedAt,
          bucket_entered_at: bucketEnteredAt,
          lost_reason: lostReason,
          lost_reason_note: lostReasonNote,
          auto_rejected_reason: autoRejectedReason,
          logistics_sla_paused_at: logisticsSlaPausedAt,
          przewidywany_czas_montazu: przewidywanyCzasMontazu,
          notatki_wewnetrzne: `Lead wygenerowany automatycznie dla etapu ${stage}. Preferowany kontakt po 16:00.`,
          created_at: leadCreatedAt,
          updated_at: new Date(),
        },
      });

      // Krok 5: Utworzenie powiązanych instalacji i logistyki dla zaawansowanych etapów
      if (["HARDWARE_IN_WAREHOUSE", "HARDWARE_IN_TRANSIT", "AWAITING_INSTALLATION", "INSTALLATION_COMPLETED"].includes(stage)) {
        if (crew) {
          const isCompleted = stage === "INSTALLATION_COMPLETED";
          const installDate = dataRezerwacji || new Date();
          const nextService = isCompleted ? new Date(installDate.getTime() + 365 * 86400000) : null;

          await prisma.instalacje.create({
            data: {
              lead_id: lead.id,
              zespol_id: crew.id,
              status: isCompleted ? InstallationStatus.COMPLETED : InstallationStatus.PLANNED,
              data_planowana: installDate,
              data_zakonczenia: isCompleted ? installDate : null,
              protokol_url: isCompleted ? "https://storage.klikklima.pl/protokoly/protokol-wzorcowy.pdf" : null,
              next_service_date: nextService,
              created_at: leadCreatedAt,
            },
          });
        }
      }

      if (["HARDWARE_IN_WAREHOUSE", "HARDWARE_IN_TRANSIT", "AWAITING_INSTALLATION"].includes(stage)) {
        let shipStatus = ShippingStatus.PENDING;
        let tracking = null;
        let courier = null;
        let waybill = null;
        let shipDate = null;

        if (stage === "HARDWARE_IN_TRANSIT") {
          shipStatus = ShippingStatus.SHIPPED;
          courier = i % 2 === 0 ? "DPD Polska" : "DHL Express";
          waybill = `${courier.slice(0, 3).toUpperCase()}${100000000 + i * 1337}`;
          tracking = `TRK-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
          shipDate = new Date(now.getTime() - (1 + i % 2) * 86400000);
        } else if (stage === "AWAITING_INSTALLATION") {
          shipStatus = ShippingStatus.DELIVERED;
          courier = "DPD Polska";
          waybill = `DPD${200000000 + i * 1337}`;
          tracking = `TRK-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
          shipDate = new Date(now.getTime() - (3 + i % 2) * 86400000);
        }

        await prisma.logistyka_zamowienia.create({
          data: {
            lead_id: lead.id,
            status_wysylki: shipStatus,
            firma_kurierska: courier,
            nr_listu_przewozowego: waybill,
            tracking_id: tracking,
            data_wysylki: shipDate,
            created_at: leadCreatedAt,
          },
        });
      }

      totalCreated++;
    }
  }

  console.log(`\nWygenerowano łącznie ${totalCreated} leadów i klientów!`);
}

async function verifyCounts() {
  console.log("\n=== KROK 3: Weryfikacja bazy danych ===");
  const leadsCount = await prisma.leady.count();
  const clientsCount = await prisma.klienci.count();
  const addressesCount = await prisma.adresy.count();
  const installationsCount = await prisma.instalacje.count();
  const servicesCount = await prisma.serwisy.count();
  const incidentsCount = await prisma.usterki_incidents.count();
  const logisticsCount = await prisma.logistyka_zamowienia.count();

  console.log({
    "Łączna liczba leadów": leadsCount,
    "Łączna liczba klientów": clientsCount,
    "Łączna liczba adresów": addressesCount,
    "Instalacje": installationsCount,
    "Serwisy": servicesCount,
    "Usterki": incidentsCount,
    "Logistyka": logisticsCount,
  });

  const breakdown = await prisma.leady.groupBy({
    by: ['status'],
    _count: { id: true },
    orderBy: { status: 'asc' },
  });

  console.log("\nRozkład statusów w tabeli 'leady':");
  for (const item of breakdown) {
    console.log(`  ${item.status.padEnd(26)}: ${item._count.id} leadów`);
  }
}

async function main() {
  try {
    await cleanDatabase();
    await seedFunnel();
    await verifyCounts();
  } catch (err) {
    console.error("Błąd podczas czyszczenia / seedowania bazy:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
