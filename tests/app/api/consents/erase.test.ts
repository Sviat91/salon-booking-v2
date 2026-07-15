import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

const rateLimit = vi.fn()
const validateTurnstileForAPI = vi.fn()
const eraseConsentData = vi.fn()

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
  eraseConsentData: (...args: unknown[]) => eraseConsentData(...args),
}))

vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
}))

let postHandler: (req: Request) => Promise<Response>

describe("POST /api/consents/erase", () => {
  const payload = {
    name: "Sviatoslav Upirow",
    phone: "+48 501 748 708",
    email: "user@example.com",
    consentAcknowledged: true,
    turnstileToken: "dev-token-12345",
  }

  function createRequest(body: unknown = payload) {
    return {
      headers: new Headers({ "x-forwarded-for": "127.0.0.1" }),
      json: vi.fn().mockResolvedValue(body),
    } as unknown as Request
  }

  beforeAll(async () => {
    ;({ POST: postHandler } = await import("../../../../src/app/api/consents/erase/route"))
  })

  beforeEach(() => {
    vi.clearAllMocks()
    rateLimit.mockResolvedValue({ allowed: true, count: 1 })
    validateTurnstileForAPI.mockResolvedValue({ success: true })
    eraseConsentData.mockResolvedValue({
      erased: true,
      erasedAt: "2026-04-02T12:00:00.000Z",
      erasedRecordsCount: 2,
      anonymizedUsersCount: 1,
    })
  })

  it("erases data successfully and returns details", async () => {
    const response = await postHandler(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe("erased")
    expect(body.details).toBeDefined()
    expect(eraseConsentData).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "+48501748708",
        name: "Sviatoslav Upirow",
        email: "user@example.com",
        erasureMethod: "support_form",
      })
    )
  })

  it("accepts null turnstile token when widget is disabled", async () => {
    const response = await postHandler(createRequest({ ...payload, turnstileToken: null }))
    expect(response.status).toBe(200)
    expect(eraseConsentData).toHaveBeenCalledTimes(1)
  })

  it("returns 409 when data is already erased", async () => {
    eraseConsentData.mockResolvedValue({
      erased: false,
      alreadyErased: true,
    })

    const response = await postHandler(createRequest())
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe("ALREADY_ERASED")
  })

  it("returns 404 when no data is found", async () => {
    eraseConsentData.mockResolvedValue({
      erased: false,
      reason: "NOT_FOUND",
    })

    const response = await postHandler(createRequest())
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.code).toBe("DATA_NOT_FOUND")
  })

  it("returns 400 when acknowledgement is missing", async () => {
    const response = await postHandler(createRequest({ ...payload, consentAcknowledged: false }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.code).toBe("CONSENT_ACK_REQUIRED")
    expect(eraseConsentData).not.toHaveBeenCalled()
  })
})
