import { Suspense } from 'react';
import TriageFunnel from "@/components/triage/TriageFunnel";

export const metadata = {
  title: "Dobierz klimatyzator | Klik Klima",
  description: "Odpowiedz na kilka prostych pytań, abyśmy mogli dopasować idealne urządzenia i wycenić standardowy montaż.",
};

export default function TriagePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center">Ładowanie formularza...</div>}>
      <TriageFunnel />
    </Suspense>
  );
}
