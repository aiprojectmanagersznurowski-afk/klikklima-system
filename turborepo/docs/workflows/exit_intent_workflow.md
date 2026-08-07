# Workflow: Soft Lead Recovery (Exit-Intent)

Ten proces odpowiada za przechwytywanie tzw. "miękkich leadów" (użytkowników, którzy zawahali się przed ostateczną rezerwacją terminu). Mechanizm opiera się na technologii **Exit-Intent**, która wykrywa ruch kursora w stronę paska adresu lub przycisku zamknięcia karty w przeglądarce.

## Diagram Przepływu (Mermaid)

```mermaid
flowchart TD
    Start["Klient jest w trakcie Triage / na ekranie Bookingu"] --> CheckIntent{"Wykryto Exit-Intent?\n(Kursor ucieka z okna)"}
    
    CheckIntent -- "Nie" --> Continue["Klient kontynuuje proces"]
    CheckIntent -- "Tak" --> CheckData{"Czy proces jest niedokończony?"}
    
    CheckData -- "Tak (Brak rezerwacji)" --> Popup["Wyświetl Modal (Exit-Intent):\n'Nie znalazłeś terminu? Zostaw numer, oddzwonimy z inną propozycją!'"]
    
    Popup --> UserAction{"Reakcja Klienta"}
    
    UserAction -- "Ignoruje / Zamyka" --> EndLost["Koniec: Lead Utracony"]
    UserAction -- "Zostawia Numer" --> SaveDB["Zapis do bazy Supabase:\nStatus: 'Soft Lead / Do obdzwonienia'"]
    
    SaveDB --> LinkTriage["Dołącz zebrane do tej pory\ndane z kalkulatora (Pokoje, Metraż)"]
    
    LinkTriage --> B2BPanel["Wyświetlenie w Panelu B2B (Tabela zgłoszeń)\njako zadanie priorytetowe dla Dyspozytora"]
    LinkTriage -- "Webhook" --> SlackNotification["(Opcjonalnie) Powiadomienie na Slack / E-mail do działu handlowego"]
    
    style Popup fill:#e11d48,stroke:#9f1239,color:white
    style SaveDB fill:#10b981,stroke:#047857,color:white
```

## Implikacje dla Bazy Danych

Zamiast tworzyć nową tabelę, najlepiej wykorzystać istniejącą tabelę `leady`. Będziemy zapisywać do niej częściowo wypełniony obiekt `odpowiedzi_triage`, ale z odpowiednim statusem.

Wymaga to rozszerzenia pola `status_leada` o nową wartość (np. `Soft Lead` lub `Porzucony`).

**Przykładowy zrzut danych przy Exit-Intent:**
```json
// Tabela: leady
{
  "status_leada": "Soft Lead",
  "dane_kontaktowe": {
    "telefon": "+48 987 654 321"
  },
  "odpowiedzi_triage": {
    "etap_porzucenia": "Krok 3 - Metraż",
    "pokoje": [
      { "id": 1, "metraz": "Do 25m2" }
    ]
  }
}
```
Dzięki temu Dyspozytor dzwoniąc do klienta wie, że klient szukał klimatyzacji do 1 pokoju, co drastycznie zwiększa szanse na sprzedaż.

## Wizualizacja Diagramu
![Diagram Soft Lead (Exit-Intent)](./exit_intent_workflow.png)
