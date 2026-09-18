import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // tsconfig.json (used by `npm run check-types` / CI) includes tests/ so
    // vitest-only files get type-checked there too. `next build`'s own
    // type-check doesn't need that, and some deploy environments don't
    // install vitest (a devDependency) at all, which crashed the sibling
    // b2c-web build on an unrelated *.itest.ts import. tsconfig.build.json
    // is the same config minus tests/.
    tsconfigPath: "./tsconfig.build.json",
  },
  // Przeglądarka dokumentacji (`/dokumentacja`) czyta pliki `.md` z `turborepo/docs/`
  // przez `node:fs` (`src/lib/docs/docs-catalog.ts`) — katalog leży POZA `apps/b2b-web`,
  // więc domyślne śledzenie plików Vercela (`@vercel/nft`) go nie widzi. Wartości globów
  // są rozwiązywane względem katalogu projektu Next (`apps/b2b-web`), klucze to globy tras.
  outputFileTracingIncludes: {
    "/dokumentacja": ["../../docs/**/*.md"],
    "/dokumentacja/[slug]": ["../../docs/**/*.md"],
    "/chat": ["../../docs/**/*.md"],
  },
};

export default nextConfig;
