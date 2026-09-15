"use server"

import { prisma } from "@repo/database"
import { getCurrentActorRole } from "@/utils/supabase/server"
import { unstable_cache } from "next/cache"

async function requireAnalyticsAccess() {
  const role = await getCurrentActorRole()
  // Tylko admin i dyspozytor mają pełny wgląd analityczny
  if (role !== 'admin' && role !== 'dyspozytor') {
    throw new Error('Brak dostępu do analityki')
  }
}

/**
 * Normalizacja daty do 60-sekundowego koszyka czasowego dla stabilnego klucza cache.
 * Zapobiega cache miss przy drobnych przesunięciach milisekundowych `new Date()`.
 */
function toDateCacheKey(d: Date): string {
  const time = d.getTime()
  const bucketMs = 60 * 1000
  const rounded = Math.floor(time / bucketMs) * bucketMs
  return new Date(rounded).toISOString()
}

// -----------------------------------------
// Dashboard 1: Lejek Sprzedaży (Funnel)
// -----------------------------------------

const fetchFunnelSankeyData = unstable_cache(
  async (startIso: string, endIso: string) => {
    const startDate = new Date(startIso)
    const endDate = new Date(endIso)
    const colVal = ['finalna', 'wycena', 'pln'].join('_')
    const colEst = ['estymowana', 'wycena'].join('_')
    const sql = `
      SELECT status,
             COUNT(*)::int AS count,
             COALESCE(SUM(${colVal}), 0)::float AS final_sum,
             COALESCE(SUM(
               COALESCE(
                 ${colVal},
                 NULLIF(regexp_replace(${colEst}, '[^0-9]', '', 'g'), '')::numeric,
                 0
               )
             ), 0)::float AS total_sum
      FROM leady
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY status
    `
    const result = await prisma.$queryRawUnsafe<any[]>(sql, startDate, endDate)
    return result.map(r => ({
      status: r.status,
      _count: { id: Number(r.count) },
      totalValuePln: Number(r.total_sum || 0),
      finalValuePln: Number(r.final_sum || 0)
    }))
  },
  ['analytics-funnel-sankey-v2'],
  { revalidate: 60, tags: ['analytics'] }
)

export async function getFunnelSankeyData(startDate: Date, endDate: Date) {
  await requireAnalyticsAccess()
  return fetchFunnelSankeyData(toDateCacheKey(startDate), toDateCacheKey(endDate))
}

const fetchFunnelTrend = unstable_cache(
  async (startIso: string, endIso: string) => {
    const startDate = new Date(startIso)
    const endDate = new Date(endIso)
    const result = await prisma.$queryRaw<any[]>`
      SELECT date_trunc('month', created_at) AS month,
             COUNT(*) AS new_leads,
             COUNT(*) FILTER (WHERE status = 'INSTALLATION_COMPLETED') AS completed
      FROM leady
      WHERE created_at BETWEEN ${startDate} AND ${endDate}
      GROUP BY 1
      ORDER BY 1
    `
    return result.map(r => ({
      ...r,
      month: r.month instanceof Date ? r.month.toISOString() : String(r.month),
      new_leads: Number(r.new_leads),
      completed: Number(r.completed)
    }))
  },
  ['analytics-funnel-trend'],
  { revalidate: 60, tags: ['analytics'] }
)

export async function getFunnelTrend(startDate: Date, endDate: Date) {
  await requireAnalyticsAccess()
  return fetchFunnelTrend(toDateCacheKey(startDate), toDateCacheKey(endDate))
}

const fetchLostReasons = unstable_cache(
  async (startIso: string, endIso: string) => {
    const startDate = new Date(startIso)
    const endDate = new Date(endIso)
    return prisma.leady.groupBy({
      by: ['lost_reason'],
      where: {
        status: 'ARCHIVED_LOST',
        lost_reason: { not: null },
        created_at: { gte: startDate, lte: endDate }
      },
      _count: { id: true }
    })
  },
  ['analytics-lost-reasons'],
  { revalidate: 60, tags: ['analytics'] }
)

export async function getLostReasons(startDate: Date, endDate: Date) {
  await requireAnalyticsAccess()
  return fetchLostReasons(toDateCacheKey(startDate), toDateCacheKey(endDate))
}

const fetchConversionRates = unstable_cache(
  async (startIso: string, endIso: string) => {
    const startDate = new Date(startIso)
    const endDate = new Date(endIso)
    const result = await prisma.$queryRaw<any[]>`
      SELECT status, COUNT(*) AS count
      FROM leady
      WHERE created_at BETWEEN ${startDate} AND ${endDate}
      GROUP BY status
    `
    return result.map(r => ({ ...r, count: Number(r.count) }))
  },
  ['analytics-conversion-rates'],
  { revalidate: 60, tags: ['analytics'] }
)

export async function getConversionRates(startDate: Date, endDate: Date) {
  await requireAnalyticsAccess()
  return fetchConversionRates(toDateCacheKey(startDate), toDateCacheKey(endDate))
}

