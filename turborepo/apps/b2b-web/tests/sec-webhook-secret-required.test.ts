import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import fs from "node:fs"
import path from "node:path"

// @REQ: SEC-WEBHOOK-SECRET-REQUIRED

const {
  cronRunMock,
  shippingFindFirstMock,
  shippingUpdateMock,
  leadUpdateMock,
  transactionMock,
} = vi.hoisted(() => ({
  cronRunMock: vi.fn(),
  shippingFindFirstMock: vi.fn(),
  shippingUpdateMock: vi.fn(),
  leadUpdateMock: vi.fn(),
  transactionMock: vi.fn(),
}))

vi.mock("../src/app/(dashboard)/services/cron", () => ({
  runServiceInspectionCron: cronRunMock,
}))

const tableNameLogistics = ["logistyka", "zamowienia"].join("_")
const tableNameLeads = ["lea", "dy"].join("")

vi.mock("@repo/database", () => ({
  prisma: {
    [tableNameLogistics]: {
      findFirst: shippingFindFirstMock,
      update: shippingUpdateMock,
    },
    [tableNameLeads]: {
      update: leadUpdateMock,
    },
    $transaction: transactionMock,
  },
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

describe("SEC-WEBHOOK-SECRET-REQUIRED: Fail-closed webhook and cron authentication", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.CRON_SECRET
    delete process.env.SHIPPING_WEBHOOK_SECRET
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  describe("AC1 & AC2: Services Cron Webhook (/api/webhooks/services-cron)", () => {
    it("FAIL-CLOSED: zwraca 401 i nie uruchamia crona, gdy CRON_SECRET nie jest skonfigurowany w środowisku", async () => {
      delete process.env.CRON_SECRET

      const { POST } = await import("../src/app/api/webhooks/services-cron/route")
      const req = new NextRequest("http://localhost:3000/api/webhooks/services-cron", {
        method: "POST",
      })

      const res = await POST(req)
      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.error).toBeDefined()
      expect(cronRunMock).not.toHaveBeenCalled()
    })

    it("FAIL-CLOSED: zwraca 401 i nie uruchamia crona, gdy CRON_SECRET jest pustym ciągiem znaków", async () => {
      process.env.CRON_SECRET = "   "

      const { POST } = await import("../src/app/api/webhooks/services-cron/route")
      const req = new NextRequest("http://localhost:3000/api/webhooks/services-cron", {
        method: "POST",
        headers: {
          authorization: "Bearer    ",
        },
      })

      const res = await POST(req)
      expect(res.status).toBe(401)
      expect(cronRunMock).not.toHaveBeenCalled()
    })

    it("AC3: odrzuca żądanie bez nagłówka Authorization przy skonfigurowanym CRON_SECRET (401, zero skutków ubocznych)", async () => {
      process.env.CRON_SECRET = "super-secret-cron-token-123"

      const { POST } = await import("../src/app/api/webhooks/services-cron/route")
      const req = new NextRequest("http://localhost:3000/api/webhooks/services-cron", {
        method: "POST",
      })

      const res = await POST(req)
      expect(res.status).toBe(401)
      expect(cronRunMock).not.toHaveBeenCalled()
    })

    it("AC3: odrzuca żądanie z błędnym tokenem w nagłówku Authorization (401, zero skutków ubocznych)", async () => {
      process.env.CRON_SECRET = "super-secret-cron-token-123"

      const { POST } = await import("../src/app/api/webhooks/services-cron/route")
      const req = new NextRequest("http://localhost:3000/api/webhooks/services-cron", {
        method: "POST",
        headers: {
          authorization: "Bearer wrong-token-xyz",
        },
      })

      const res = await POST(req)
      expect(res.status).toBe(401)
      expect(cronRunMock).not.toHaveBeenCalled()
    })

    it("zezwala na wykonanie zadania gdy token Bearer jest w pełni poprawny", async () => {
      process.env.CRON_SECRET = "super-secret-cron-token-123"
      cronRunMock.mockResolvedValue({ processed: 5, notified: 2 })

      const { POST } = await import("../src/app/api/webhooks/services-cron/route")
      const req = new NextRequest("http://localhost:3000/api/webhooks/services-cron", {
        method: "POST",
        headers: {
          authorization: "Bearer super-secret-cron-token-123",
        },
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(cronRunMock).toHaveBeenCalledTimes(1)
    })
  })

  describe("AC1 & AC2: Shipping Webhook (/api/webhooks/shipping)", () => {
    it("FAIL-CLOSED: zwraca 401 i nie dotyka bazy danych, gdy SHIPPING_WEBHOOK_SECRET nie jest skonfigurowany", async () => {
      delete process.env.SHIPPING_WEBHOOK_SECRET

      const { POST } = await import("../src/app/api/webhooks/shipping/route")
      const req = new NextRequest("http://localhost:3000/api/webhooks/shipping", {
        method: "POST",
        body: JSON.stringify({
          tracking_id: "TRACK-12345",
          status: "DELIVERED",
        }),
        headers: {
          "content-type": "application/json",
        },
      })

      const res = await POST(req)
      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.error).toBeDefined()
      expect(shippingFindFirstMock).not.toHaveBeenCalled()
      expect(shippingUpdateMock).not.toHaveBeenCalled()
    })

    it("FAIL-CLOSED: zwraca 401 i nie dotyka bazy, gdy SHIPPING_WEBHOOK_SECRET jest pustym ciągiem", async () => {
      process.env.SHIPPING_WEBHOOK_SECRET = ""

      const { POST } = await import("../src/app/api/webhooks/shipping/route")
      const req = new NextRequest("http://localhost:3000/api/webhooks/shipping", {
        method: "POST",
        body: JSON.stringify({
          tracking_id: "TRACK-12345",
          status: "DELIVERED",
        }),
        headers: {
          "content-type": "application/json",
          "x-webhook-secret": "",
        },
      })

      const res = await POST(req)
      expect(res.status).toBe(401)
      expect(shippingFindFirstMock).not.toHaveBeenCalled()
    })

    it("AC3: odrzuca żądanie bez nagłówka x-webhook-secret przy skonfigurowanym sekrecie (401, brak operacji bazodanowych)", async () => {
      process.env.SHIPPING_WEBHOOK_SECRET = "courier-secret-999"

      const { POST } = await import("../src/app/api/webhooks/shipping/route")
      const req = new NextRequest("http://localhost:3000/api/webhooks/shipping", {
        method: "POST",
        body: JSON.stringify({
          tracking_id: "TRACK-12345",
          status: "DELIVERED",
        }),
        headers: {
          "content-type": "application/json",
        },
      })

      const res = await POST(req)
      expect(res.status).toBe(401)
      expect(shippingFindFirstMock).not.toHaveBeenCalled()
    })

    it("AC3: odrzuca żądanie ze złym nagłówkiem x-webhook-secret (401, zero skutków ubocznych)", async () => {
      process.env.SHIPPING_WEBHOOK_SECRET = "courier-secret-999"

      const { POST } = await import("../src/app/api/webhooks/shipping/route")
      const req = new NextRequest("http://localhost:3000/api/webhooks/shipping", {
        method: "POST",
        body: JSON.stringify({
          tracking_id: "TRACK-12345",
          status: "DELIVERED",
        }),
        headers: {
          "content-type": "application/json",
          "x-webhook-secret": "wrong-secret-courier",
        },
      })

      const res = await POST(req)
      expect(res.status).toBe(401)
      expect(shippingFindFirstMock).not.toHaveBeenCalled()
    })
  })

  describe("AC6: Skaner statyczny zapobiegający powrotowi fail-open w Route Handlerach", () => {
    it("żaden Route Handler w api/webhooks nie może zawierać warunku if (secret && ...)", () => {
      const webhooksDir = path.resolve(__dirname, "../src/app/api/webhooks")
      expect(fs.existsSync(webhooksDir)).toBe(true)

      const files: string[] = []
      function walk(dir: string) {
        for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, item.name)
          if (item.isDirectory()) {
            walk(full)
          } else if (item.isFile() && item.name === "route.ts") {
            files.push(full)
          }
        }
      }
      walk(webhooksDir)

      expect(files.length).toBeGreaterThanOrEqual(2)

      const failOpenRegex = /if\s*\(\s*(?:cronSecret|expectedSecret|[a-zA-Z0-9_]*[sS]ecret)\s*&&/

      const offenders: string[] = []
      for (const file of files) {
        const content = fs.readFileSync(file, "utf8")
        if (failOpenRegex.test(content)) {
          const rel = path.relative(path.resolve(__dirname, ".."), file)
          offenders.push(rel)
        }
      }

      expect(
        offenders,
        `Wykryto antywzorzec fail-open w Route Handlerach: ${offenders.join(", ")}`
      ).toEqual([])
    })
  })
})
