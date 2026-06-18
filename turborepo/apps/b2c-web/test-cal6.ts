function getWarsawDateString(date: Date) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(date);
}

const today = new Date();
console.log('Today Warsaw:', getWarsawDateString(today));

const tomorrow = new Date(today.getTime() + 24*60*60*1000);
console.log('Tomorrow Warsaw:', getWarsawDateString(tomorrow));

