import { describe, it, expect, vi, beforeEach } from "vitest"

const {
  clientFindManyMock,
  leadFindManyMock,
  incidentFindManyMock,
  installationFindManyMock,
  getCurrentActorRoleMock,
} = vi.hoisted(() => ({
  clientFindManyMock: vi.fn(),
  leadFindManyMock: vi.fn(),
  incidentFindManyMock: vi.fn(),
  installationFindManyMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
}))

vi.mock("@repo/database", () => ({
  prisma: {
    klienci: {
      findMany: clientFindManyMock,
    },
    leady: {
      findMany: leadFindManyMock,
    },
    usterki_incidents: {
      findMany: incidentFindManyMock,
    },
    instalacje: {
      findMany: installationFindManyMock,
    },
  },
}))

vi.mock("../src/utils/supabase/server", () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
}))

describe("CRM-KLI-SEARCH: globalSearchAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("zwraca puste wyniki dla zapytania krótszego niż 2 znaki bez odpytywania bazy", async () => {
    const { globalSearchAction } = await import(
      "../src/components/global-search/actions"
    )

    const res = await globalSearchAction("a")

    expect(res.totalCount).toBe(0)
    expect(res.clients).toEqual([])
    expect(clientFindManyMock).not.toHaveBeenCalled()
    expect(leadFindManyMock).not.toHaveBeenCalled()
  })

  it("odrzuca zapytanie fail-closed gdy brak roli", async () => {
    getCurrentActorRoleMock.mockResolvedValue(null)
    const { globalSearchAction } = await import(
      "../src/components/global-search/actions"
    )

    const res = await globalSearchAction("Kowalski")

    expect(res.totalCount).toBe(0)
    expect(clientFindManyMock).not.toHaveBeenCalled()
  })

  it("zwraca wyniki wyszukiwania z podziałem na klientów, projekty i incydenty", async () => {
    getCurrentActorRoleMock.mockResolvedValue("dyspozytor")

    clientFindManyMock.mockResolvedValue([
      {
        id: "c-1",
        imie_i_nazwisko: "Jan Kowalski",
        email: "jan@example.com",
        telefon: "500100200",
        adresy: [{ ulica_miasto: "Warszawa, Marszałkowska 1" }],
      },
    ])

    leadFindManyMock.mockResolvedValue([
      {
        id: "l-1",
        project_number: "L-000042",
        status: "NEW_LEAD",
        klient: { imie_i_nazwisko: "Jan Kowalski" },
      },
    ])

    incidentFindManyMock.mockResolvedValue([
      {
        id: "inc-1",
        numer_zgloszenia: "INC-2026-0001",
        status: "NOWE",
        priorytet: "KRYTYCZNY",
        opis_usterki: "Wyciek czynnika chłodniczego",
        klient: { imie_i_nazwisko: "Jan Kowalski" },
      },
    ])

    installationFindManyMock.mockResolvedValue([])

    const { globalSearchAction } = await import(
      "../src/components/global-search/actions"
    )

    const res = await globalSearchAction("Kowalski")

    expect(res.totalCount).toBe(3)
    expect(res.clients).toHaveLength(1)
    expect(res.clients[0].title).toBe("Jan Kowalski")
    expect(res.clients[0].href).toBe("/customers/c-1")

    expect(res.leads).toHaveLength(1)
    expect(res.leads[0].title).toBe("Projekt L-000042")
    expect(res.leads[0].href).toBe("/leads/l-1")

    expect(res.incidents).toHaveLength(1)
    expect(res.incidents[0].title).toBe("INC-2026-0001")
    expect(res.incidents[0].badgeVariant).toBe("destructive")
  })
})
