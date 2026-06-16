"use client";

import { useTriageStore } from "@/store/triageStore";
import { AnimatePresence, motion } from "framer-motion";
import usePlacesAutocomplete, {
  getGeocode,
  getLatLng,
} from "use-places-autocomplete";

export default function TriageSteps() {
  const { currentStep, data, setStep, nextStep, prevStep, updateData } = useTriageStore();

  // Google Places Autocomplete Hook for Address (Phase 1)
  const {
    ready,
    value,
    suggestions: { status, data: suggestionsData },
    setValue,
    clearSuggestions,
  } = usePlacesAutocomplete({
    requestOptions: {
      componentRestrictions: { country: "pl" }, // Limit to Poland
    },
    debounce: 300,
  });

  const handleSelectAddress = async (address: string) => {
    setValue(address, false);
    clearSuggestions();

    try {
      const results = await getGeocode({ address });
      const { lat, lng } = await getLatLng(results[0]);
      updateData({ address, lat, lng });
    } catch (error) {
      console.error("Error geocoding address: ", error);
    }
  };

  // Wykorzystujemy framer-motion do płynnego przejścia między krokami
  const renderStep = () => {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -50, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          {currentStep === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium text-gray-700">Krok 1: Wpisz swój adres</h2>
              <div className="relative">
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  disabled={!ready}
                  placeholder="np. Złota 44, Warszawa"
                  className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {status === "OK" && (
                  <ul className="absolute z-10 w-full bg-white border border-gray-200 mt-1 rounded-lg shadow-lg">
                    {suggestionsData.map(({ place_id, description }) => (
                      <li
                        key={place_id}
                        onClick={() => handleSelectAddress(description)}
                        className="p-3 hover:bg-gray-50 cursor-pointer text-sm text-gray-700"
                      >
                        {description}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              
              {data.lat && data.lng && (
                <p className="text-sm text-emerald-600">
                  Lokalizacja znaleziona!
                </p>
              )}
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium text-gray-700">Krok 2: Rodzaj budynku</h2>
              <div className="flex flex-col gap-3">
                {["Dom", "Mieszkanie", "Lokal komercyjny"].map((type) => (
                  <button
                    key={type}
                    onClick={() => updateData({ buildingType: type })}
                    className={`p-4 border rounded-lg text-left transition-colors ${
                      data.buildingType === type
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                        : "border-gray-200 hover:border-emerald-300 text-gray-700"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentStep > 2 && (
            <div>Miejsce na kolejne kroki (Z Figmy)</div>
          )}
        </motion.div>
      </AnimatePresence>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* ProgressBar from Figma goes here */}
      <div className="w-full bg-gray-200 h-2 rounded-full mb-8 overflow-hidden">
        <div 
          className="bg-emerald-500 h-full transition-all duration-300"
          style={{ width: `${(currentStep / 5) * 100}%` }}
        />
      </div>

      <div className="flex-1">
        {renderStep()}
      </div>

      <div className="mt-8 flex justify-between items-center pt-6 border-t border-gray-100">
        <button
          onClick={prevStep}
          disabled={currentStep === 1}
          className="px-6 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Wstecz
        </button>
        <button
          onClick={nextStep}
          // disabled={validation logic here...}
          className="px-6 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg font-medium shadow-sm transition-colors"
        >
          Dalej
        </button>
      </div>
    </div>
  );
}
