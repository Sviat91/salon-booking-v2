import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

const rateLimit = vi.fn()
const validateTurnstileForAPI = vi.fn()
const exportConsentData = vi.fn()

vi.mock("../../../../src/lib/logger", () => ({
  getLogger: () => mockLogger,
}))

vi.mock("../../../../src/lib/cache", () => ({
  rateLimit: (...args: unknown[]) => rateLimit(...args),
}))

vi.mock("../../../../src/lib/turnstile", () => ({
  validateTurnstileForAPI: (...args: unknown[]) => validateTurnstileForAPI(...args),
}))

vi.mock("../../../../src/lib/consent-service", () => ({
  exportConsentData: (...args: unknown[]) => exportConsentData(...args),
}))

vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
}))

let postHandler: (req: Request) => Promise<Response>

describe("POST /api/consents/export", () => {
  const payload = {
    name: "Sviatoslav Upirow",
    phone: "+48 501 748 708",
    email: "user@example.com",
    turnstileToken: "dev-token-12345",
  }

  const mockExportData = {
    personalData: {
      name: "Sviatoslav Upirow",
      phone: "48501748708",
      email: "user@example.com",
    },
    consentHistory: [
      {
        consentDate: "2026-03-01T10:00:00.000Z",
        ipHash: "127.0.0.xxx",
        privacyV10: true,
        termsV10: true,
        notificationsV10: false,
      },
    ],
    isAnonymized: false,
    exportTimestamp: "2026-04-02T12:00:00.000Z",
  }

  function createRequest(body: unknown = payload) {
    return {
      headers: new Headers({ "x-forwarded-for": "127.0.0.1" }),
      json: vi.fn().mockResolvedValue(body),
    } as unknown as Request
  }

  beforeAll(async () => {
    ;({ POST: postHandler } = await import("../../../../src/app/api/consents/export/route"))
  })

  beforeEach(() => {
    vi.clearAllMocks()
    rateLimit.mockResolvedValue({ allowed: true, count: 1 })
    validateTurnstileForAPI.mockResolvedValue({ success: true })
    exportConsentData.mockResolvedValue({ exportedData: mockExportData })
  })

  it("returns exported data and 200", async () => {
    const response = await postHandler(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.personalData).toEqual(mockExportData.personalData)
    expect(body.consentHistory).toHaveLength(1)
    expect(exportConsentData).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "+48501748708",
        name: "Sviatoslav Upirow",
        email: "user@example.com",
      })
    )
  })

  it("accepts null turnstile token when widget is disabled", async () => {
    const response = await postHandler(createRequest({ ...payload, turnstileToken: null }))
    expect(response.status).toBe(200)
    expect(exportConsentData).toHaveBeenCalledTimes(1)
  })

  it("normalizes phone variations to E.164 before export", async () => {
    const phoneVariations = ["+48 501 748 708", "48501748708", "0501748708", "+48-501-748-708"]

    for (const phone of phoneVariations) {
      vi.clearAllMocks()
      rateLimit.mockResolvedValue({ allowed: true, count: 1 })
      validateTurnstileForAPI.mockResolvedValue({ success: true })
      exportConsentData.mockResolvedValue({ exportedData: mockExportData })

      const response = await postHandler(createRequest({ ...payload, phone }))
      expect(response.status).toBe(200)
      expect(exportConsentData).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: "+48501748708",
        })
      )
    }
  })

  it("returns 404 when data is not found", async () => {
    exportConsentData.mockResolvedValue({ exportedData: null, reason: "NOT_FOUND" })

    const response = await postHandler(createRequest())
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.code).toBe("DATA_NOT_FOUND")
  })

  it("returns 400 for invalid phone", async () => {
    const response = await postHandler(createRequest({ ...payload, phone: "invalid-phone" }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.code).toBe("INVALID_PHONE")
    expect(exportConsentData).not.toHaveBeenCalled()
  })

  it("returns 429 when rate limit is exceeded", async () => {
    rateLimit.mockResolvedValue({ allowed: false, count: 6 })

    const response = await postHandler(createRequest())
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.code).toBe("RATE_LIMITED")
    expect(exportConsentData).not.toHaveBeenCalled()
  })
})
