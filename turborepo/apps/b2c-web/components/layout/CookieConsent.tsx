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
          className="fixed bottom-4 left-4 right-4 md:bottom-6 md:left-6 md:max-w-[320px] z-[9999]"
        >
          <div className="bg-white/95 backdrop-blur-xl border border-gray-200/50 shadow-2xl rounded-2xl p-4 relative overflow-hidden">
            {/* Dekoracyjne tło */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3" />
            
            <button
              onClick={handleDecline}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Zamknij"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-3 relative z-10">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Cookie className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 text-sm mb-1">Dbamy o prywatność</h3>
                <p className="text-xs text-gray-600 leading-relaxed mb-3">
                  Nasza strona używa ciasteczek w celach analitycznych i marketingowych.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAccept}
                    className="flex-1 bg-primary text-primary-foreground font-semibold py-1.5 px-3 rounded-lg hover:bg-[#1244b0] transition-colors text-xs"
                  >
                    Akceptuję
                  </button>
                  <button
                    onClick={handleDecline}
                    className="flex-1 bg-gray-100 text-gray-700 font-semibold py-1.5 px-3 rounded-lg hover:bg-gray-200 transition-colors text-xs"
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
