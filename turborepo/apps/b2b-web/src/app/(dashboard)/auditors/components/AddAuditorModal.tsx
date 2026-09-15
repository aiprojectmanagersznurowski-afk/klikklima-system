"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import usePlacesAutocomplete from 'use-places-autocomplete';
import type { AuditorEditRecord } from '../actions';
import { auditorSchema } from '../schema';
import { buildAuditorFormData } from './buildAuditorFormData';

/**
 * CRM-AUDYT-KARTOTEKA (D1): schemat Zod dzielony z Server Action
 * (`../schema.ts`) — klucze to nazwy kolumn Prisma (imie_i_nazwisko,
 * telefon, ...), tego oczekują createAuditorAction/updateAuditorAction. Nie
 * ujednolicaj z konwencją krótkich nazw używaną przez formularz zespołu
 * (AddCrewModal) — to świadomy rozjazd między dwoma plikami akcji, opisany w
 * WO CRM-KARTOTEKI-CREATE-AND-CREW-ASSIGN.
 *
 * Formularz operuje na SUROWYCH wejściach tekstowych (`z.input`), bo pola
 * `<input>` zawsze produkują stringi — walidację i koercję (liczby, daty,
 * boolean, JSON marek) wykonuje wspólny schemat dopiero na serwerze / przy
 * `handleSubmit`.
 */
const auditorFormSchema = auditorSchema;

type AuditorFormValues = z.input<typeof auditorFormSchema>;

const EMPTY_VALUES: AuditorFormValues = {
  imie_i_nazwisko: '',
  telefon: '',
  email: '',
  adres: '',
  nazwa_firmy: '',
  nip: '',
  certyfikat_fgaz: '',
  fgaz_valid_until: '',
  sep_valid_until: '',
  doswiadczenie_hvac_lata: '',
  uprawnienia_sep: false,
  preferowane_marki: '[]',
  kod_pocztowy_bazowy: '',
  promien_dzialania_km: '',
  iban: '',
};

function toDefaultValues(initialData?: AuditorEditRecord | null): AuditorFormValues {
  if (!initialData) return EMPTY_VALUES;
  return {
    imie_i_nazwisko: initialData.imie_i_nazwisko || '',
    telefon: initialData.telefon || '',
    email: initialData.email || '',
    adres: initialData.adres || '',
    nazwa_firmy: initialData.nazwa_firmy || '',
    nip: initialData.nip || '',
    certyfikat_fgaz: initialData.certyfikat_fgaz || '',
    // ERRATA A-2: `Date | null` -> string `YYYY-MM-DD` dla <input type="date">.
    // toISOString().slice(0,10) czyta komponenty UTC bez przesunięcia strefy,
    // spójnie z tym, jak akcja zapisuje `new Date('YYYY-MM-DD')` jako północ UTC.
    fgaz_valid_until: initialData.fgaz_valid_until ? initialData.fgaz_valid_until.toISOString().slice(0, 10) : '',
    sep_valid_until: initialData.sep_valid_until ? initialData.sep_valid_until.toISOString().slice(0, 10) : '',
    doswiadczenie_hvac_lata: initialData.doswiadczenie_hvac_lata?.toString() || '',
    uprawnienia_sep: initialData.uprawnienia_sep || false,
    preferowane_marki: JSON.stringify(initialData.preferowane_marki || []),
    kod_pocztowy_bazowy: initialData.kod_pocztowy_bazowy || '',
    promien_dzialania_km: initialData.promien_dzialania_km?.toString() || '',
    iban: initialData.iban || '',
  };
}

export interface AddAuditorModalSaveResult {
  success: boolean;
  error?: string;
}

interface AddAuditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * `photoFile` to plik wybrany przez użytkownika (jeszcze nie wgrany do
   * Supabase Storage) — upload i doklejenie ścieżki do `zdjecie_url` należy
   * do wywołującego (auditors-client.tsx), bo tam znane jest `id` rekordu
   * (nowo utworzonego albo edytowanego) potrzebne do nazwy pliku.
   */
  onSave: (formData: FormData, photoFile: File | null) => Promise<AddAuditorModalSaveResult>;
  initialData?: AuditorEditRecord | null;
  /** Trwa pobieranie initialData (getAuditorForEdit) — pokaż stan ładowania zamiast formularza. */
  isLoadingInitialData?: boolean;
}

