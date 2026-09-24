"use server";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

// Ten sam wzorzec czyszczenia i walidacji numeru co ExitIntentModal.tsx:39-42 — do dziś
// ta walidacja żyła WYŁĄCZNIE po stronie klienta i nic nie broniło Server Action wywołanej
// z pominięciem interfejsu (BLOCKER 4, recenzja 2026-09-24).
const PHONE_REGEX = /^(?:\+?48)?\d{9}$/;

const softLeadPhoneSchema = z
  .string()
  .transform((value) => value.replace(/[\s\-\(\)]/g, ""))
  .refine((value) => PHONE_REGEX.test(value), {
    message: "Numer telefonu nie przechodzi walidacji /^(?:+?48)?\\d{9}$/ (wzorzec ExitIntentModal.tsx:39-42).",
  });

// Kształt danych częściowych z kreatora Triage (store/triageStore.ts#TriageStateData).
// ŚCISŁY (`.strict()`) — żadne pole spoza tego kształtu (np. zagnieżdżona funkcja) nie
// trafia do insertu, jak działo się dziś przy zapisie kluczem service_role bez walidacji.
//
// B2C-SOFT-LEAD-CONSENT (contracts/requirements.contract.mjs, 2026-09-24, HIGH): zgoda
// WSKAZUJE KONKRETNĄ wersję dokumentu prawnego kluczem obcym do legal_document_versions
// (soft_leady.consent_version_id, migracja 20260926094000) — nigdy sama flaga logiczna,
// nigdy numer wersji jako tekst. Pole jest WYMAGANE na każdy zapis: brak zgody albo
// zgoda wskazana tekstem/flagą jest odrzucana identycznie jak brak pola.
const softLeadPartialDataSchema = z
  .object({
    location: z.string().nullable().optional(),
    roomCount: z.number().int().nullable().optional(),
    roomSizes: z.record(z.string(), z.string()).optional(),
    buildingState: z.string().nullable().optional(),
    hasBalcony: z.boolean().nullable().optional(),
    floor: z.string().nullable().optional(),
    selectedDate: z.union([z.date(), z.string(), z.null()]).optional(),
    selectedSlot: z.string().nullable().optional(),
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.union([z.string().email(), z.literal("")]).optional(),
    address: z.string().optional(),
    selectedDeviceLine: z.string().nullable().optional(),
    selectedInternalUnits: z.array(z.unknown()).optional(),
    selectedExternalUnit: z.unknown().nullable().optional(),
    priceDevices: z.number().optional(),
    priceInstallation: z.number().optional(),
    // FK do legal_document_versions.id — wzorem B2C-CONSENT-RODO, bez odstępstw.
    consentDocumentVersionId: z.string().uuid({
      message:
        "consentDocumentVersionId musi być kluczem obcym (UUID) do legal_document_versions — flaga logiczna albo numer wersji jako tekst nie wystarczają.",
    }),
  })
  .strict();

// B2C-SOFT-LEAD-CONSENT kryt. 4: formularz prezentuje ODNOŚNIK do polityki prywatności,
// a zgoda wskazuje TĘ SAMĄ wersję dokumentu, która jest prezentowana (B2C-CONTENT-PAGES).
//
// LUKA ZNANA, NIE DO ROZWIĄZANIA W TEJ ZMIANIE: `legal_document_versions.document_kind`
// ma dziś tylko RODO_CONSENT i EMPLOYEE_TERMS (packages/database/prisma/schema.prisma) —
// oba wzorem dokumentów PRACOWNICZYCH (Field App). Rejestr wersji dla dokumentów KLIENTA
// (polityka prywatności/regulamin B2C) to DOC-LEGAL-VERSION-REGISTRY, status TODO, jeszcze
// nie zbudowany — dziś w bazie nie istnieje ŻADEN wiersz reprezentujący "aktualną" politykę
// prywatności B2C do wskazania kluczem obcym. Ta funkcja czyta najbliższy istniejący
// odpowiednik (RODO_CONSENT) jako tymczasowe przybliżenie i zwraca `null`, gdy nie ma
// żadnej wersji `is_current` — wołający MUSI blokować wysyłkę przy `null`, nie fabrykować
// zgody. Prawdziwe domknięcie wymaga DOC-LEGAL-VERSION-REGISTRY (osobny Work Order).
export async function getCurrentSoftLeadConsentVersionId(): Promise<string | null> {
  try {
    const supabaseAdmin = getAdminClient();
    const { data, error } = await supabaseAdmin
      .from("legal_document_versions")
      .select("id")
      .eq("document_kind", "RODO_CONSENT")
      .eq("is_current", true)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data?.id ?? null;
  } catch (err: any) {
    console.error("Error reading current legal document version:", err.message);
    return null;
  }
}

export type SaveSoftLeadResult =
  | { success: true; deduped?: boolean }
  | { success: false; error: string };

