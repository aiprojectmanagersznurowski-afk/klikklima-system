import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.audytorzy.create({
    data: {
      imie_i_nazwisko: "Testowy Audytor",
      telefon: "123456789",
      email: "test@klikklima.pl",
      nazwa_firmy: "Firma Testowa",
      nip: "1234567890",
      certyfikat_fgaz: "FGAZ-1234",
    },
  });
  console.log("Dodano testowego audytora");
}
main().catch(console.error).finally(() => prisma.$disconnect());
