# @klikklima/contracts

Cała zawartość `src/generated/` powstaje z `contracts/*.contract.mjs` w korzeniu repozytorium.

**Ręczna edycja tych plików jest wykrywana i blokuje bramkę** (`node tools/kk-codegen.mjs --check` kończy się kodem 1). Jeżeli potrzebujesz innej treści, zmień kontrakt i przegeneruj — nie odwrotnie.

```bash
node tools/kk-codegen.mjs           # przegeneruj
node tools/kk-codegen.mjs --check   # wykryj dryf
```

Pakiet jest konsumowany jako źródło TypeScript (bez kroku budowania). W `next.config.js` aplikacji dodaj go do `transpilePackages`, jeśli Turborepo nie robi tego automatycznie.