export function AddAuditorModal({ open, onOpenChange, onSave, initialData, isLoadingInitialData }: AddAuditorModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<AuditorFormValues>({
    resolver: zodResolver(auditorFormSchema),
    defaultValues: EMPTY_VALUES,
  });

  const {
    ready,
    value,
    suggestions: { status, data },
    setValue: setAutocompleteValue,
    clearSuggestions,
  } = usePlacesAutocomplete({
    requestOptions: {
      componentRestrictions: { country: "pl" },
    },
    debounce: 300,
  });

  useEffect(() => {
    if (open) {
      const defaults = toDefaultValues(initialData);
      reset(defaults);
      setAutocompleteValue(defaults.adres || '', false);
      setPhotoPreview(initialData?.zdjecie_url || null);
      setPhotoFile(null);
      setSubmitError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialData]);

  const handleSelect = async (address: string) => {
    setAutocompleteValue(address, false);
    setValue('adres', address);
    clearSuggestions();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (values: AuditorFormValues) => {
    setIsSubmitting(true);
    setSubmitError(null);

    // @hookform/resolvers@3.10 typuje Resolver na jeden generyk (TFieldValues
    // wejsciowy), wiec `values` jest tu formalnie typu z.input — ale w
    // runtime react-hook-form przekazuje do onSubmit WYNIK zodResolver
    // (z.output, po transformacjach), nie surowe wejscie. Zweryfikowane
    // bezposrednio (patrz recenzja BLOCKER, WO BATCH-MEDIUM-LOW-CLEANUP.md).
    // Rzutowanie mostkuje luke w deklaracji typu biblioteki, nie ukrywa bledu.
    const resolvedValues = values as unknown as z.output<typeof auditorFormSchema>;
    const data = buildAuditorFormData(resolvedValues);

    const result = await onSave(data, photoFile);
    setIsSubmitting(false);
    if (result.success) {
      onOpenChange(false);
    } else {
      setSubmitError(result.error ?? "Nie udało się zapisać audytora.");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div
        className="fixed inset-0 bg-foreground/40 backdrop-blur-xs transition-opacity"
        onClick={() => onOpenChange(false)}
      />

      <div className="relative z-50 w-full max-w-2xl bg-card rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200 font-sans">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            {initialData ? "Edytuj audytora" : "Dodaj nowego audytora"}
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoadingInitialData ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 max-h-[80vh] overflow-y-auto">
          <input type="hidden" {...register('preferowane_marki')} />

          <div className="flex flex-col items-center mb-8">
            <div
              className="relative group cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-20 h-20 rounded-full bg-secondary border-2 border-dashed border-border flex items-center justify-center overflow-hidden group-hover:border-primary/50 transition-colors relative">
                {photoPreview ? (
                  <>
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="w-6 h-6 text-white" />
                    </div>
                  </>
                ) : (
                  <Camera className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                )}
              </div>
              <div className="mt-3 text-sm font-medium text-primary hover:underline text-center">
                Wgraj zdjęcie profilowe
              </div>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
            />
          </div>

          <h3 className="text-base font-semibold text-foreground mb-4">Podstawowe dane</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-1.5">
              <label htmlFor="imie_i_nazwisko" className="text-sm font-medium text-foreground">Imię i nazwisko <span className="text-destructive">*</span></label>
              <input
                id="imie_i_nazwisko"
                type="text"
                placeholder="np. Jan Kowalski"
                aria-invalid={!!errors.imie_i_nazwisko}
                className="w-full px-3 py-2 bg-input-background border border-border rounded-md shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary text-sm text-foreground transition-shadow placeholder:text-muted-foreground aria-invalid:border-destructive aria-invalid:ring-destructive/20"
                {...register('imie_i_nazwisko')}
              />
              {errors.imie_i_nazwisko && (
                <p className="text-sm text-destructive font-medium mt-1">{errors.imie_i_nazwisko.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="telefon" className="text-sm font-medium text-foreground">Telefon</label>
              <input
                id="telefon"
                type="tel"
                placeholder="+48 000 000 000"
                className="w-full px-3 py-2 bg-input-background border border-border rounded-md shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary text-sm text-foreground transition-shadow placeholder:text-muted-foreground"
                {...register('telefon')}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-foreground">Email</label>
              <input
                id="email"
                type="email"
                placeholder="jan@example.com"
                aria-invalid={!!errors.email}
                className="w-full px-3 py-2 bg-input-background border border-border rounded-md shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary text-sm text-foreground transition-shadow placeholder:text-muted-foreground aria-invalid:border-destructive aria-invalid:ring-destructive/20"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-destructive font-medium mt-1">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5 relative">
              <label htmlFor="adres" className="text-sm font-medium text-foreground">Adres / Miasto</label>
              <input
                id="adres"
                type="text"
                placeholder="np. Warszawa, ul. Główna 1"
                value={value}
                onChange={(e) => {
                  setAutocompleteValue(e.target.value);
                  setValue('adres', e.target.value);
                }}
                disabled={!ready}
                className="w-full px-3 py-2 bg-input-background border border-border rounded-md shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary text-sm text-foreground transition-shadow placeholder:text-muted-foreground"
              />
              {status === "OK" && (
                <ul className="absolute z-10 left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {data.map(({ place_id, description }) => (
                    <li
                      key={place_id}
                      onClick={() => handleSelect(description)}
                      className="px-4 py-3 hover:bg-secondary cursor-pointer transition-colors text-sm text-foreground border-b border-border last:border-0"
                    >
                      {description}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="nazwa_firmy" className="text-sm font-medium text-foreground">Nazwa firmy</label>
              <input
                id="nazwa_firmy"
                type="text"
                placeholder="Wpisz nazwę firmy"
                className="w-full px-3 py-2 bg-input-background border border-border rounded-md shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary text-sm text-foreground transition-shadow placeholder:text-muted-foreground"
                {...register('nazwa_firmy')}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="nip" className="text-sm font-medium text-foreground">NIP</label>
              <input
                id="nip"
                type="text"
                placeholder="000-000-00-00"
                className="w-full px-3 py-2 bg-input-background border border-border rounded-md shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary text-sm text-foreground font-mono transition-shadow placeholder:text-muted-foreground"
                {...register('nip')}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="certyfikat_fgaz" className="text-sm font-medium text-foreground">Nr certyfikatu F-GAZ</label>
              <input
                id="certyfikat_fgaz"
                type="text"
                placeholder="np. FGAZ/1234/2024"
                className="w-full px-3 py-2 bg-input-background border border-border rounded-md shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary text-sm text-foreground font-mono transition-shadow placeholder:text-muted-foreground"
                {...register('certyfikat_fgaz')}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="fgaz_valid_until" className="text-sm font-medium text-foreground">Data ważności certyfikatu F-GAZ</label>
              <input
                id="fgaz_valid_until"
                type="date"
                className="w-full px-3 py-2 bg-input-background border border-border rounded-md shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary text-sm text-foreground transition-shadow"
                {...register('fgaz_valid_until')}
              />
            </div>
          </div>

          <h3 className="text-base font-semibold text-foreground mb-4 mt-8">Kwalifikacje i Logistyka</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-1.5">
              <label htmlFor="doswiadczenie_hvac_lata" className="text-sm font-medium text-foreground">Doświadczenie HVAC (lata)</label>
              <input
                id="doswiadczenie_hvac_lata"
                type="number"
                min="0"
                className="w-full px-3 py-2 bg-input-background border border-border rounded-md shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary text-sm text-foreground transition-shadow"
                {...register('doswiadczenie_hvac_lata')}
              />
            </div>

            <div className="space-y-1.5 flex items-center mt-6">
              <input
                id="uprawnienia_sep"
                type="checkbox"
                className="w-4 h-4 text-primary accent-primary border-border rounded focus-visible:ring-2 focus-visible:ring-primary"
                {...register('uprawnienia_sep')}
              />
              <label htmlFor="uprawnienia_sep" className="ml-2 block text-sm text-foreground">Uprawnienia SEP do 1kV</label>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="sep_valid_until" className="text-sm font-medium text-foreground">Data ważności uprawnień SEP</label>
              <input
                id="sep_valid_until"
                type="date"
                className="w-full px-3 py-2 bg-input-background border border-border rounded-md shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary text-sm text-foreground transition-shadow"
                {...register('sep_valid_until')}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="kod_pocztowy_bazowy" className="text-sm font-medium text-foreground">Bazowy kod pocztowy</label>
              <input
                id="kod_pocztowy_bazowy"
                type="text"
                placeholder="XX-XXX"
                className="w-full px-3 py-2 bg-input-background border border-border rounded-md shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary text-sm text-foreground font-mono transition-shadow placeholder:text-muted-foreground"
                {...register('kod_pocztowy_bazowy')}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="promien_dzialania_km" className="text-sm font-medium text-foreground">Max promień dojazdu (km)</label>
              <input
                id="promien_dzialania_km"
                type="number"
                min="10"
                className="w-full px-3 py-2 bg-input-background border border-border rounded-md shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary text-sm text-foreground transition-shadow"
                {...register('promien_dzialania_km')}
              />
            </div>
          </div>

          <h3 className="text-base font-semibold text-foreground mb-4 mt-8">Finanse</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-1.5">
              <label htmlFor="iban" className="text-sm font-medium text-foreground">IBAN</label>
              <input
                id="iban"
                type="text"
                placeholder="PL..."
                className="w-full px-3 py-2 bg-input-background border border-border rounded-md shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary text-sm text-foreground font-mono transition-shadow placeholder:text-muted-foreground"
                {...register('iban')}
              />
            </div>
          </div>

          {submitError && (
            <p className="text-sm text-destructive font-medium mb-4" role="alert">{submitError}</p>
          )}

          <div className="mt-8 flex justify-end space-x-3 pt-6 border-t border-border">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-5 py-2.5 text-sm font-medium text-foreground bg-card border border-border rounded-md hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors cursor-pointer"
            >
              Anuluj
            </button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 text-sm font-medium text-primary-foreground bg-primary border border-transparent rounded-md hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors shadow-xs cursor-pointer"
            >
              {isSubmitting ? "Zapisywanie..." : "Zapisz"}
            </Button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
