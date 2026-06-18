"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Cookie } from "lucide-react";

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Sprawdzamy czy zgoda została już wyrażona
    const consent = localStorage.getItem("cookieConsent");
    if (!consent) {
      // Dajemy chwilę opóźnienia, aby nie atakować użytkownika w 1. sekundzie
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cookieConsent", "accepted");
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem("cookieConsent", "declined");
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 25 }}
          className="fixed bottom-4 left-4 right-4 md:bottom-8 md:left-8 md:max-w-[420px] z-[9999]"
        >
          <div className="bg-white/95 backdrop-blur-xl border border-gray-200/50 shadow-2xl rounded-2xl p-6 relative overflow-hidden">
            {/* Dekoracyjne tło */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
            
            <button
              onClick={handleDecline}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Zamknij"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-4 relative z-10">
              <div className="bg-primary/10 p-3 rounded-xl">
                <Cookie className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-1">Dbamy o Twoją prywatność</h3>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">
                  Nasza strona używa ciasteczek w celu ulepszenia nawigacji oraz w celach analitycznych i marketingowych. Pozostając na niej, wyrażasz zgodę na ich wykorzystywanie.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleAccept}
                    className="flex-1 bg-primary text-primary-foreground font-semibold py-2.5 px-4 rounded-xl hover:bg-[#1244b0] transition-colors text-sm"
                  >
                    Akceptuję
                  </button>
                  <button
                    onClick={handleDecline}
                    className="flex-1 bg-gray-100 text-gray-700 font-semibold py-2.5 px-4 rounded-xl hover:bg-gray-200 transition-colors text-sm"
                  >
                    Odrzuć
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
