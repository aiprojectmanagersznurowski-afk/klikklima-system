"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function ExitIntentSettingsPage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ustawienia: Exit Intent</h1>
        <p className="text-muted-foreground mt-2">
          Zarządzaj ustawieniami popupu ratunkowego (Exit Intent).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status popupu</CardTitle>
          <CardDescription>
            Zdecyduj, czy popup Exit Intent ma być aktywny dla użytkowników opuszczających stronę.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="exit-intent-active" className="text-base font-medium">
              Włącz popup Exit Intent
            </Label>
            <p className="text-sm text-muted-foreground">
              Popup wyświetli się, gdy użytkownik spróbuje opuścić stronę, np. przesuwając kursor poza obszar przeglądarki.
            </p>
          </div>
          <Switch id="exit-intent-active" />
        </CardContent>
      </Card>
    </div>
  );
}
