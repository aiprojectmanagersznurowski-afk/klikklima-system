"use client";

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CrewEditRecord } from '../actions';

/**
 * CRM-ZESP-KARTOTEKA (D-A1): klucze schematu to KRÓTKIE angielskie nazwy
 * (`name`, `phone`, `coordinator`, ...) — tego oczekują
 * createCrewAction/updateCrewAction. To INNA konwencja niż audytor
 * (AddAuditorModal używa nazw kolumn Prisma) — świadomy rozjazd między
 * dwoma plikami akcji, nie ujednolicaj na własną rękę.
 */
const crewFormSchema = z.object({
  name: z.string().trim().min(1, "Nazwa ekipy jest wymagana."),
  phone: z.string().optional(),
  email: z.union([z.literal(''), z.string().trim().email("Niepoprawny format e-mail.")]),
  nip: z.string().optional(),
  coordinator: z.string().optional(),
  fgazCert: z.string().optional(),
  sep: z.boolean(),
  zipCode: z.string().optional(),
  radius: z.string().optional(),
  teamsCount: z.string().optional(),
  drillingRig: z.boolean(),
  iban: z.string().optional(),
});

type CrewFormValues = z.infer<typeof crewFormSchema>;

const EMPTY_VALUES: CrewFormValues = {
  name: '',
  phone: '',
  email: '',
  nip: '',
  coordinator: '',
  fgazCert: '',
  sep: false,
  zipCode: '',
  radius: '',
  teamsCount: '1',
  drillingRig: false,
  iban: '',
};

function toDefaultValues(initialData?: CrewEditRecord | null): CrewFormValues {
  if (!initialData) return EMPTY_VALUES;
  return {
    name: initialData.nazwa || '',
    phone: initialData.telefon_kontaktowy || '',
    email: initialData.email || '',
    nip: initialData.nip || '',
    coordinator: initialData.koordynator_imie_nazwisko || '',
    fgazCert: initialData.certyfikat_fgaz || '',
    sep: initialData.uprawnienia_sep || false,
    zipCode: initialData.kod_pocztowy_bazowy || '',
    radius: initialData.promien_dzialania_km?.toString() || '',
    teamsCount: initialData.liczba_brygad?.toString() || '1',
    drillingRig: initialData.posiada_wiertnice || false,
    iban: initialData.iban || '',
  };
}

export interface AddCrewModalSaveResult {
  success: boolean;
  error?: string;
}

interface AddCrewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * `photoFile` to plik wybrany przez użytkownika — upload do Supabase
   * Storage i doklejenie ścieżki (updateCrewAvatar / trzeci argument
   * updateCrewAction) należy do wywołującego (crews-client.tsx), bo tam
   * znane jest `id` rekordu potrzebne do nazwy pliku.
   */
  onSave: (formData: FormData, photoFile: File | null) => Promise<AddCrewModalSaveResult>;
  initialData?: CrewEditRecord | null;
  isLoadingInitialData?: boolean;
}

