import React, { useState } from "react";
import { ProductCard } from "./components/ProductCard";
import { DeviceModal } from "./components/DeviceModal";

export default function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      
      <div className="max-w-4xl w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Nasza oferta</h1>
          <p className="text-slate-500">Wybierz jednostkę bazową, aby skonfigurować swój system klimatyzacji.</p>
        </div>

        <div className="flex gap-6 flex-wrap">
          <ProductCard onOpenConfigurator={() => setIsModalOpen(true)} />
          {/* We could add more cards here */}
        </div>
      </div>

      <DeviceModal open={isModalOpen} onOpenChange={setIsModalOpen} />

    </div>
  );
}
