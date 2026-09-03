import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "latin-ext"],
});

import WhatsAppButton from "@/components/layout/WhatsAppButton";
import CookieConsent from "@/components/layout/CookieConsent";
import Script from "next/script";

export const metadata: Metadata = {
  title: "KlikKlima | Klimatyzacja z darmową wyceną",
  description: "Nowoczesne podejście do klimatyzacji. Sprawdź wycenę online w 2 minuty i ciesz się chłodem w swoim domu.",
};

export default function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  return (
    <html
      lang="pl"
      className={`${plusJakartaSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        {modal}
        <WhatsAppButton />
        <CookieConsent />
        
        {/* Google Maps Script (loaded globally for Places API) */}
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&loading=async`}
          strategy="beforeInteractive"
        />
      </body>
    </html>
  );
}
