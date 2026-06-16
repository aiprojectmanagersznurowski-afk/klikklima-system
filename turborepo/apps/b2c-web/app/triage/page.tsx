import TriageSteps from "@/components/triage/TriageSteps";
import ExitIntentModal from "@/components/triage/ExitIntentModal";

export default function TriagePage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      {/* 
        This is the main wrapper for the Triage application. 
        You can replace this layout with your Figma-generated design.
      */}
      <div className="w-full max-w-2xl bg-white shadow-xl rounded-2xl p-6 md:p-12 relative">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Dobór klimatyzatora (Triage)
        </h1>
        
        {/* The actual steps logic */}
        <TriageSteps />
      </div>

      {/* Hidden modal that appears when user tries to leave the page */}
      <ExitIntentModal />
    </main>
  );
}
