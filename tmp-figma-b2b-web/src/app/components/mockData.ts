export type LeadStage = 1 | 2 | 3 | 4 | 5;

export const stageLabels: Record<LeadStage, string> = {
  1: 'Nowy lead',
  2: 'Oczekuje na audyt',
  3: 'Wycena',
  4: 'Do instalacji',
  5: 'Zakończone',
};

export interface Auditor {
  id: number;
  name: string;
  initials: string;
  color: string;
  role: 'Audytor' | 'Monter';
  activeAssignments: number;
  lastLogin: string;
}

export interface NoteEntry {
  id: number;
  text: string;
  author: string;
  date: string;
  type: 'note' | 'status_change';
  oldStatus?: string;
  newStatus?: string;
}

export interface Lead {
  id: number;
  dateReceived: string;
  client: { firstName: string; lastName: string; phone: string; email: string };
  city: string;
  auditor: Auditor | null;
  estimatedAmount: number | null;
  stage: LeadStage;
  daysInStage: number;
  notes: NoteEntry[];
  equipment: string;
  triageResult: string;
  installationDate: string | null;
  team: string | null;
}

export interface Customer {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  leadsCount: number;
  ltv: number;
}

export interface NotificationLog {
  id: number;
  date: string;
  channel: 'SMS' | 'Email';
  recipient: string;
  content: string;
  status: 'Wysłano' | 'Błąd' | 'Oczekuje';
}

export const auditors: Auditor[] = [
  { id: 1, name: 'Marek Kowalski', initials: 'MK', color: '#3B82F6', role: 'Audytor', activeAssignments: 8, lastLogin: '2026-07-11 09:15' },
  { id: 2, name: 'Anna Wiśniewska', initials: 'AW', color: '#8B5CF6', role: 'Audytor', activeAssignments: 5, lastLogin: '2026-07-11 08:45' },
  { id: 3, name: 'Piotr Nowak', initials: 'PN', color: '#10B981', role: 'Audytor', activeAssignments: 12, lastLogin: '2026-07-10 17:30' },
  { id: 4, name: 'Katarzyna Zając', initials: 'KZ', color: '#F59E0B', role: 'Audytor', activeAssignments: 3, lastLogin: '2026-07-11 10:00' },
  { id: 5, name: 'Tomasz Wróbel', initials: 'TW', color: '#EF4444', role: 'Monter', activeAssignments: 6, lastLogin: '2026-07-11 07:30' },
  { id: 6, name: 'Magdalena Krawczyk', initials: 'MK', color: '#EC4899', role: 'Monter', activeAssignments: 4, lastLogin: '2026-07-10 16:45' },
  { id: 7, name: 'Rafał Dąbrowski', initials: 'RD', color: '#14B8A6', role: 'Monter', activeAssignments: 7, lastLogin: '2026-07-11 09:00' },
];

