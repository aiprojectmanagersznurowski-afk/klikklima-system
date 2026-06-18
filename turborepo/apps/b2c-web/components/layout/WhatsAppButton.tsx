import { MessageCircle } from "lucide-react";
import { companyDetails } from "@/config/company";

export default function WhatsAppButton() {
  const phoneNumber = companyDetails.phone; // z konfiguracji
  const message = "Cześć! Chcę darmową poradę odnośnie klimatyzacji.";
  const waLink = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={waLink}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 bg-[#25D366] hover:bg-[#22bf5b] text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform duration-300 flex items-center justify-center group"
      aria-label="Skontaktuj się z nami na WhatsApp"
    >
      <MessageCircle size={28} />

      {/* Tooltip */}
      <div className="absolute right-full mr-4 bg-white text-gray-800 px-4 py-2 rounded-xl text-sm font-medium shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
        Napisz do nas! Odpisujemy w 5 min
      </div>
    </a>
  );
}