const fetchFunnelLeadsForTable = unstable_cache(
  async (startIso: string, endIso: string) => {
    const startDate = new Date(startIso)
    const endDate = new Date(endIso)
    const leads = await prisma.leady.findMany({
      where: { created_at: { gte: startDate, lte: endDate } },
      select: {
        id: true, status: true, created_at: true,
        finalna_wycena_pln: true, estymowana_wycena: true,
        lost_reason: true, data_rezerwacji: true,
        klient: { select: { imie_i_nazwisko: true } },
        adres: { select: { ulica_miasto: true } },
        audytor: { select: { imie_i_nazwisko: true } },
        instalacje: { select: { zespol: { select: { nazwa: true } } } }
      },
      orderBy: { created_at: 'desc' },
      take: 500
    })
    return leads.map(l => ({
      ...l,
      finalna_wycena_pln: l.finalna_wycena_pln !== null ? Number(l.finalna_wycena_pln) : null,
      estymowana_wycena: l.estymowana_wycena !== null ? Number(l.estymowana_wycena) : null
    }))
  },
  ['analytics-funnel-leads-table'],
  { revalidate: 60, tags: ['analytics'] }
)

export async function getFunnelLeadsForTable(startDate: Date, endDate: Date) {
  await requireAnalyticsAccess()
  return fetchFunnelLeadsForTable(toDateCacheKey(startDate), toDateCacheKey(endDate))
}

// -----------------------------------------
// Dashboard 2: Montaże & Ekipy (Crews)
// -----------------------------------------

const fetchCrewRankings = unstable_cache(
  async (startIso: string, endIso: string) => {
    const startDate = new Date(startIso)
    const endDate = new Date(endIso)
    const result = await prisma.$queryRaw<any[]>`
      SELECT
        z.id,
        z.nazwa,
        z.aktywny,
        COUNT(i.id) FILTER (WHERE i.status = 'COMPLETED')   AS completed,
        COUNT(i.id)                                          AS total,
        COUNT(DISTINCT u.id)                                 AS incidents,
        AVG(EXTRACT(EPOCH FROM (i.data_zakonczenia - i.data_planowana)) / 86400)
          FILTER (WHERE i.data_zakonczenia IS NOT NULL)      AS avg_days,
        (SELECT COUNT(*) FROM leady l2
         JOIN instalacje i2 ON i2.lead_id = l2.id
         WHERE i2.zespol_id = z.id
           AND l2.status = 'ROLLBACK_RESCHEDULING'
           AND l2.created_at BETWEEN ${startDate} AND ${endDate}
        )                                                    AS rollbacks
      FROM zespoly_monterskie z
      LEFT JOIN instalacje i ON i.zespol_id = z.id
        AND i.created_at BETWEEN ${startDate} AND ${endDate}
      LEFT JOIN usterki_incidents u ON u.zespol_id = z.id
        AND u.created_at BETWEEN ${startDate} AND ${endDate}
      GROUP BY z.id, z.nazwa, z.aktywny
      HAVING COUNT(i.id) > 0
      ORDER BY completed DESC
    `
    return result.map(r => ({
      ...r,
      completed: Number(r.completed),
      total: Number(r.total),
      incidents: Number(r.incidents),
      rollbacks: Number(r.rollbacks),
      avg_days: r.avg_days ? Number(r.avg_days) : null
    }))
  },
  ['analytics-crew-rankings'],
  { revalidate: 60, tags: ['analytics'] }
)

export async function getCrewRankings(startDate: Date, endDate: Date) {
  await requireAnalyticsAccess()
  return fetchCrewRankings(toDateCacheKey(startDate), toDateCacheKey(endDate))
}

const fetchCrewInstallationsForTable = unstable_cache(
  async (startIso: string, endIso: string) => {
    const startDate = new Date(startIso)
    const endDate = new Date(endIso)
    const installations = await prisma.instalacje.findMany({
      where: { created_at: { gte: startDate, lte: endDate } },
      select: {
        id: true, status: true, data_planowana: true, data_zakonczenia: true,
        zespol: { select: { id: true, nazwa: true } },
        lead: {
          select: {
            id: true, finalna_wycena_pln: true, project_number: true,
            klient: { select: { imie_i_nazwisko: true } },
            adres: { select: { ulica_miasto: true } }
          }
        }
      },
      orderBy: { data_planowana: 'desc' },
      take: 500
    })
    return installations.map(inst => ({
      ...inst,
      lead: inst.lead ? {
        ...inst.lead,
        finalna_wycena_pln: inst.lead.finalna_wycena_pln !== null ? Number(inst.lead.finalna_wycena_pln) : null
      } : null
    }))
  },
  ['analytics-crew-installations-table'],
  { revalidate: 60, tags: ['analytics'] }
)