export const leads: Lead[] = [
  {
    id: 1001,
    dateReceived: '2026-07-11',
    client: { firstName: 'Jan', lastName: 'Kowalczyk', phone: '600 123 456', email: 'jan.kowalczyk@gmail.com' },
    city: 'Warszawa',
    auditor: auditors[0],
    estimatedAmount: 8500,
    stage: 2,
    daysInStage: 1,
    equipment: 'Mitsubishi Electric MSZ-AP25VGK',
    triageResult: 'Dom jednorodzinny, 120m², 2 pokoje wymagające klimatyzacji',
    installationDate: null,
    team: null,
    notes: [
      { id: 1, text: '', author: 'System', date: '2026-07-11 08:00', type: 'status_change', oldStatus: '–', newStatus: 'Nowy lead' },
      { id: 2, text: 'Przypisano audytora Marka Kowalskiego', author: 'Adam Kaczmarek', date: '2026-07-11 09:30', type: 'note' },
      { id: 3, text: '', author: 'System', date: '2026-07-11 09:35', type: 'status_change', oldStatus: 'Nowy lead', newStatus: 'Oczekuje na audyt' },
    ],
  },
  {
    id: 1002,
    dateReceived: '2026-07-10',
    client: { firstName: 'Maria', lastName: 'Nowak', phone: '501 987 654', email: 'maria.nowak@wp.pl' },
    city: 'Kraków',
    auditor: auditors[1],
    estimatedAmount: 12000,
    stage: 3,
    daysInStage: 3,
    equipment: 'Daikin FTXC25C',
    triageResult: 'Mieszkanie 65m², 3 pokoje, wymagana instalacja split',
    installationDate: null,
    team: null,
    notes: [
      { id: 1, text: '', author: 'System', date: '2026-07-10 10:00', type: 'status_change', oldStatus: '–', newStatus: 'Nowy lead' },
      { id: 2, text: 'Audyt przeprowadzony, przygotowuję szczegółową wycenę', author: 'Anna Wiśniewska', date: '2026-07-11 11:00', type: 'note' },
      { id: 3, text: '', author: 'System', date: '2026-07-11 11:05', type: 'status_change', oldStatus: 'Oczekuje na audyt', newStatus: 'Wycena' },
    ],
  },
  {
    id: 1003,
    dateReceived: '2026-07-08',
    client: { firstName: 'Robert', lastName: 'Wiśniewski', phone: '798 456 123', email: 'r.wisniewski@firma.pl' },
    city: 'Gdańsk',
    auditor: auditors[2],
    estimatedAmount: 25000,
    stage: 4,
    daysInStage: 2,
    equipment: 'LG Multi Split 5x1',
    triageResult: 'Biuro 200m², 5 jednostek, instalacja komercyjna',
    installationDate: '2026-07-15',
    team: 'Ekipa Czerwona',
    notes: [
      { id: 1, text: '', author: 'System', date: '2026-07-08 09:00', type: 'status_change', oldStatus: '–', newStatus: 'Nowy lead' },
      { id: 2, text: 'Klient potwierdził termin 15 lipca', author: 'Piotr Nowak', date: '2026-07-09 14:00', type: 'note' },
    ],
  },
  {
    id: 1004,
    dateReceived: '2026-07-09',
    client: { firstName: 'Agnieszka', lastName: 'Zielińska', phone: '604 789 012', email: 'a.zielinska@gmail.com' },
    city: 'Wrocław',
    auditor: null,
    estimatedAmount: null,
    stage: 1,
    daysInStage: 2,
    equipment: '–',
    triageResult: 'Dom 90m², 1 klimatyzator centralny',
    installationDate: null,
    team: null,
    notes: [
      { id: 1, text: '', author: 'System', date: '2026-07-09 12:00', type: 'status_change', oldStatus: '–', newStatus: 'Nowy lead' },
    ],
  },
  {
    id: 1005,
    dateReceived: '2026-07-07',
    client: { firstName: 'Krzysztof', lastName: 'Adamczyk', phone: '511 234 567', email: 'k.adamczyk@onet.pl' },
    city: 'Poznań',
    auditor: auditors[3],
    estimatedAmount: 6800,
    stage: 5,
    daysInStage: 0,
    equipment: 'Samsung WindFree',
    triageResult: 'Mieszkanie 50m², 1 pokój',
    installationDate: '2026-07-10',
    team: 'Ekipa Niebieska',
    notes: [],
  },
  {
    id: 1006,
    dateReceived: '2026-07-11',
    client: { firstName: 'Ewa', lastName: 'Kaczmarek', phone: '888 345 678', email: 'ewa.kaczmarek@yahoo.com' },
    city: 'Łódź',
    auditor: null,
    estimatedAmount: null,
    stage: 1,
    daysInStage: 0,
    equipment: '–',
    triageResult: 'Dom 150m², 3 klimatyzatory',
    installationDate: null,
    team: null,
    notes: [],
  },
  {
    id: 1007,
    dateReceived: '2026-07-05',
    client: { firstName: 'Michał', lastName: 'Pawlak', phone: '777 456 789', email: 'm.pawlak@gmail.com' },
    city: 'Katowice',
    auditor: auditors[0],
    estimatedAmount: 9200,
    stage: 2,
    daysInStage: 6,
    equipment: 'Mitsubishi Heavy Industries SRK25ZSP',
    triageResult: 'Dom 110m², 2 klimatyzatory naścienne',
    installationDate: null,
    team: null,
    notes: [],
  },
  {
    id: 1008,
    dateReceived: '2026-07-03',
    client: { firstName: 'Joanna', lastName: 'Wójcik', phone: '666 567 890', email: 'j.wojcik@poczta.fm' },
    city: 'Lublin',
    auditor: auditors[1],
    estimatedAmount: 18500,
    stage: 3,
    daysInStage: 4,
    equipment: 'Panasonic Etherea CS-XZ25ZKEW',
    triageResult: 'Sklep 80m², 2 jednostki kasetonowe',
    installationDate: null,
    team: null,
    notes: [],
  },
  {
    id: 1009,
    dateReceived: '2026-07-06',
    client: { firstName: 'Tomasz', lastName: 'Lewandowski', phone: '555 678 901', email: 't.lewandowski@interia.pl' },
    city: 'Szczecin',
    auditor: auditors[2],
    estimatedAmount: 14800,
    stage: 4,
    daysInStage: 1,
    equipment: 'Fujitsu ASYG12KETA',
    triageResult: 'Dom 130m², 3 klimatyzatory',
    installationDate: '2026-07-18',
    team: 'Ekipa Zielona',
    notes: [],
  },
];

