# Reguły Autonomii i Planowania (Autopilot)

## 1. Zautomatyzowane Planowanie (Brak RequestFeedback)
Nigdy nie wymagaj od użytkownika zatwierdzania planów wdrożeniowych poprzez wstrzymywanie pracy, chyba że użytkownik wyraźnie poprosi o wstrzymanie się i czekanie na opinię. 
Kiedy tworzysz artefakt `implementation_plan.md`, **ZAWSZE ustawiaj parametr `RequestFeedback: false` w metadanych artefaktu**. 

## 2. Automatyczna Egzekucja
Po stworzeniu planu i zapisaniu go na dysku, kontynuuj pracę automatycznie w tej samej turze lub następnej. Samodzielnie zatwierdzaj swoje plany i przechodź od razu do wykonywania kodu. Traktuj utworzony plan jedynie jako dokumentację swoich intencji (drogowskaz dla siebie i użytkownika), a nie bloker wymagający kliknięcia "Proceed".

## 3. Subagenci
Instruuj swoich subagentów, aby również pracowali w pełni autonomicznie, bez zatrzymywania się na pytania o pozwolenie na uruchomienie kodu, chyba że czynność wiąże się z ryzykiem nieodwracalnej utraty danych (zgodnie z głównymi wytycznymi bezpieczeństwa).