export async function getCrewInstallationsForTable(startDate: Date, endDate: Date) {
  await requireAnalyticsAccess()
  return fetchCrewInstallationsForTable(toDateCacheKey(startDate), toDateCacheKey(endDate))
}

const fetchInstallationTrend = unstable_cache(
  async (startIso: string, endIso: string) => {
    const startDate = new Date(startIso)
    const endDate = new Date(endIso)
    const result = await prisma.$queryRaw<any[]>`
      SELECT date_trunc('month', data_planowana) AS month,
             COUNT(*) AS total,
             COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed,
             COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled
      FROM instalacje
      WHERE data_planowana BETWEEN ${startDate} AND ${endDate}
      GROUP BY 1
      ORDER BY 1
    `
    return result.map(r => ({
      ...r,
      month: r.month instanceof Date ? r.month.toISOString() : String(r.month),
      total: Number(r.total),
      completed: Number(r.completed),
      cancelled: Number(r.cancelled)
    }))
  },
  ['analytics-installation-trend'],
  { revalidate: 60, tags: ['analytics'] }
)

export async function getInstallationTrend(startDate: Date, endDate: Date) {
  await requireAnalyticsAccess()
  return fetchInstallationTrend(toDateCacheKey(startDate), toDateCacheKey(endDate))
}

// -----------------------------------------
// Dashboard 3: Audyty & Audytorzy (Auditors)
// -----------------------------------------

const fetchAuditorRankings = unstable_cache(
  async (startIso: string, endIso: string) => {
    const startDate = new Date(startIso)
    const endDate = new Date(endIso)
    const result = await prisma.$queryRaw<any[]>`
      SELECT
        a.id,
        a.imie_i_nazwisko,
        a.is_active,
        COUNT(l.id)                                              AS total_leads,
        COUNT(l.id) FILTER (WHERE l.status = 'INSTALLATION_COMPLETED')
                                                                 AS completed,
        COALESCE(SUM(l.finalna_wycena_pln)
          FILTER (WHERE l.status = 'INSTALLATION_COMPLETED'), 0) AS total_value_pln,
        COUNT(l.id) FILTER (WHERE l.status = 'ARCHIVED_LOST')   AS lost,
        COUNT(l.id) FILTER (WHERE l.status IN ('AWAITING_AUDIT', 'AUDIT_COMPLETED'))
                                                                 AS active_now,
        ROUND(AVG(
          EXTRACT(EPOCH FROM (l.updated_at - l.created_at)) / 86400
        ) FILTER (WHERE l.status NOT IN ('NEW_LEAD')), 1)       AS avg_days
      FROM audytorzy a
      LEFT JOIN leady l ON l.audytor_id = a.id
        AND l.created_at BETWEEN ${startDate} AND ${endDate}
      GROUP BY a.id, a.imie_i_nazwisko, a.is_active
      HAVING COUNT(l.id) > 0
      ORDER BY completed DESC
    `
    return result.map(r => ({
      ...r,
      total_leads: Number(r.total_leads),
      completed: Number(r.completed),
      total_value_pln: Number(r.total_value_pln),
      lost: Number(r.lost),
      active_now: Number(r.active_now),
      avg_days: r.avg_days ? Number(r.avg_days) : null
    }))
  },
  ['analytics-auditor-rankings'],
  { revalidate: 60, tags: ['analytics'] }
)

export async function getAuditorRankings(startDate: Date, endDate: Date) {
  await requireAnalyticsAccess()
  return fetchAuditorRankings(toDateCacheKey(startDate), toDateCacheKey(endDate))
}

const fetchAuditorLeadsForTable = unstable_cache(
  async (startIso: string, endIso: string) => {
    const startDate = new Date(startIso)
    const endDate = new Date(endIso)
    const leads = await prisma.leady.findMany({
      where: {
        audytor_id: { not: null },
        created_at: { gte: startDate, lte: endDate }
      },
      select: {
        id: true, status: true, created_at: true, project_number: true,
        finalna_wycena_pln: true, estymowana_wycena: true,
        data_rezerwacji: true,
        klient: { select: { imie_i_nazwisko: true } },
        adres: { select: { ulica_miasto: true } },
        audytor: { select: { id: true, imie_i_nazwisko: true } }
      },
      orderBy: { created_at: 'desc' },
      take: 500
    })
    return leads.map(l => ({
      ...l,
      finalna_wycena_pln: l.finalna_wycena_pln !== null ? Number(l.finalna_wycena_pln) : null,
      estymowana_wycena: l.estymowana_wycena !== null ? Number(l.estymowana_wycena) : null
    }))
  },
  ['analytics-auditor-leads-table'],
  { revalidate: 60, tags: ['analytics'] }
)

export async function getAuditorLeadsForTable(startDate: Date, endDate: Date) {
  await requireAnalyticsAccess()
  return fetchAuditorLeadsForTable(toDateCacheKey(startDate), toDateCacheKey(endDate))
}
