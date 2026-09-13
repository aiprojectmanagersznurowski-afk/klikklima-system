"use client"

import React, { useState, useEffect, useRef } from "react"
import { createClient } from "@/utils/supabase/client"
import { AlertTriangle, ShieldCheck } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function LoginScreen() {
  const [phase, setPhase] = useState<'splash' | 'transitioning' | 'login'>('splash')
  const [status, setStatus] = useState<'idle' | 'denied'>('idle')
  const [showContent, setShowContent] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const skipSplash = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setPhase('login')
  }

  useEffect(() => {
    // Sprawdzenie czy middleware przekazał flagę 'denied' (brak uprawnień)
    const searchParams = new URLSearchParams(window.location.search)
    if (searchParams.get('denied') === 'true') {
      setStatus('denied')
      setPhase('login')
      return
    }

    // Płynne wejście czystego logo
    const enterTimeout = setTimeout(() => setShowContent(true), 50)
    const splashDuration = 2200

    // Płynna zmiana fazy ze splash do logowania
    timerRef.current = setTimeout(() => {
      setPhase('transitioning')
      setTimeout(() => {
        setPhase('login')
      }, 500)
    }, splashDuration)

    return () => {
      clearTimeout(enterTimeout)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center bg-background p-4 relative overflow-hidden select-none"
      onClick={phase === 'splash' ? skipSplash : undefined}
    >
      {/* Dynamiczne klimatyczne tło ambientowe */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Subtelny wzór siatki technicznej */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06] bg-[radial-gradient(var(--foreground)_1px,transparent_1px)] [background-size:24px_24px]" />
        
        {/* Poświaty radialne - barwy KlikKlima (cobalt & cyan) */}
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] transition-all duration-1000" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-accent/15 rounded-full blur-[140px] transition-all duration-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-tr from-primary/5 via-accent/10 to-transparent rounded-full blur-[100px]" />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          FAZA 1: EKRAN POWITALNY (TYLKO CZYSTE DUŻE LOGO)
         ───────────────────────────────────────────────────────────── */}
      {phase !== 'login' && (
        <div 
          className={`absolute inset-0 z-30 flex items-center justify-center p-6 transition-all duration-700 cursor-pointer ${
            phase === 'transitioning' 
              ? 'opacity-0 scale-95 blur-xs pointer-events-none' 
              : showContent 
                ? 'opacity-100 scale-100 blur-none' 
                : 'opacity-0 scale-90 blur-sm'
          }`}
        >
          <div className="relative flex items-center justify-center transition-transform duration-500 hover:scale-105">
            <img
              src="/logo.png"
              alt="KlikKlima"
              className="h-28 sm:h-36 md:h-44 w-auto object-contain drop-shadow-[0_12px_28px_rgba(23,80,200,0.25)]"
            />
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          FAZA 2: FORMULARZ LOGOWANIA DO SYSTEMU (GOOGLE SSO)
         ───────────────────────────────────────────────────────────── */}
      <div 
        className={`w-full max-w-md z-20 transition-all duration-700 ${
          phase === 'login' 
            ? 'opacity-100 scale-100 translate-y-0 blur-none' 
            : 'opacity-0 scale-95 translate-y-6 blur-xs pointer-events-none'
        }`}
      >
        <Card className="shadow-2xl border-border/80 backdrop-blur-xl bg-card/95 rounded-3xl overflow-hidden relative">
          {/* Akcent świetlny na górnej krawędzi */}
          <div className="h-1.5 w-full bg-gradient-to-r from-primary via-accent to-primary" />

          <CardHeader className="text-center space-y-3 pb-6 pt-8">
            <div className="flex justify-center mb-1">
              <img
                src="/logo.png"
                alt="Klik Klima"
                className="h-[76px] w-auto object-contain drop-shadow-sm transition-transform hover:scale-105"
              />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
                Panel B2B KlikKlima
              </CardTitle>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Zaloguj się kontem Google, aby uzyskać dostęp
              </p>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6 pb-8 px-6 sm:px-8">
            {status === 'idle' ? (
              <>
                <Button 
                  className="w-full h-12 text-sm font-semibold gap-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer" 
                  onClick={async () => {
                    const supabase = createClient()
                    await supabase.auth.signInWithOAuth({
                      provider: 'google',
                      options: {
                        redirectTo: `${window.location.origin}/auth/callback`,
                      },
                    })
                  }}
                >
                  <svg viewBox="0 0 24 24" className="size-5 bg-white rounded-full p-0.5 fill-current shrink-0">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="rgb(66, 133, 244)" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="rgb(52, 168, 83)" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="rgb(251, 188, 5)" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="rgb(234, 67, 53)" />
                  </svg>
                  <span>Zaloguj się przez Google</span>
                </Button>

                <div className="pt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground/80">
                  <ShieldCheck className="size-3.5 text-primary" />
                  <span>Dostęp wyłącznie dla uprawnionych pracowników</span>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl flex gap-3 text-sm">
                  <AlertTriangle className="size-5 shrink-0 text-destructive mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">Brak autoryzacji konta</p>
                    <p className="text-xs opacity-90 leading-relaxed">
                      Twój adres e-mail nie znajduje się na liście uprawnionych użytkowników. Skontaktuj się z administratorem systemu, aby nadać uprawnienia.
                    </p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full h-11 rounded-xl font-medium cursor-pointer" 
                  onClick={() => {
                    setStatus('idle')
                    window.history.replaceState({}, '', '/login')
                  }}
                >
                  Wróć do logowania
                </Button>
              </div>
            )}

            {/* Subtelny przycisk ponownego odtworzenia intro */}
            <div className="pt-2 border-t border-border/60 text-center">
              <button
                type="button"
                onClick={() => {
                  setPhase('splash')
                  setShowContent(false)
                  setTimeout(() => setShowContent(true), 50)
                  const splashDuration = 2200
                  if (timerRef.current) clearTimeout(timerRef.current)
                  timerRef.current = setTimeout(() => {
                    setPhase('transitioning')
                    setTimeout(() => setPhase('login'), 500)
                  }, splashDuration)
                }}
                className="text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer"
              >
                Odtwórz animację powitalną
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

