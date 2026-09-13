"use server"

import { prisma } from "@repo/database"
import { can } from "@klikklima/contracts"
import { getCurrentActorRole } from "../../utils/supabase/server"
import { shortId } from "../../lib/format-id"
import { formatLeadStatus, formatInstallationStatus } from "../../lib/format-status"

export type SearchResultItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
};

export type GlobalSearchResult = {
  clients: SearchResultItem[];
  leads: SearchResultItem[];
  incidents: SearchResultItem[];
  installations: SearchResultItem[];
  totalCount: number;
};

export async function globalSearchAction(query: string): Promise<GlobalSearchResult> {
  const trimmed = query.trim()
  const emptyResult: GlobalSearchResult = {
    clients: [],
    leads: [],
    incidents: [],
    installations: [],
    totalCount: 0,
  }

  if (trimmed.length < 2) {
    return emptyResult
  }

  let actorRole
  try {
    actorRole = await getCurrentActorRole()
  } catch (err) {
    console.error("Failed to resolve actor role for search:", err)
    return emptyResult
  }

  if (!actorRole) {
    return emptyResult
  }

  const canReadClients = can(actorRole, "clients", "read") === "yes"
  const canReadLeads = can(actorRole, "leads", "read") === "yes"
  const canReadIncidents = can(actorRole, "incidents", "read") !== "no"
  const canReadInstallations = can(actorRole, "installations", "read") !== "no"

  const q = trimmed.toLowerCase()

  const [matchingClients, matchingLeads, matchingIncidents, matchingInstallations] =
    await Promise.all([
      // 1. Klienci (client_number K-..., imię, e-mail, telefon)
      canReadClients
        ? prisma.klienci.findMany({
            where: {
              anonymized_at: null,
              OR: [
                { client_number: { contains: trimmed, mode: "insensitive" } },
                { imie_i_nazwisko: { contains: trimmed, mode: "insensitive" } },
                { email: { contains: trimmed, mode: "insensitive" } },
                { telefon: { contains: trimmed } },
              ],
            },
            select: {
              id: true,
              client_number: true,
              imie_i_nazwisko: true,
              email: true,
              telefon: true,
              adresy: {
                select: { ulica_miasto: true },
                take: 1,
              },
            },
            take: 5,
          })
        : [],

      // 2. Leady / Projekty (project_number L-..., nazwa klienta)
      canReadLeads
        ? prisma.leady.findMany({
            where: {
              OR: [
                { project_number: { contains: trimmed, mode: "insensitive" } },
                { klient: { imie_i_nazwisko: { contains: trimmed, mode: "insensitive" } } },
              ],
            },
            select: {
              id: true,
              project_number: true,
              status: true,
              klient: {
                select: { imie_i_nazwisko: true },
              },
            },
            take: 5,
          })
        : [],

      // 3. Usterki (incident_number U-..., numer zgłoszenia, opis)
      canReadIncidents
        ? prisma.usterki_incidents.findMany({
            where: {
              OR: [
                { incident_number: { contains: trimmed, mode: "insensitive" } },
                { numer_zgloszenia: { contains: trimmed, mode: "insensitive" } },
                { opis_usterki: { contains: trimmed, mode: "insensitive" } },
                { klient: { imie_i_nazwisko: { contains: trimmed, mode: "insensitive" } } },
              ],
            },
            select: {
              id: true,
              incident_number: true,
              numer_zgloszenia: true,
              status: true,
              priorytet: true,
              opis_usterki: true,
              klient: {
                select: { imie_i_nazwisko: true },
              },
            },
            take: 5,
          })
        : [],

      // 4. Instalacje (installation_number I-..., lead project_number, klient)
      canReadInstallations
        ? prisma.instalacje.findMany({
            where: {
              OR: [
                { installation_number: { contains: trimmed, mode: "insensitive" } },
                { lead: { project_number: { contains: trimmed, mode: "insensitive" } } },
                { lead: { klient: { imie_i_nazwisko: { contains: trimmed, mode: "insensitive" } } } },
              ],
            },
            select: {
              id: true,
              installation_number: true,
              status: true,
              lead: {
                select: {
                  project_number: true,
                  klient: {
                    select: { imie_i_nazwisko: true },
                  },
                },
              },
            },
            take: 5,
          })
        : [],
    ])

  const clients: SearchResultItem[] = matchingClients.map((c) => {
    const name = c.imie_i_nazwisko || "Bez nazwy";
    return {
      id: c.id,
      title: c.client_number ? `${c.client_number} — ${name}` : name,
      subtitle: [c.telefon, c.email, c.adresy?.[0]?.ulica_miasto].filter(Boolean).join(" • "),
      href: `/customers/${c.id}`,
      badge: "Klient",
      badgeVariant: "default",
    };
  });

  const leads: SearchResultItem[] = matchingLeads.map((l) => ({
    id: l.id,
    title: l.project_number ? `Projekt ${l.project_number}` : `Lead ${shortId(l.id)}`,
    subtitle: l.klient?.imie_i_nazwisko || "Brak przypisanego klienta",
    href: `/leads/${l.id}`,
    badge: formatLeadStatus(l.status),
    badgeVariant: "secondary",
  }))

  const incidents: SearchResultItem[] = matchingIncidents.map((inc) => ({
    id: inc.id,
    title: inc.incident_number || inc.numer_zgloszenia || `Zgłoszenie ${shortId(inc.id)}`,
    subtitle: `${inc.klient?.imie_i_nazwisko ? inc.klient.imie_i_nazwisko + " • " : ""}${inc.opis_usterki?.slice(0, 50) || "Brak opisu"}`,
    href: `/incidents`,
    badge: inc.priorytet || "Usterka",
    badgeVariant: inc.priorytet === "KRYTYCZNY" ? "destructive" : "secondary",
  }))

  const installations: SearchResultItem[] = matchingInstallations.map((inst) => ({
    id: inst.id,
    title: inst.installation_number
      ? `Instalacja ${inst.installation_number}${inst.lead?.project_number ? ` (${inst.lead.project_number})` : ""}`
      : inst.lead?.project_number
      ? `Instalacja (${inst.lead.project_number})`
      : `Instalacja ${shortId(inst.id)}`,
    subtitle: inst.lead?.klient?.imie_i_nazwisko || "Zlecenie montażu",
    href: `/installations/${inst.id}`,
    badge: formatInstallationStatus(inst.status),
    badgeVariant: "outline",
  }))

  const totalCount = clients.length + leads.length + incidents.length + installations.length

  return {
    clients,
    leads,
    incidents,
    installations,
    totalCount,
  }
}
