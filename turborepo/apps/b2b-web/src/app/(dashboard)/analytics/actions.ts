"use server"

import { prisma } from "@repo/database"
import { getCurrentActorRole } from "@/utils/supabase/server"

async function requireAnalyticsAccess() {
  const role = await getCurrentActorRole()
  // Tylko admin i dyspozytor mają pełny wgląd analityczny
  if (role !== 'admin' && role !== 'dyspozytor') {
    throw new Error('Brak dostępu do analityki')
  }
}

// -----------------------------------------
// Dashboard 1: Lejek Sprzedaży (Funnel)
// -----------------------------------------

export async function getFunnelSankeyData(startDate: Date, endDate: Date) {
  await requireAnalyticsAccess()
  
  const statusCounts = await prisma.leady.groupBy({
    by: ['status'],
    where: { created_at: { gte: startDate, lte: endDate } },
    _count: { id: true }
  })
  
  // W praktyce dla precyzyjnego Sankeya, musielibyśmy badać historię zmian statusu (audit_log).
  // Tutaj stosujemy aproksymację, traktując, że każdy lead w statusie N przeszedł przez 1..(N-1).
  // Ale dla prostoty zwracamy surowe ilości (ile wpadło do danego wiadra) i 
  // zbudujemy node'y oraz przeloty szacowane u klienta, albo połączymy z bucketami jak QUOTE_REJECTED.
  
  return statusCounts
}

export async function getFunnelTrend(startDate: Date, endDate: Date) {
  await requireAnalyticsAccess()
  
  const result = await prisma.$queryRaw<any[]>`
    SELECT date_trunc('month', created_at) AS month,
           COUNT(*) AS new_leads,
           COUNT(*) FILTER (WHERE status = 'INSTALLATION_COMPLETED') AS completed
    FROM leady
    WHERE created_at BETWEEN ${startDate} AND ${endDate}
    GROUP BY 1
    ORDER BY 1
  `
  // Konwersja na serializowalne obiekty
  return result.map(r => ({
    ...r,
    new_leads: Number(r.new_leads),
    completed: Number(r.completed)
  }))
}

export async function getLostReasons(startDate: Date, endDate: Date) {
  await requireAnalyticsAccess()
  
  return prisma.leady.groupBy({
    by: ['lost_reason'],
    where: {
      status: 'ARCHIVED_LOST',
      lost_reason: { not: null },
      created_at: { gte: startDate, lte: endDate }
    },
    _count: { id: true }
  })
}

export async function getConversionRates(startDate: Date, endDate: Date) {
  await requireAnalyticsAccess()
  
  const result = await prisma.$queryRaw<any[]>`
    SELECT status, COUNT(*) AS count
    FROM leady
    WHERE created_at BETWEEN ${startDate} AND ${endDate}
    GROUP BY status
  `
  return result.map(r => ({ ...r, count: Number(r.count) }))
}

export async function getFunnelLeadsForTable(startDate: Date, endDate: Date) {
  await requireAnalyticsAccess()
  
  return prisma.leady.findMany({
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
    take: 500 // Limit bezpieczeństwa dla wydajności tabeli analitycznej
  })
}

// -----------------------------------------
// Dashboard 2: Montaże & Ekipy (Crews)
// -----------------------------------------

export async function getCrewRankings(startDate: Date, endDate: Date) {
  await requireAnalyticsAccess()
  
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
}

export async function getCrewInstallationsForTable(startDate: Date, endDate: Date) {
  await requireAnalyticsAccess()
  
  return prisma.instalacje.findMany({
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
}

export async function getInstallationTrend(startDate: Date, endDate: Date) {
  await requireAnalyticsAccess()
  
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
    total: Number(r.total),
    completed: Number(r.completed),
    cancelled: Number(r.cancelled)
  }))
}

// -----------------------------------------
// Dashboard 3: Audyty & Audytorzy (Auditors)
// -----------------------------------------

export async function getAuditorRankings(startDate: Date, endDate: Date) {
  await requireAnalyticsAccess()
  
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
}

export async function getAuditorLeadsForTable(startDate: Date, endDate: Date) {
  await requireAnalyticsAccess()
  
  return prisma.leady.findMany({
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
}
