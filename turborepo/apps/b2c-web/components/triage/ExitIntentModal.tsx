"use client";

import { useExitIntent } from "@/hooks/useExitIntent";
import { useState, useEffect } from "react";
import { saveSoftLead } from "@/app/actions/leads";
import { useTriageStore } from "@/store/triageStore";
import { AnimatePresence, motion } from "framer-motion";
import { X, Phone, ArrowRight, CheckCircle2, PhoneCall } from "lucide-react";

export default function ExitIntentModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Bezpieczne pobranie danych z Zustand
  // Aby uniknąć błędów hydratacji, czasami używa się useEffect,
  // ale tu można po prostu pobrać store
  const triageData = useTriageStore((state) => state.data);

  useExitIntent(() => {
    // Pokazujemy tylko raz, jeśli nie zostało jeszcze wypełnione
    if (!submitted && !isOpen) {
      setIsOpen(true);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;

    setIsSubmitting(true);
    // Wywołanie Server Action do zapisu w Supabase
    await saveSoftLead(phone, triageData);
    
    setIsSubmitting(false);
    setSubmitted(true);
    
    // Auto-zamknięcie po 3 sekundach od sukcesu
    setTimeout(() => setIsOpen(false), 3000);
  };

  // Umożliwia wyłączenie scrollowania gdy modal jest otwarty
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          {/* Tło blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />

          {/* Modal okno */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
            className="relative w-full max-w-lg bg-white overflow-hidden rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)]"
          >
            {/* Przycisk zamknięcia */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-5 right-5 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {!submitted ? (
              <div className="flex flex-col">
                {/* Header z grafiką / kolorem */}
                <div className="relative bg-gradient-to-br from-[#0d1b2e] to-[#1750c8] pt-10 pb-12 px-8 text-center overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
                  
                  <div className="relative z-10 w-16 h-16 mx-auto bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-5 border border-white/20 shadow-lg">
                    <PhoneCall className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="relative z-10 text-2xl font-extrabold text-white tracking-tight leading-tight">
                    Nie jesteś pewien <br className="hidden sm:block" /> co wybrać?
                  </h3>
                </div>

                {/* Formularz */}
                <div className="px-8 pt-8 pb-10 bg-white">
                  <p className="text-gray-600 text-center text-sm leading-relaxed mb-8 max-w-[90%] mx-auto">
                    Zostaw numer telefonu. Nasz ekspert od klimatyzacji oddzwoni w ciągu 15 minut i doradzi najlepsze rozwiązanie — <span className="font-semibold text-gray-900">całkowicie za darmo.</span>
                  </p>

                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Phone className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Twój numer telefonu"
                        required
                        className="w-full bg-gray-50 border border-gray-200 text-gray-900 font-medium rounded-xl py-4 pl-12 pr-4 outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      />
                    </div>
                    
                    <button
                      type="submit"
                      disabled={isSubmitting || !phone}
                      className="w-full bg-primary text-primary-foreground font-bold text-base rounded-xl py-4 px-4 flex items-center justify-center gap-2 transition-all hover:bg-[#1244b0] hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98]"
                    >
                      {isSubmitting ? (
                        <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          Poproś o wycenę eksperta
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </button>
                    
                    <p className="text-[11px] text-center text-gray-400 mt-2">
                      Klikając przycisk wyrażasz zgodę na kontakt telefoniczny.
                    </p>
                  </form>
                </div>
              </div>
            ) : (
              /* Success State */
              <div className="px-8 py-16 text-center bg-white flex flex-col items-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", bounce: 0.5, delay: 0.1 }}
                  className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6"
                >
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </motion.div>
                <h3 className="text-2xl font-bold text-gray-900 tracking-tight mb-3">
                  Dziękujemy!
                </h3>
                <p className="text-gray-600 leading-relaxed max-w-sm">
                  Twój numer został przekazany do inżyniera. Spodziewaj się kontaktu z naszej strony w ciągu kilkunastu minut.
                </p>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