export function AddCrewModal({ open, onOpenChange, onSave, initialData, isLoadingInitialData }: AddCrewModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CrewFormValues>({
    resolver: zodResolver(crewFormSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (open) {
      reset(toDefaultValues(initialData));
      setPhotoFile(null);
      setPhotoPreview(initialData?.zdjecie_url || null);
      setSubmitError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialData]);

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

  const onSubmit = async (values: CrewFormValues) => {
    setIsSubmitting(true);
    setSubmitError(null);

    const data = new FormData();
    Object.entries(values).forEach(([key, val]) => {
      if (typeof val === 'boolean') {
        data.append(key, val ? 'true' : 'false');
      } else if (val !== undefined && val !== null) {
        data.append(key, String(val));
      }
    });

    const result = await onSave(data, photoFile);
    setIsSubmitting(false);
    if (result.success) {
      onOpenChange(false);
    } else {
      setSubmitError(result.error ?? "Nie udało się zapisać ekipy.");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div
        className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
        onClick={() => onOpenChange(false)}
      />

      <div className="relative z-50 w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 font-sans">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">
            {initialData ? "Edytuj Ekipę" : "Dodaj Ekipę Monterską"}
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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

          <div className="flex flex-col items-center mb-8">
            <label
              htmlFor="crew-photo-input"
              className="flex flex-col items-center cursor-pointer group"
            >
              <div className="w-20 h-20 rounded-full bg-gray-50 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden group-hover:border-blue-400 transition-colors">
                {photoPreview ? (
                  <img src={photoPreview} alt="Podgląd" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-6 h-6 text-gray-400 group-hover:text-blue-500 transition-colors" />
                )}
              </div>
              <span className="mt-3 text-sm font-medium text-blue-600 group-hover:text-blue-700 text-center">
                Wgraj zdjęcie zespołu
              </span>
            </label>
            <input
              id="crew-photo-input"
              type="file"
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
            />
          </div>

          <h3 className="text-lg font-medium text-gray-900 mb-4">Biznes</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-sm font-medium text-gray-700">Nazwa Ekipy <span className="text-red-500">*</span></label>
              <input
                id="name"
                type="text"
                aria-invalid={!!errors.name}
                className="w-full px-3 py-2 border rounded-lg aria-invalid:border-destructive aria-invalid:ring-destructive/20"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive font-medium mt-1">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="coordinator" className="text-sm font-medium text-gray-700">Koordynator (Imię i nazwisko)</label>
              <input id="coordinator" type="text" className="w-full px-3 py-2 border rounded-lg" {...register('coordinator')} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="nip" className="text-sm font-medium text-gray-700">NIP</label>
              <input id="nip" type="text" placeholder="000-000-00-00" className="w-full px-3 py-2 border rounded-lg" {...register('nip')} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="phone" className="text-sm font-medium text-gray-700">Telefon</label>
              <input id="phone" type="tel" className="w-full px-3 py-2 border rounded-lg" {...register('phone')} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-gray-700">Email</label>
              <input
                id="email"
                type="email"
                aria-invalid={!!errors.email}
                className="w-full px-3 py-2 border rounded-lg aria-invalid:border-destructive aria-invalid:ring-destructive/20"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-destructive font-medium mt-1">{errors.email.message}</p>
              )}
            </div>
          </div>

          <h3 className="text-lg font-medium text-gray-900 mb-4">Kwalifikacje</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-1.5">
              <label htmlFor="fgazCert" className="text-sm font-medium text-gray-700">Nr certyfikatu F-GAZ</label>
              <input id="fgazCert" type="text" className="w-full px-3 py-2 border rounded-lg" {...register('fgazCert')} />
            </div>
            <div className="space-y-1.5 flex items-center mt-6">
              <input
                id="sep"
                type="checkbox"
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus-visible:ring-2 focus-visible:ring-primary"
                {...register('sep')}
              />
              <label htmlFor="sep" className="ml-2 block text-sm text-gray-900">Uprawnienia SEP do 1kV</label>
            </div>
          </div>

          <h3 className="text-lg font-medium text-gray-900 mb-4">Logistyka</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-1.5">
              <label htmlFor="zipCode" className="text-sm font-medium text-gray-700">Bazowy kod pocztowy</label>
              <input id="zipCode" type="text" placeholder="XX-XXX" className="w-full px-3 py-2 border rounded-lg" {...register('zipCode')} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="radius" className="text-sm font-medium text-gray-700">Promień działania (km)</label>
              <input id="radius" type="number" min="10" className="w-full px-3 py-2 border rounded-lg" {...register('radius')} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="teamsCount" className="text-sm font-medium text-gray-700">Liczba dostępnych brygad</label>
              <input id="teamsCount" type="number" min="1" className="w-full px-3 py-2 border rounded-lg" {...register('teamsCount')} />
            </div>
            <div className="space-y-1.5 flex items-center mt-6">
              <input
                id="drillingRig"
                type="checkbox"
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus-visible:ring-2 focus-visible:ring-primary"
                {...register('drillingRig')}
              />
              <label htmlFor="drillingRig" className="ml-2 block text-sm text-gray-900">Wiertnica do żelbetu</label>
            </div>
          </div>

          <h3 className="text-lg font-medium text-gray-900 mb-4">Finanse</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-1.5">
              <label htmlFor="iban" className="text-sm font-medium text-gray-700">IBAN</label>
              <input id="iban" type="text" placeholder="PL..." className="w-full px-3 py-2 border rounded-lg" {...register('iban')} />
            </div>
          </div>

          {submitError && (
            <p className="text-sm text-destructive font-medium mb-4" role="alert">{submitError}</p>
          )}

          <div className="mt-8 flex justify-end space-x-3 pt-6 border-t border-gray-100">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
            >
              Anuluj
            </button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
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
