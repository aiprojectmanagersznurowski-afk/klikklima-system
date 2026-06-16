import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import WhatsAppButton from "@/components/layout/WhatsAppButton";
import Script from "next/script";

export const metadata: Metadata = {
  title: "KlikKlima | Klimatyzacja z darmową wyceną",
  description: "Nowoczesne podejście do klimatyzacji. Sprawdź wycenę online w 2 minuty i ciesz się chłodem w swoim domu.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pl"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <WhatsAppButton />
        
        {/* Google Maps Script (loaded globally for Places API) */}
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
