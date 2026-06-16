import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export default function PrivacyPolicyPage() {
  return (
    <>
      <Navbar />
      
      <main className="flex-1 pt-32 pb-24 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-gray-100">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Polityka Prywatności i RODO</h1>
          
          <div className="space-y-8 text-gray-600">
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Informacje ogólne</h2>
              <p>
                Niniejsza Polityka Prywatności określa zasady przetwarzania i ochrony danych osobowych 
                przekazanych przez Użytkowników w związku z korzystaniem z usług firmy <strong>[NAZWA TWOJEJ FIRMY]</strong> 
                poprzez serwis internetowy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Administrator danych</h2>
              <p>
                Administratorem danych osobowych zawartych w serwisie jest <strong>[NAZWA TWOJEJ FIRMY]</strong> 
                z siedzibą w <strong>[ADRES]</strong>, NIP: <strong>[NIP]</strong>, REGON: <strong>[REGON]</strong>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Cel zbierania danych (Triage i Wycena)</h2>
              <p>
                Dane osobowe (Imię, Nazwisko, Adres E-mail, Numer Telefonu, Adres Montażu) zbierane są wyłącznie w celu:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Przeprowadzenia szacunkowej wyceny instalacji klimatyzacji (Kalkulator Triage).</li>
                <li>Umówienia i zrealizowania darmowego audytu technicznego u Klienta.</li>
                <li>Kontaktu telefonicznego w celu doradztwa technicznego (tzw. Soft Leady).</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Udostępnianie danych</h2>
              <p>
                Dane Użytkowników nie są sprzedawane ani udostępniane podmiotom trzecim w celach marketingowych. 
                W celach technicznych korzystamy z zabezpieczonych rozwiązań chmurowych (Supabase).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Prawa Użytkownika (RODO)</h2>
              <p>
                Zgodnie z przepisami RODO, każdy Użytkownik ma prawo do wglądu w swoje dane, ich poprawiania, 
                żądania usunięcia ("prawo do bycia zapomnianym") oraz ograniczenia przetwarzania. 
                W tym celu prosimy o kontakt na adres e-mail: <strong>[TWÓJ E-MAIL]</strong>.
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