// M8 — jednorazowość zapisu po stronie serwera, nie tylko sessionStorage klienta.
//
// DEDUPLIKACJA W PAMIĘCI PROCESU, NIE JEST GWARANCJĄ: tabela `soft_leady` NIE MA dziś
// unikalnego ograniczenia na `dane_kontaktowe` (sprawdzone: packages/database/prisma/schema.prisma,
// supabase/migrations/), więc ten `Set` jest jedynym zabezpieczeniem przed duplikatem —
// i to best-effort. Nie przetrwa restartu procesu ani nie chroni między wieloma instancjami/
// regionami (każda ma własną pamięć). Wcześniej ta funkcja używała `upsert(...,
// { onConflict: 'dane_kontaktowe' })`, co ZAKŁADAŁO istnienie unikalnego indeksu, którego nie
// ma — na żywym Postgresie/PostgREST to rzuca SQLSTATE 42P10 (brak pasującego ograniczenia
// ON CONFLICT), więc KAŻDY zapis soft leada kończył się błędem. Naprawione zwykłym `insert`
// (decyzja Michała 2026-09-24, D3). Prawdziwe rozwiązanie wymaga unikalnego indeksu na
// `dane_kontaktowe` w migracji — zarejestrowane jako dług do następnego okna kontraktowego.
const processedPhoneNumbers = new Set<string>();

export async function saveSoftLead(
  contactInfo: string,
  partialData: unknown,
): Promise<SaveSoftLeadResult> {
  const phoneResult = softLeadPhoneSchema.safeParse(contactInfo);
  if (!phoneResult.success) {
    return { success: false, error: "Nieprawidłowy numer telefonu." };
  }
  const cleanedPhone = phoneResult.data;

  const dataResult = softLeadPartialDataSchema.safeParse(partialData);
  if (!dataResult.success) {
    return {
      success: false,
      error: "Nieprawidłowy kształt danych albo brak zgody wskazującej wersję dokumentu.",
    };
  }

  // Patrz komentarz przy deklaracji `processedPhoneNumbers` powyżej.
  if (processedPhoneNumbers.has(cleanedPhone)) {
    return { success: true, deduped: true };
  }

  const { consentDocumentVersionId, ...domainData } = dataResult.data;

  try {
    const supabaseAdmin = getAdminClient();

    // `insert`, nie `upsert` — patrz komentarz przy `processedPhoneNumbers` powyżej (D3,
    // 2026-09-24). `upsert(..., { onConflict: 'dane_kontaktowe' })` zakładał unikalny indeks,
    // którego tabela nie ma, więc rzucał SQLSTATE 42P10 na każdym wywołaniu.
    const { error } = await supabaseAdmin.from("soft_leady").insert([
      {
        dane_kontaktowe: contactInfo,
        dane_cząstkowe: domainData,
        consent_version_id: consentDocumentVersionId,
        consent_granted_at: new Date().toISOString(),
      },
    ]);

    if (error) throw error;

    processedPhoneNumbers.add(cleanedPhone);

    return { success: true };
  } catch (err: any) {
    console.error("Error saving soft lead:", err.message);
    return { success: false, error: err.message };
  }
}

export async function submitFinalTriage(triageData: any, contactData: any, addressData: any) {
  try {
    const supabaseAdmin = getAdminClient();
    
    // First save the main lead
    const { data: leadData, error: leadError } = await supabaseAdmin
      .from("leady")
      .insert([
        {
          typ_klienta: "B2C",
          status_triage: "Wykonany",
          odpowiedzi_triage: triageData,
          sciezka_koncowa: triageData.sciezka_koncowa || "Path_Expert",
        }
      ])
      .select("id")
      .single();

    if (leadError) throw leadError;

    const leadId = leadData.id;

    // Then save the client info
    const { data: clientData, error: clientError } = await supabaseAdmin
      .from("klienci")
      .insert([
        {
          imie_nazwisko: contactData.name,
          telefon: contactData.phone,
          email: contactData.email,
        }
      ])
      .select("id")
      .single();

    if (clientError) throw clientError;

    const clientId = clientData.id;

    // Then save the address
    const { error: addressError } = await supabaseAdmin
      .from("adresy")
      .insert([
        {
          klient_id: clientId,
          ulica_miasto: addressData.fullAddress,
          // FLD-GEO-COORDS / WO B2C-LEAD-GEO-PERSIST R2: kolumny to latitude/longitude
          // (schema.prisma:63-64), nie lat/lng — insert pod tymi ostatnimi wywalał się
          // na `addressError` przy każdym wywołaniu.
          latitude: addressData.lat,
          longitude: addressData.lng,
        }
      ]);

    if (addressError) throw addressError;

    // Also link the client to the lead (requires updating the lead)
    const { error: linkError } = await supabaseAdmin
      .from("leady")
      .update({ klient_id: clientId })
      .eq("id", leadId);

    if (linkError) throw linkError;

    return { success: true, leadId };
  } catch (err: any) {
    console.error("Error submitting final triage:", err.message);
    return { success: false, error: err.message };
  }
}
