import { describe, it } from 'vitest';
import { prisma } from '@repo/database';

// TYMCZASOWY plik diagnostyczny — nie jest testem, tylko sondą wypisującą stan
// danych po seedzie w CI (żywy Postgres, `supabase start` + `fuji_seed.sql`).
// Do usunięcia po zdiagnozowaniu, dlaczego triage.spec.ts/catalog.spec.ts nadal
// nie widzą wyników mimo obecności danych w bazowych tabelach.
describe('DIAGNOSTYKA (tymczasowa, do usunięcia)', () => {
  it('wypisuje stan available_combinations i tabel bazowych', async () => {
    const acCount = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      'SELECT count(*)::bigint AS count FROM available_combinations',
    );
    console.log('DIAG available_combinations total rows:', acCount[0]?.count?.toString());

    const acByRoomCount = await prisma.$queryRawUnsafe<{ room_count: number; count: bigint }[]>(
      'SELECT room_count, count(*)::bigint AS count FROM available_combinations GROUP BY room_count ORDER BY room_count',
    );
    console.log('DIAG available_combinations by room_count:', JSON.stringify(acByRoomCount.map(r => ({ room_count: r.room_count, count: r.count.toString() }))));

    const hash07 = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      "SELECT type, sizes_hash, room_count, is_available, total_devices_price FROM available_combinations WHERE room_count = 1 AND sizes_hash = '07' LIMIT 5",
    );
    console.log('DIAG hash=07 room_count=1 rows:', JSON.stringify(hash07));

    const indoorCount = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      'SELECT count(*)::bigint AS count FROM indoor_units',
    );
    console.log('DIAG indoor_units total:', indoorCount[0]?.count?.toString());

    const outdoorCount = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      'SELECT count(*)::bigint AS count FROM outdoor_units',
    );
    console.log('DIAG outdoor_units total:', outdoorCount[0]?.count?.toString());

    const singleCount = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      'SELECT count(*)::bigint AS count FROM single_split_sets',
    );
    console.log('DIAG single_split_sets total:', singleCount[0]?.count?.toString());

    const multiCount = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      'SELECT count(*)::bigint AS count FROM multi_split_sets',
    );
    console.log('DIAG multi_split_sets total:', multiCount[0]?.count?.toString());

    const sampleIndoor = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      "SELECT id, model_code, is_single_compatible, is_multi_compatible FROM indoor_units WHERE model_code = 'ASHH07KJCAL'",
    );
    console.log('DIAG sample indoor ASHH07KJCAL:', JSON.stringify(sampleIndoor));

    const sampleSingleSet = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      "SELECT sss.id, sss.indoor_unit_id, sss.outdoor_unit_id, iu.model_code AS indoor_model, iu.is_single_compatible FROM single_split_sets sss JOIN indoor_units iu ON iu.id = sss.indoor_unit_id WHERE iu.model_code = 'ASHH07KJCAL'",
    );
    console.log('DIAG single_split_sets referencing ASHH07KJCAL:', JSON.stringify(sampleSingleSet));

    // Widok materializowany może być nieodświeżony, jeśli trigger nie zadziałał — sprawdź jawnie.
    await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW available_combinations');
    const acCountAfterRefresh = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      'SELECT count(*)::bigint AS count FROM available_combinations',
    );
    console.log('DIAG available_combinations count AFTER manual REFRESH:', acCountAfterRefresh[0]?.count?.toString());

    // Dokładnie to samo zapytanie, ktore robi getRecommendation.ts, ale jako rola anon
    // (Step7Success idzie przez lib/supabaseClient.ts, ktory od AC5 jest anon-only).
    const anonResult = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE anon');
      return tx.$queryRawUnsafe<Record<string, unknown>[]>(
        "SELECT type, sizes_hash, room_count, is_available, outdoor_unit_id, series_name, brand FROM available_combinations WHERE room_count = 1 AND sizes_hash = '07' AND is_available = true LIMIT 5",
      );
    });
    console.log('DIAG SAME QUERY AS ROLE ANON (room_count=1, sizes_hash=07):', JSON.stringify(anonResult));

    const anonIndoorLookup = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE anon');
      return tx.$queryRawUnsafe<Record<string, unknown>[]>(
        "SELECT id, model_code, series_name, brand FROM indoor_units WHERE series_name = 'KJCAL' AND brand = 'Fuji Electric' AND model_code LIKE '%07%' ORDER BY price_netto ASC LIMIT 1",
      );
    });
    console.log('DIAG anon indoor_units lookup (series_name=KJCAL, model_code LIKE %07%):', JSON.stringify(anonIndoorLookup));

    const anonOutdoorLookup = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE anon');
      const combo = anonResult[0];
      if (!combo) return null;
      return tx.$queryRawUnsafe<Record<string, unknown>[]>(
        'SELECT id, model_code FROM outdoor_units WHERE id = $1::uuid',
        combo.outdoor_unit_id,
      );
    });
    console.log('DIAG anon outdoor_units lookup by id from combo:', JSON.stringify(anonOutdoorLookup));

    const anonCennikLookup = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE anon');
      return tx.$queryRawUnsafe<Record<string, unknown>[]>(
        "SELECT koszt_b2c_netto FROM cennik_uslug WHERE nazwa_uslugi = 'Montaż wzorcowy' LIMIT 1",
      );
    });
    console.log('DIAG anon cennik_uslug lookup (expected EMPTY - RLS revoked, admin client used instead):', JSON.stringify(anonCennikLookup));
  });
});
