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
};

export default nextConfig;
