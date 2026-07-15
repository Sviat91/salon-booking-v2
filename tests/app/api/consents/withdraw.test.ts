import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

const rateLimit = vi.fn()
const cacheSetNX = vi.fn()
const cacheDel = vi.fn()
const validateTurnstileForAPI = vi.fn()
const withdrawConsentRecord = vi.fn()

vi.mock("../../../../src/lib/logger", () => ({
  getLogger: () => mockLogger,
}))

vi.mock("../../../../src/lib/cache", () => ({
  rateLimit: (...args: unknown[]) => rateLimit(...args),
  cacheSetNX: (...args: unknown[]) => cacheSetNX(...args),
  cacheDel: (...args: unknown[]) => cacheDel(...args),
}))

vi.mock("../../../../src/lib/turnstile", () => ({
  validateTurnstileForAPI: (...args: unknown[]) => validateTurnstileForAPI(...args),
}))

vi.mock("../../../../src/lib/consent-service", () => ({
  withdrawConsentRecord: (...args: unknown[]) => withdrawConsentRecord(...args),
}))

vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
}))

let postHandler: (req: Request) => Promise<Response>

describe("POST /api/consents/withdraw", () => {
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
    ;({ POST: postHandler } = await import("../../../../src/app/api/consents/withdraw/route"))
  })

  beforeEach(() => {
    vi.clearAllMocks()
    rateLimit.mockResolvedValue({ allowed: true, count: 1 })
    cacheSetNX.mockResolvedValue(true)
    cacheDel.mockResolvedValue(true)
    validateTurnstileForAPI.mockResolvedValue({ success: true })
    withdrawConsentRecord.mockResolvedValue({
      updated: true,
      withdrawnDate: "2026-04-02T12:00:00.000Z",
    })
  })

  it("withdraws consent successfully and releases idempotency lock", async () => {
    const response = await postHandler(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe("accepted")
    expect(withdrawConsentRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "+48501748708",
        name: "Sviatoslav Upirow",
        email: "user@example.com",
        withdrawalMethod: "support_form",
      })
    )
    expect(cacheDel).toHaveBeenCalledTimes(1)
  })

  it("accepts null turnstile token when widget is disabled", async () => {
    const response = await postHandler(createRequest({ ...payload, turnstileToken: null }))
    expect(response.status).toBe(200)
    expect(withdrawConsentRecord).toHaveBeenCalledTimes(1)
  })

  it("returns 202 when idempotency lock already exists", async () => {
    cacheSetNX.mockResolvedValue(false)

    const response = await postHandler(createRequest())
    const body = await response.json()

    expect(response.status).toBe(202)
    expect(body.code).toBe("ALREADY_PROCESSING")
    expect(withdrawConsentRecord).not.toHaveBeenCalled()
    expect(cacheDel).not.toHaveBeenCalled()
  })

  it("returns 404 when no active consent is found", async () => {
    withdrawConsentRecord.mockResolvedValue({ updated: false, reason: "NOT_FOUND" })

    const response = await postHandler(createRequest())
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.code).toBe("DATA_NOT_FOUND")
  })

  it("returns 400 when phone format is invalid", async () => {
    const response = await postHandler(createRequest({ ...payload, phone: "invalid-phone" }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.code).toBe("INVALID_PHONE")
    expect(withdrawConsentRecord).not.toHaveBeenCalled()
  })

  it("returns 400 when acknowledgement is missing", async () => {
    const response = await postHandler(
      createRequest({
        ...payload,
        consentAcknowledged: false,
      })
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.code).toBe("CONSENT_ACK_REQUIRED")
    expect(withdrawConsentRecord).not.toHaveBeenCalled()
  })
})