export const customers: Customer[] = [
  { id: 1, firstName: 'Jan', lastName: 'Kowalczyk', email: 'jan.kowalczyk@gmail.com', phone: '600 123 456', leadsCount: 2, ltv: 14500 },
  { id: 2, firstName: 'Maria', lastName: 'Nowak', email: 'maria.nowak@wp.pl', phone: '501 987 654', leadsCount: 1, ltv: 12000 },
  { id: 3, firstName: 'Robert', lastName: 'Wiśniewski', email: 'r.wisniewski@firma.pl', phone: '798 456 123', leadsCount: 3, ltv: 48000 },
  { id: 4, firstName: 'Agnieszka', lastName: 'Zielińska', email: 'a.zielinska@gmail.com', phone: '604 789 012', leadsCount: 1, ltv: 0 },
  { id: 5, firstName: 'Krzysztof', lastName: 'Adamczyk', email: 'k.adamczyk@onet.pl', phone: '511 234 567', leadsCount: 1, ltv: 6800 },
  { id: 6, firstName: 'Ewa', lastName: 'Kaczmarek', email: 'ewa.kaczmarek@yahoo.com', phone: '888 345 678', leadsCount: 1, ltv: 0 },
  { id: 7, firstName: 'Michał', lastName: 'Pawlak', email: 'm.pawlak@gmail.com', phone: '777 456 789', leadsCount: 2, ltv: 18400 },
  { id: 8, firstName: 'Joanna', lastName: 'Wójcik', email: 'j.wojcik@poczta.fm', phone: '666 567 890', leadsCount: 1, ltv: 18500 },
  { id: 9, firstName: 'Tomasz', lastName: 'Lewandowski', email: 't.lewandowski@interia.pl', phone: '555 678 901', leadsCount: 1, ltv: 14800 },
];

export const notificationLogs: NotificationLog[] = [
  { id: 1, date: '2026-07-11 09:30', channel: 'SMS', recipient: 'Jan Kowalczyk (600 123 456)', content: 'Witaj! Twoje zapytanie zostało przyjęte. Niebawem skontaktuje się z Tobą nasz audytor.', status: 'Wysłano' },
  { id: 2, date: '2026-07-11 08:15', channel: 'Email', recipient: 'maria.nowak@wp.pl', content: 'Szanowna Pani Mario, przesyłamy wycenę na instalację klimatyzacji w Pani mieszkaniu...', status: 'Wysłano' },
  { id: 3, date: '2026-07-10 17:45', channel: 'SMS', recipient: 'Robert Wiśniewski (798 456 123)', content: 'Potwierdzenie terminu instalacji: 15 lipca 2026, godz. 9:00. Ekipa Czerwona.', status: 'Błąd' },
  { id: 4, date: '2026-07-10 16:30', channel: 'Email', recipient: 'r.wisniewski@firma.pl', content: 'Potwierdzenie terminu instalacji klimatyzacji w dniu 15.07.2026 w Pana biurze...', status: 'Wysłano' },
  { id: 5, date: '2026-07-10 14:00', channel: 'SMS', recipient: 'Krzysztof Adamczyk (511 234 567)', content: 'Twoja instalacja została zakończona. Dziękujemy za skorzystanie z usług KlikKlima!', status: 'Wysłano' },
  { id: 6, date: '2026-07-10 10:00', channel: 'Email', recipient: 'j.wojcik@poczta.fm', content: 'Szanowna Pani Joanno, przygotowaliśmy dla Pani indywidualną ofertę na klimatyzację...', status: 'Oczekuje' },
  { id: 7, date: '2026-07-09 15:30', channel: 'SMS', recipient: 'Agnieszka Zielińska (604 789 012)', content: 'Twoje zapytanie zostało przyjęte. Skontaktujemy się w ciągu 24h.', status: 'Błąd' },
  { id: 8, date: '2026-07-09 12:00', channel: 'Email', recipient: 'm.pawlak@gmail.com', content: 'Szanowny Panie Michale, potwierdzamy przyjęcie Pana zapytania o klimatyzację...', status: 'Wysłano' },
  { id: 9, date: '2026-07-08 11:00', channel: 'SMS', recipient: 'Tomasz Lewandowski (555 678 901)', content: 'Twoja wycena jest gotowa. Zapraszamy do kontaktu w celu potwierdzenia terminu.', status: 'Wysłano' },
];
