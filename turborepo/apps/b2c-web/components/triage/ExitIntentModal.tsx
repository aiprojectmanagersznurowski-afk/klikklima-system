"use client";

import { useExitIntent } from "@/hooks/useExitIntent";
import { useState } from "react";
import { saveSoftLead } from "@/app/actions/leads";
import { useTriageStore } from "@/store/triageStore";

export default function ExitIntentModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);
  
  const { data: triageData } = useTriageStore();

  useExitIntent(() => {
    // Only show if we haven't submitted yet
    if (!submitted) {
      setIsOpen(true);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;

    // Call server action to save lead to Supabase
    await saveSoftLead(phone, triageData);
    
    setSubmitted(true);
    
    // Auto-close after 3 seconds
    setTimeout(() => setIsOpen(false), 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
      {/* 
        This is the placeholder for your Figma Modal. 
        It has the logic wired up to Supabase.
      */}
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full relative">
        <button 
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>

        {!submitted ? (
          <>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              Poczekaj! Mamy dla Ciebie ofertę
            </h3>
            <p className="text-gray-600 mb-6">
              Nie jesteś pewien co wybrać? Zostaw numer telefonu, a nasz ekspert oddzwoni i darmowo doradzi najlepszą klimatyzację.
            </p>
            
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Twój numer telefonu"
                required
                className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button 
                type="submit"
                className="w-full bg-emerald-600 text-white font-medium p-3 rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Poproś o darmową konsultację
              </button>
            </form>
          </>
        ) : (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
              ✓
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Dziękujemy!
            </h3>
            <p className="text-gray-600">
              Nasz ekspert skontaktuje się z Tobą wkrótce.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
