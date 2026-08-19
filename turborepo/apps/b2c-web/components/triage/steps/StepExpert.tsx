"use client";
import React from 'react';
import { useTriageStore } from '@/store/triageStore';
import { companyDetails } from '@/config/company';
import { StepWrapper } from '../StepWrapper';
import { Button } from '@/components/ui/button';
import { Phone, ArrowRight } from 'lucide-react';
import { ROOM_COUNT_EXPERT_THRESHOLD } from '@klikklima/contracts';

/**
 * Ekran Eksperta — WO B2C-TRIAGE-DISQUALIFY, sekcja "Treść ekranu Eksperta"
 * (zatwierdzona przez człowieka, wstawiona dosłownie). To NIE jest koniec
 * ścieżki (D6): klient nadal rezerwuje termin audytu, tylko bez automatycznej
 * wyceny — bo ta wymaga oględzin na miejscu (D8: wycena po audycie jest wiążąca).
 */
export const StepExpert = () => {
  const { nextStep, prevStep } = useTriageStore();

  return (
    <StepWrapper
      title="Twoja instalacja zasługuje na dokładną wycenę"
      subtitle="Przy tej skali wolimy podać kwotę, której będziemy się trzymać."
    >
      <div className="max-w-2xl mx-auto bg-card rounded-2xl p-8 sm:p-12 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-border/50 text-center">
        <p className="text-muted-foreground text-lg mb-6">
          Przy instalacjach obejmujących <strong className="text-foreground">{ROOM_COUNT_EXPERT_THRESHOLD} i więcej pomieszczeń</strong> oraz
          w lokalach komercyjnych o koszcie decydują szczegóły, których nie widać przez formularz —
          rozmieszczenie jednostek, długość instalacji chłodniczej, przebicia przez ściany, sposób
          odprowadzenia skroplin.
        </p>

        <p className="text-muted-foreground text-lg mb-10">
          Moglibyśmy pokazać tu orientacyjną kwotę, ale wolimy tego nie robić. Zamiast tego przyjedzie
          inżynier, obejrzy miejsce montażu i przygotuje wycenę opartą na tym, co faktycznie zastanie.
        </p>

        <Button
          type="button"
          size="lg"
          onClick={nextStep}
          className="w-full text-lg h-auto py-4"
        >
          Umów bezpłatny audyt
          <ArrowRight className="w-5 h-5" />
        </Button>
        <p className="mt-3 text-sm text-muted-foreground">
          Audyt jest bezpłatny i niezobowiązujący.
        </p>

        <a
          href={`tel:${companyDetails.phone}`}
          className="mt-8 inline-flex items-center justify-center gap-3 w-full bg-secondary text-foreground font-bold text-lg rounded-md px-8 py-4 transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Phone className="w-5 h-5 text-primary" />
          {companyDetails.phoneDisplay}
        </a>

        <div className="mt-8 pt-8 border-t border-border">
          <button
            type="button"
            onClick={prevStep}
            className="text-primary font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
          >
            Wróć i zmień odpowiedzi
          </button>
        </div>
      </div>
    </StepWrapper>
  );
};
