import React from "react";
import { Info } from "lucide-react";
import { Button } from "./ui/Button";

interface ProductCardProps {
  onOpenConfigurator: () => void;
}

export function ProductCard({ onOpenConfigurator }: ProductCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden w-full max-w-sm hover:shadow-md transition-shadow">
      <div className="aspect-[4/3] bg-slate-100 p-8 flex items-center justify-center relative">
        <img
          src="https://images.unsplash.com/photo-1771337744724-46b49a171ece?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800"
          alt="Samsung Wind-Free Pure 2.0"
          className="object-cover w-full h-full absolute inset-0 mix-blend-multiply opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent"></div>
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
            <span className="bg-white/90 backdrop-blur text-xs font-semibold px-2 py-1 rounded-md text-slate-800">
              Bestseller
            </span>
        </div>
      </div>
      
      <div className="p-6">
        <div className="mb-4">
          <h3 className="text-xl font-bold text-slate-900">Samsung Wind-Free Pure 2.0</h3>
          <p className="text-sm text-slate-500 mt-1">Inteligentna klimatyzacja bez powiewów chłodu.</p>
        </div>
        
        <div className="flex gap-2 mb-6 flex-wrap">
          <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">Wi-Fi</span>
          <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">Jonizator</span>
          <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">19 dB</span>
        </div>
        
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm text-slate-500 mb-1">Cena zaczyna się od</p>
            <p className="text-2xl font-bold text-slate-900">4 200 zł <span className="text-sm font-normal text-slate-500">brutto</span></p>
          </div>
          <Button onClick={onOpenConfigurator} className="w-full text-base py-6">
            Skonfiguruj zestaw
          </Button>
        </div>
      </div>
    </div>
  );
}
