-- BASELINE — wygenerowane z `packages/database/prisma/schema.prisma`, 2026-08-21.
--
-- NIE URUCHAMIAĆ na produkcyjnym Supabase. Baza w tym stanie już istnieje — powstała
-- poza repozytorium (żadnego śladu w `supabase/migrations/` sprzed tego dnia), więc ten
-- plik nikogo nie tworzy, tylko ZAPISUJE stan potwierdzony introspekcją (`prisma db pull`
-- + ręczne porównanie pole po polu z `schema.prisma`, zero różnic kolumnowych poza
-- migracją współrzędnych zastosowaną tego samego dnia).
--
-- Przeznaczenie: odtwarzanie środowisk testowych/deweloperskich od pustego Postgresa.
-- Migracje od `20260820120000` wzwyż są realnym przyrostem nad tym stanem i one — nie ten
-- plik — jedyne mają prawo dotykać produkcji.
--
-- Wygenerowane: `npx prisma migrate diff --from-empty --to-schema-datamodel
-- packages/database/prisma/schema.prisma --script`.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW_LEAD', 'AWAITING_AUDIT', 'AUDIT_COMPLETED', 'AWAITING_CREW_ASSIGNMENT', 'HARDWARE_IN_WAREHOUSE', 'HARDWARE_IN_TRANSIT', 'AWAITING_INSTALLATION', 'INSTALLATION_COMPLETED', 'QUOTE_REJECTED', 'ROLLBACK_RESCHEDULING', 'ARCHIVED_LOST');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('PLANNED', 'SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID', 'PENDING');

-- CreateEnum
CREATE TYPE "status_leada_enum" AS ENUM ('Nowy', 'Weryfikacja', 'Umówiony Audyt', 'Zrealizowane', 'Soft Lead', 'Utracony');

-- CreateEnum
CREATE TYPE "InstallationStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShippingStatus" AS ENUM ('PENDING', 'SHIPPED', 'DELIVERED');

