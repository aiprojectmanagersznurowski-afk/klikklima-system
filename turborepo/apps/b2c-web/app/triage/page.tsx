import TriageFunnel from "@/components/triage/TriageFunnel";
import ExitIntentModal from "@/components/triage/ExitIntentModal";

export const metadata = {
  title: "Dobierz klimatyzator | Klik Klima",
  description: "Odpowiedz na kilka prostych pytań, abyśmy mogli dopasować idealne urządzenia i wycenić standardowy montaż.",
};

export default function TriagePage() {
  return (
    <>
      <TriageFunnel />
      <ExitIntentModal />
    </>
  );
}
