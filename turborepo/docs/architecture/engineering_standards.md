# Engineering Standards

## Next.js Rules
1. **Server Components by Default:** Minimize the use of `"use client"`. Use Server Components (`page.tsx`, `layout.tsx`) to fetch data directly via Prisma.
2. **Server Actions for Mutations:** Do not use API routes (`/app/api/...`) for internal app logic. Form submissions must be handled via Server Actions (e.g. `actions.ts`) using the `useFormState` or direct invocation.
3. **Data Fetching:** Do not use `useEffect` or `SWR`/`React Query` unless absolutely necessary for complex client-side polling. Fetch on the server.

## Database & ORM (Prisma)
1. **Validation:** All inputs to Server Actions must be strictly parsed using Zod before touching Prisma.
2. **Raw SQL:** Avoid raw SQL. Use Prisma's relational queries (`include`, `select`). Raw SQL is only permitted for complex analytics/reports or mass seeding.
3. **Types:** Rely on Prisma's generated types (e.g. `Prisma.UserGetPayload`). Do not manually cast types with `as`.

(To be expanded by the tech lead)