-- CreateTable
CREATE TABLE "indoor_units" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "model_code" TEXT NOT NULL,
    "series_name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "is_single_compatible" BOOLEAN DEFAULT false,
    "is_multi_compatible" BOOLEAN DEFAULT false,
    "cooling_capacity_kw" DECIMAL,
    "heating_capacity_kw" DECIMAL,
    "power_consumption_cooling_kw" DECIMAL,
    "power_consumption_heating_kw" DECIMAL,
    "dimensions" TEXT,
    "noise_level_min_db" INTEGER,
    "has_wifi" BOOLEAN DEFAULT false,
    "has_presence_sensor" BOOLEAN DEFAULT false,
    "is_silent_mode" BOOLEAN DEFAULT false,
    "price_netto" DECIMAL,
    "image_url" TEXT,
    "marketing_description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "color" TEXT DEFAULT 'Biały',
    "recommended_area_m2" INTEGER,
    "features" JSONB,

    CONSTRAINT "indoor_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "klienci" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "imie_i_nazwisko" TEXT,
    "email" TEXT,
    "telefon" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "klienci_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adresy" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "klient_id" UUID,
    "ulica_miasto" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "adresy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorizedUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthorizedUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leady" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "klient_id" UUID,
    "adres_id" UUID,
    "odpowiedzi_triage" JSONB,
    "wybrana_konfiguracja" JSONB,
    "estymowana_wycena" TEXT,
    "status" "LeadStatus" DEFAULT 'NEW_LEAD',
    "audytor_id" UUID,
    "data_rezerwacji" TIMESTAMPTZ(6),
    "finalna_wycena_pln" DECIMAL,
    "przewidywany_czas_montazu" TEXT,
    "notatki_wewnetrzne" TEXT,
    "bucket_entered_at" TIMESTAMPTZ(6),
    "quoted_at" TIMESTAMPTZ(6),
    "lost_reason" TEXT,
    "lost_reason_note" TEXT,
    "auto_rejected_reason" TEXT,
    "last_followup_date" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "leady_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "multi_split_sets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "outdoor_unit_id" UUID NOT NULL,
    "indoor_units_json" JSONB NOT NULL,
    "supported_rooms_count" INTEGER,
    "set_price_netto" DECIMAL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "is_bestseller" BOOLEAN DEFAULT false,

    CONSTRAINT "multi_split_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outdoor_units" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "model_code" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "max_indoor_units" INTEGER DEFAULT 1,
    "cooling_capacity_kw" DECIMAL,
    "heating_capacity_kw" DECIMAL,
    "max_total_indoor_capacity_kw" DECIMAL,
    "dimensions" TEXT,
    "price_netto" DECIMAL,
    "image_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "outdoor_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "single_split_sets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "indoor_unit_id" UUID NOT NULL,
    "outdoor_unit_id" UUID NOT NULL,
    "seer" DECIMAL,
    "scop" DECIMAL,
    "energy_class_cooling" TEXT,
    "energy_class_heating" TEXT,
    "set_price_netto" DECIMAL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "is_bestseller" BOOLEAN DEFAULT false,

    CONSTRAINT "single_split_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "soft_leady" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dane_kontaktowe" TEXT NOT NULL,
    "dane_cząstkowe" JSONB,
    "status" TEXT DEFAULT 'Nowy',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "soft_leady_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_config" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "typ_konfiguracji" TEXT NOT NULL,
    "konfiguracja" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zespoly_monterskie" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nazwa" TEXT NOT NULL,
    "telefon_kontaktowy" TEXT,
    "email" TEXT,
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "nip" TEXT,
    "koordynator_imie_nazwisko" TEXT,
    "certyfikat_fgaz" TEXT,
    "uprawnienia_sep" BOOLEAN NOT NULL DEFAULT false,
    "kod_pocztowy_bazowy" TEXT,
    "promien_dzialania_km" INTEGER,
    "liczba_brygad" INTEGER NOT NULL DEFAULT 1,
    "posiada_wiertnice" BOOLEAN NOT NULL DEFAULT false,
    "zdjecie_url" TEXT,
    "fgaz_valid_until" DATE,
    "sep_valid_until" DATE,
    "iban" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "zespoly_monterskie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instalacje" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lead_id" UUID NOT NULL,
    "zespol_id" UUID,
    "data_planowana" TIMESTAMPTZ(6),
    "data_zakonczenia" TIMESTAMPTZ(6),
    "protokol_url" TEXT,
    "next_service_date" DATE,
    "status" "InstallationStatus" NOT NULL DEFAULT 'PLANNED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "instalacje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serwisy" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "klient_id" UUID,
    "adres_id" UUID,
    "instalacja_id" UUID,
    "zespol_id" UUID,
    "opis_usterki" TEXT,
    "data_zgloszenia" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "data_realizacji" TIMESTAMPTZ(6),
    "status" "ServiceStatus" NOT NULL DEFAULT 'PLANNED',

    CONSTRAINT "serwisy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logistyka_zamowienia" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lead_id" UUID NOT NULL,
    "status_wysylki" "ShippingStatus" NOT NULL DEFAULT 'PENDING',
    "nr_listu_przewozowego" TEXT,
    "firma_kurierska" TEXT,
    "tracking_id" TEXT,
    "data_wysylki" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "logistyka_zamowienia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modele_3d" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nazwa" TEXT NOT NULL,
    "plik_url" TEXT NOT NULL,
    "kategoria" TEXT,
    "indoor_unit_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "modele_3d_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audytorzy" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "imie_i_nazwisko" TEXT NOT NULL,
    "telefon" TEXT,
    "email" TEXT,
    "nazwa_firmy" TEXT,
    "nip" TEXT,
    "adres" TEXT,
    "zdjecie_url" TEXT,
    "certyfikat_fgaz" TEXT,
    "doswiadczenie_hvac_lata" INTEGER,
    "uprawnienia_sep" BOOLEAN NOT NULL DEFAULT false,
    "preferowane_marki" TEXT[],
    "kod_pocztowy_bazowy" TEXT,
    "max_promien_dojazdu_km" INTEGER,
    "fgaz_valid_until" DATE,
    "sep_valid_until" DATE,
    "iban" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "audytorzy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usterki_incidents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "numer_zgloszenia" TEXT,
    "klient_id" UUID,
    "instalacja_id" UUID,
    "zespol_id" UUID,
    "priorytet" TEXT DEFAULT 'NISKI',
    "status" TEXT DEFAULT 'NOWE',
    "opis_usterki" TEXT,
    "zdjecia_url" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "usterki_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cennik_uslug" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nazwa_uslugi" TEXT NOT NULL,
    "jm" TEXT NOT NULL,
    "koszt_b2c_netto" DECIMAL NOT NULL,
    "koszt_b2b_netto" DECIMAL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cennik_uslug_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "indoor_units_model_code_key" ON "indoor_units"("model_code");

