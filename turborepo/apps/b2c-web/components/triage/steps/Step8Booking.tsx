"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTriageStore } from '@/store/triageStore';
import { StepWrapper } from '../StepWrapper';
import { saveLead } from '@/app/actions/saveLead';
import { getAvailableSlots, type AvailableSlot } from '@/app/actions/calendar';
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import usePlacesAutocomplete, { getGeocode, getLatLng } from 'use-places-autocomplete';

const FloatingInput = ({ label, type = "text", id, error, value, onChange }: { label: string, type?: string, id: string, error?: string, value?: string, onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void }) => {
  return (
    <div className="relative z-0 w-full mb-6 group">
      <input 
        type={type} 
        name={id} 
        id={id} 
        value={value}
        onChange={onChange}
        className={cn(
          "block py-3.5 px-0 w-full text-base bg-transparent border-0 border-b-2 appearance-none focus:outline-none focus:ring-0 peer transition-colors",
          error ? "border-rose-500 text-rose-600 focus:border-rose-500" : "border-border text-foreground focus:border-primary"
        )}
        placeholder=" " 
      />
      <label 
        htmlFor={id} 
        className={cn(
          "peer-focus:font-medium absolute text-base duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:left-0 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6",
          error ? "text-rose-500 peer-focus:text-rose-500" : "text-muted-foreground peer-focus:text-primary"
        )}
      >
        {label}
      </label>
      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-xs text-rose-500 font-medium mt-1">
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
};

export const Step8Booking = () => {
  const { data: triageData, updateData } = useTriageStore();
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [availableDays, setAvailableDays] = useState<AvailableSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(true);
  const [error, setError] = useState<'date' | 'terms' | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [formDataState, setFormDataState] = useState({ name: '', phone: '', email: '' });
  const [coordinates, setCoordinates] = useState<{lat: number, lng: number} | null>(null);
  const router = useRouter();

  useEffect(() => {
    getAvailableSlots().then(days => {
      setAvailableDays(days);
      setIsLoadingSlots(false);
    });
  }, []);

  useEffect(() => {
    if (isSubmitted) {
      const timer = setTimeout(() => {
        router.push('/');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isSubmitted, router]);

  const {
    ready,
    value,
    suggestions: { status, data },
    setValue,
    clearSuggestions,
  } = usePlacesAutocomplete({
    requestOptions: {
      componentRestrictions: { country: "pl" },
    },
    debounce: 300,
  });

  const handleSelect = async (address: string) => {
    setValue(address, false);
    clearSuggestions();
    setFieldErrors(prev => ({ ...prev, address: '' }));
    try {
      const results = await getGeocode({ address });
      const { lat, lng } = await getLatLng(results[0]);
      setCoordinates({ lat, lng });
    } catch (err) {
      console.error("Geocoding error: ", err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormDataState(prev => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    
    let hasErrors = false;
    const newFieldErrors: Record<string, string> = {};

    if (!formDataState.name || formDataState.name.trim().length < 3) {
      newFieldErrors.name = "Podaj poprawne imię i nazwisko";
      hasErrors = true;
    }
    
    // Prosta walidacja telefonu (minimum 9 cyfr, mogą być spacje, plus)
    if (!formDataState.phone || formDataState.phone.replace(/[^0-9]/g, '').length < 9) {
      newFieldErrors.phone = "Podaj poprawny numer telefonu";
      hasErrors = true;
    }

    if (!formDataState.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formDataState.email)) {
      newFieldErrors.email = "Podaj poprawny adres e-mail";
      hasErrors = true;
    }

    if (!value || value.trim().length < 5) {
      newFieldErrors.address = "Podaj dokładny adres montażu";
      hasErrors = true;
    }

    setFieldErrors(newFieldErrors);

    if (!selectedDateStr || !selectedSlot) {
      setError('date');
      hasErrors = true;
    }

    if (!acceptedTerms) {
      setError('terms');
      hasErrors = true;
    }

    if (hasErrors) return;

    // Konwersja dateStr na ISO 
    const dateObj = parseISO(selectedDateStr as string);

    const leadData = {
      name: formDataState.name,
      phone: formDataState.phone,
      email: formDataState.email,
      address: value,
      lat: coordinates?.lat,
      lng: coordinates?.lng,
      bookingDate: dateObj.toISOString(),
      bookingSlot: selectedSlot as string,
      triageData: triageData
    };

    const result = await saveLead(leadData);
    if (result.success) {
      setIsSubmitted(true);
    } else {
      alert("Wystąpił błąd podczas zapisywania rezerwacji. Spróbuj ponownie.");
    }
  };

  if (isSubmitted) {
    return (
      <StepWrapper title="" subtitle="">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md mx-auto text-center space-y-6 py-20"
        >
          <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 mb-8">
            <CheckCircle2 size={48} strokeWidth={2.5} />
          </div>
          <h2 className="text-3xl font-bold text-foreground">Rezerwacja potwierdzona!</h2>
          <p className="text-muted-foreground text-lg">
            Nasz doradca skontaktuje się z Tobą wkrótce, aby potwierdzić szczegóły wizyty.
          </p>
        </motion.div>
      </StepWrapper>
    );
  }

  return (
    <StepWrapper 
      title="Wybierz termin darmowej wyceny" 
      subtitle="Nasz ekspert przyjedzie na miejsce i potwierdzi techniczne możliwości montażu"
    >
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8 xl:gap-12">
        
        {/* Calendar Side */}
        <div className="w-full lg:w-[45%] xl:w-5/12 space-y-8">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-border/50">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-lg">Data wizyty</h3>
              <div className="flex gap-2">
                <button className="p-1 rounded-full hover:bg-secondary text-muted-foreground">
                  <ChevronLeft size={20} />
                </button>
                <button className="p-1 rounded-full hover:bg-secondary text-muted-foreground">
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 max-h-64 overflow-y-auto pr-2 pb-2">
              {isLoadingSlots ? (
                <div className="col-span-full flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin mb-2" />
                  <span className="text-sm">Ładowanie dostępnych terminów z kalendarza...</span>
                </div>
              ) : availableDays.length === 0 ? (
                <div className="col-span-full text-center py-6 text-muted-foreground">
                  Brak dostępnych terminów.
                </div>
              ) : (
                availableDays.map((day) => {
                  const dateObj = parseISO(day.dateStr);
                  const isSelected = selectedDateStr === day.dateStr;
                  return (
                    <button
                      key={day.dateStr}
                      onClick={() => {
                        setSelectedDateStr(day.dateStr);
                        setSelectedSlot(null); // Reset slotu po zmianie dnia
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center py-3 px-1 rounded-2xl transition-all border-2",
                        isSelected 
                          ? "bg-primary text-primary-foreground border-primary shadow-md"
                          : "bg-transparent text-foreground border-transparent hover:bg-secondary hover:border-secondary-foreground/10"
                      )}
                    >
                      <span className="text-xs font-medium uppercase mb-1 opacity-80">
                        {format(dateObj, 'EEE', { locale: pl }).slice(0, 3)}
                      </span>
                      <span className="text-xl font-bold">
                        {format(dateObj, 'd')}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <AnimatePresence>
              {selectedDateStr && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-8 pt-6 border-t border-border/50"
                >
                  <h3 className="font-semibold text-lg mb-4">Godzina</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {availableDays.find(d => d.dateStr === selectedDateStr)?.slots.map(slot => (
                      <button
                        key={slot}
                        onClick={() => setSelectedSlot(slot)}
                        className={cn(
                          "py-3 rounded-xl font-medium transition-all border-2",
                          selectedSlot === slot
                            ? "bg-primary text-primary-foreground border-primary shadow-md"
                            : "bg-white text-foreground border-border hover:border-primary/30"
                        )}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {error === 'date' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, marginTop: 0 }} 
                  animate={{ opacity: 1, height: 'auto', marginTop: 24 }} 
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 bg-rose-50 text-rose-600 rounded-xl text-sm font-medium border border-rose-100 flex items-center gap-2">
                    <AlertCircle size={18} className="shrink-0" />
                    Wybierz datę i godzinę wizyty.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Form Side */}
        <div className="w-full lg:w-[55%] xl:w-7/12">
          <form onSubmit={handleSubmit} noValidate className="bg-white rounded-3xl p-8 shadow-sm border border-border/50 h-full flex flex-col">
            <h3 className="font-semibold text-2xl mb-8">Twoje dane</h3>
            
            <div className="flex-1 space-y-6">
              <FloatingInput 
                id="name" 
                label="Imię i nazwisko" 
                value={formDataState.name}
                onChange={handleInputChange}
                error={fieldErrors.name}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <FloatingInput 
                  id="phone" 
                  label="Telefon" 
                  type="tel" 
                  value={formDataState.phone}
                  onChange={handleInputChange}
                  error={fieldErrors.phone}
                />
                <FloatingInput 
                  id="email" 
                  label="Adres E-mail" 
                  type="email" 
                  value={formDataState.email}
                  onChange={handleInputChange}
                  error={fieldErrors.email}
                />
              </div>
              <div className="relative">
                <div className="relative z-0 w-full mb-6 group">
                  <input 
                    type="text" 
                    name="address" 
                    id="address" 
                    value={value}
                    onChange={(e) => {
                      setValue(e.target.value);
                      if (fieldErrors.address) setFieldErrors(prev => ({ ...prev, address: '' }));
                    }}
                    disabled={!ready}
                    className={cn(
                      "block py-3.5 px-0 w-full text-base bg-transparent border-0 border-b-2 appearance-none focus:outline-none focus:ring-0 peer transition-colors",
                      fieldErrors.address ? "border-rose-500 text-rose-600 focus:border-rose-500" : "border-border text-foreground focus:border-primary"
                    )}
                    placeholder=" " 
                  />
                  <label 
                    htmlFor="address" 
                    className={cn(
                      "peer-focus:font-medium absolute text-base duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:left-0 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6",
                      fieldErrors.address ? "text-rose-500 peer-focus:text-rose-500" : "text-muted-foreground peer-focus:text-primary"
                    )}
                  >
                    Dokładny adres montażu (ulica, miasto)
                  </label>
                  <AnimatePresence>
                    {fieldErrors.address && (
                      <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-xs text-rose-500 font-medium mt-1">
                        {fieldErrors.address}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
                {status === "OK" && (
                  <ul className="absolute z-10 w-full bg-white border border-border rounded-xl shadow-lg mt-1 overflow-hidden">
                    {data.map(({ place_id, description }) => (
                      <li
                        key={place_id}
                        onClick={() => handleSelect(description)}
                        className="px-4 py-3 hover:bg-secondary cursor-pointer transition-colors text-sm"
                      >
                        {description}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="mt-8 flex flex-col items-start">
              <div className="flex items-start gap-3">
                <input 
                  type="checkbox" 
                  id="terms" 
                  checked={acceptedTerms}
                  onChange={(e) => {
                    setAcceptedTerms(e.target.checked);
                    if (e.target.checked && error === 'terms') {
                      setError(null);
                    }
                  }}
                  className={cn(
                    "mt-1 w-5 h-5 rounded focus:ring-2 cursor-pointer transition-colors outline-none",
                    error === 'terms' ? "border-rose-500 text-rose-500 focus:ring-rose-500 ring-2 ring-rose-500" : "border-border text-primary focus:ring-primary"
                  )}
                />
                <label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer select-none">
                  Akceptuję <a href="/regulamin" target="_blank" className="text-primary hover:underline">Regulamin</a> oraz <a href="/polityka-prywatnosci" target="_blank" className="text-primary hover:underline">Politykę Prywatności</a>.
                </label>
              </div>
              <AnimatePresence>
                {error === 'terms' && (
                  <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-xs text-rose-500 font-medium mt-2 pl-8">
                    Zgoda jest wymagana.
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              onClick={() => {
                let hasLocalErr = false;
                if (!selectedDateStr || !selectedSlot) {
                  setError('date');
                  hasLocalErr = true;
                } else if (!acceptedTerms) {
                  setError('terms');
                  hasLocalErr = true;
                }
                
                // Form HTML5 validations are bypassed by noValidate, 
                // so handleSubmit will be called and our custom JS validation will run.
              }}
              className="w-full py-4 rounded-xl font-bold text-lg transition-all mt-6 bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl"
            >
              Potwierdź rezerwację
            </motion.button>
          </form>
        </div>

      </div>
    </StepWrapper>
  );
};
