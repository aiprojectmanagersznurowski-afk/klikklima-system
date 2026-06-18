"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTriageStore } from '@/store/triageStore';
import { StepWrapper } from '../StepWrapper';
import { saveLead } from '@/app/actions/saveLead';
import { getAvailableSlots, type AvailableSlot } from '@/app/actions/calendar';
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import usePlacesAutocomplete, { getGeocode, getLatLng } from 'use-places-autocomplete';

const FloatingInput = ({ label, type = "text", id }: { label: string, type?: string, id: string }) => {
  return (
    <div className="relative z-0 w-full mb-6 group">
      <input 
        type={type} 
        name={id} 
        id={id} 
        className="block py-3.5 px-0 w-full text-base text-foreground bg-transparent border-0 border-b-2 border-border appearance-none focus:outline-none focus:ring-0 focus:border-primary peer transition-colors" 
        placeholder=" " 
        required 
      />
      <label 
        htmlFor={id} 
        className="peer-focus:font-medium absolute text-base text-muted-foreground duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:left-0 peer-focus:text-primary peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6"
      >
        {label}
      </label>
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
    // Tutaj w przyszlosci mozna pobrac dokladne wspolrzedne:
    // const results = await getGeocode({ address });
    // const { lat, lng } = await getLatLng(results[0]);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedDateStr || !selectedSlot) return;

    const formData = new FormData(e.currentTarget);
    
    // Konwersja dateStr na ISO 
    const dateObj = parseISO(selectedDateStr);

    const leadData = {
      name: formData.get('name') as string,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
      address: value,
      bookingDate: dateObj.toISOString(),
      bookingSlot: selectedSlot,
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
      <StepWrapper title="" subtitle="" showBackButton={false}>
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
      subtitle="Nasz ekspert przyjedzie na miejsce, aby potwierdzić techniczne możliwości montażu."
    >
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-10">
        
        {/* Calendar Side */}
        <div className="w-full lg:w-5/12 space-y-8">
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
          </div>
        </div>

        {/* Form Side */}
        <div className="w-full lg:w-7/12">
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-8 shadow-sm border border-border/50 h-full flex flex-col">
            <h3 className="font-semibold text-2xl mb-8">Twoje dane</h3>
            
            <div className="flex-1 space-y-6">
              <FloatingInput id="name" label="Imię i nazwisko" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <FloatingInput id="phone" label="Telefon" type="tel" />
                <FloatingInput id="email" label="Adres E-mail" type="email" />
              </div>
              <div className="relative">
                <div className="relative z-0 w-full mb-6 group">
                  <input 
                    type="text" 
                    name="address" 
                    id="address" 
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    disabled={!ready}
                    className="block py-3.5 px-0 w-full text-base text-foreground bg-transparent border-0 border-b-2 border-border appearance-none focus:outline-none focus:ring-0 focus:border-primary peer transition-colors" 
                    placeholder=" " 
                    required 
                  />
                  <label 
                    htmlFor="address" 
                    className="peer-focus:font-medium absolute text-base text-muted-foreground duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:left-0 peer-focus:text-primary peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6"
                  >
                    Dokładny adres montażu (ulica, miasto)
                  </label>
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

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={!selectedDateStr || !selectedSlot}
              type="submit"
              className={cn(
                "w-full py-4 rounded-xl font-bold text-lg transition-all mt-8",
                selectedDateStr && selectedSlot
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              Potwierdź rezerwację
            </motion.button>
          </form>
        </div>

      </div>
    </StepWrapper>
  );
};