-- CreateIndex
CREATE UNIQUE INDEX "AuthorizedUser_email_key" ON "AuthorizedUser"("email");

-- CreateIndex
CREATE INDEX "leady_status_idx" ON "leady"("status");

-- CreateIndex
CREATE INDEX "leady_created_at_idx" ON "leady"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "outdoor_units_model_code_key" ON "outdoor_units"("model_code");

-- CreateIndex
CREATE UNIQUE INDEX "single_split_sets_indoor_unit_id_outdoor_unit_id_key" ON "single_split_sets"("indoor_unit_id", "outdoor_unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_config_typ_konfiguracji_key" ON "system_config"("typ_konfiguracji");

-- CreateIndex
CREATE UNIQUE INDEX "usterki_incidents_numer_zgloszenia_key" ON "usterki_incidents"("numer_zgloszenia");

-- CreateIndex
CREATE UNIQUE INDEX "cennik_uslug_nazwa_uslugi_key" ON "cennik_uslug"("nazwa_uslugi");

-- AddForeignKey
ALTER TABLE "adresy" ADD CONSTRAINT "adresy_klient_id_fkey" FOREIGN KEY ("klient_id") REFERENCES "klienci"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leady" ADD CONSTRAINT "leady_klient_id_fkey" FOREIGN KEY ("klient_id") REFERENCES "klienci"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leady" ADD CONSTRAINT "leady_adres_id_fkey" FOREIGN KEY ("adres_id") REFERENCES "adresy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leady" ADD CONSTRAINT "leady_audytor_id_fkey" FOREIGN KEY ("audytor_id") REFERENCES "audytorzy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instalacje" ADD CONSTRAINT "instalacje_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leady"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instalacje" ADD CONSTRAINT "instalacje_zespol_id_fkey" FOREIGN KEY ("zespol_id") REFERENCES "zespoly_monterskie"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serwisy" ADD CONSTRAINT "serwisy_klient_id_fkey" FOREIGN KEY ("klient_id") REFERENCES "klienci"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serwisy" ADD CONSTRAINT "serwisy_adres_id_fkey" FOREIGN KEY ("adres_id") REFERENCES "adresy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serwisy" ADD CONSTRAINT "serwisy_instalacja_id_fkey" FOREIGN KEY ("instalacja_id") REFERENCES "instalacje"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serwisy" ADD CONSTRAINT "serwisy_zespol_id_fkey" FOREIGN KEY ("zespol_id") REFERENCES "zespoly_monterskie"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistyka_zamowienia" ADD CONSTRAINT "logistyka_zamowienia_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leady"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modele_3d" ADD CONSTRAINT "modele_3d_indoor_unit_id_fkey" FOREIGN KEY ("indoor_unit_id") REFERENCES "indoor_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usterki_incidents" ADD CONSTRAINT "usterki_incidents_klient_id_fkey" FOREIGN KEY ("klient_id") REFERENCES "klienci"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usterki_incidents" ADD CONSTRAINT "usterki_incidents_instalacja_id_fkey" FOREIGN KEY ("instalacja_id") REFERENCES "instalacje"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usterki_incidents" ADD CONSTRAINT "usterki_incidents_zespol_id_fkey" FOREIGN KEY ("zespol_id") REFERENCES "zespoly_monterskie"("id") ON DELETE SET NULL ON UPDATE CASCADE;

