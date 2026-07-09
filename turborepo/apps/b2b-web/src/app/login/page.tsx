"use client"
import React, { useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const Logo = () => (
  <img
    src="/logo.png"
    alt="Klik Klima"
    className="h-[52px] w-auto"
  />
);

export default function LoginScreen() {
  const [status, setStatus] = useState<'idle' | 'denied'>('idle');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0 bg-[url('https://images.unsplash.com/photo-1581094794329-c8112a89af12?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-5"></div>
      
      <Card className="w-full max-w-md z-10 shadow-xl border-gray-200/60 backdrop-blur-sm bg-white/95">
        <CardHeader className="text-center space-y-4 pb-8 pt-10">
          <div className="flex justify-center mb-2"><Logo /></div>
          <CardTitle className="text-2xl">Panel Dyspozytora B2B</CardTitle>
          <p className="text-sm text-gray-500">Zaloguj się za pomocą konta służbowego Google, aby kontynuować.</p>
        </CardHeader>
        
        <CardContent className="space-y-4 pb-10">
          {status === 'idle' ? (
            <>
              <Button 
                className="w-full h-14 text-base gap-3 bg-blue-600 hover:bg-blue-700 text-white" 
                onClick={() => {
                  window.location.href = '/kanban'
                }}
              >
                <svg viewBox="0 0 24 24" className="w-6 h-6 bg-white rounded-full p-0.5 fill-current text-blue-600">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Zaloguj się przez Google
              </Button>
              <button onClick={() => setStatus('denied')} className="w-full text-xs text-gray-400 hover:text-gray-600 underline text-center">
                Symuluj brak uprawnień
              </button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex gap-3 text-sm">
                <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
                <div>
                  <p className="font-semibold mb-1">Brak autoryzacji.</p>
                  <p>Twój adres email (<b>jan.kowalski@gmail.com</b>) nie posiada uprawnień do tego panelu. Skontaktuj się z Administratorem.</p>
                </div>
              </div>
              <Button variant="outline" className="w-full h-12" onClick={() => setStatus('idle')}>
                Wróć do logowania
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
