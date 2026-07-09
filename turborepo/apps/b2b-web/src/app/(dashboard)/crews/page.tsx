"use client"
import React from "react"
import { HardHat } from "lucide-react"

export default function CrewsScreen() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ekipy Monterskie</h1>
        <p className="text-sm text-gray-500 mt-1">Zarządzanie Zespołami, ich harmonogramem oraz kompetencjami.</p>
      </div>

      <div className="flex flex-col items-center justify-center h-[50vh] bg-gray-50 border border-dashed border-gray-300 rounded-xl">
        <HardHat className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-lg font-semibold text-gray-700">Moduł w przygotowaniu</h2>
        <p className="text-gray-500 text-sm mt-2 max-w-md text-center">Ten widok posłuży do zarządzania brygadami wykonującymi instalacje (przypisywanie do zleceń po audycie).</p>
      </div>
    </div>
  );
}
