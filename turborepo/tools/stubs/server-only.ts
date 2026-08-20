// Stub dla testów (Vitest). W buildzie Next.js/Node zawsze rozwiązuje się prawdziwy
// pakiet `server-only`, który rzuca przy imporcie z komponentu klienckiego — to jest
// jedyny mechanizm chroniący AC7 w SERVICE-ROLE-LEADS-PAGE. Ten plik istnieje wyłącznie
// po to, żeby testy jednostkowe mogły importować moduły oznaczone `import 'server-only'`
// bez uruchamiania warunku exports "react-server", który poza tym zmieniłby
// rozwiązywanie modułów całego monorepo (patrz vitest.config.mts).
export {};
