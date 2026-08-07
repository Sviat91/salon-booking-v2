import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockPrisma, mockHash, mockGetRequestIp, mockSaveConsentRecord, mockRateLimit } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    appointment: {
      updateMany: vi.fn(),
    },
    consentRecord: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  },
  mockHash: vi.fn(),
  mockGetRequestIp: vi.fn(),
  mockSaveConsentRecord: vi.fn(),
  mockRateLimit: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  default: mockPrisma,
}))

vi.mock("bcryptjs", () => ({
  default: { hash: (...args: unknown[]) => mockHash(...args) },
}))

vi.mock("@/lib/consent-service", () => ({
  getRequestIp: (...args: unknown[]) => mockGetRequestIp(...args),
  saveConsentRecord: (...args: unknown[]) => mockSaveConsentRecord(...args),
}))

vi.mock("@/lib/cache", () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}))

import { POST } from "../../../../src/app/api/auth/register/route"

function createRequest(body: unknown) {
  return {
    json: vi.fn().mockResolvedValue(body),
    headers: new Headers({ "x-forwarded-for": "127.0.0.1" }),
  } as unknown as Request
}

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetRequestIp.mockReturnValue("127.0.0.1")
    mockRateLimit.mockResolvedValue({ allowed: true, count: 1 })
    mockHash.mockResolvedValue("hashed_password")
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma))
    mockPrisma.user.findFirst.mockResolvedValue(null)
    mockPrisma.user.findMany.mockResolvedValue([])
    mockPrisma.$queryRaw.mockResolvedValue([])
    mockPrisma.user.create.mockResolvedValue({
      id: "u_1",
      name: "Sviatoslav",
      email: "user@example.com",
      role: "CLIENT",
    })
    mockSaveConsentRecord.mockResolvedValue(undefined)
  })

  it("registers user, stores consent, and returns 201", async () => {
    const response = await POST(
      createRequest({
        name: "Sviatoslav",
        email: "user@example.com",
        password: "123456",
        phone: "+48501748708",
        consents: {
          dataProcessing: true,
          terms: true,
          notifications: false,
        },
      }) as any
    )
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.id).toBe("u_1")
    expect(mockPrisma.user.create).toHaveBeenCalledTimes(1)
    expect(mockSaveConsentRecord).toHaveBeenCalledTimes(1)
  })

  it("returns 400 when required consents are not accepted", async () => {
    const response = await POST(
      createRequest({
        name: "Sviatoslav",
        email: "user@example.com",
        password: "123456",
        phone: "+48501748708",
        consents: {
          dataProcessing: false,
          terms: true,
          notifications: false,
        },
      }) as any
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
    expect(mockPrisma.user.create).not.toHaveBeenCalled()
  })

  it("returns 400 for duplicate registered email", async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ id: "existing_1" }])

    const response = await POST(
      createRequest({
        name: "Sviatoslav",
        email: "user@example.com",
        password: "123456",
        phone: "+48501748708",
        consents: {
          dataProcessing: true,
          terms: true,
          notifications: false,
        },
      }) as any
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain("already exists")
    expect(mockPrisma.user.create).not.toHaveBeenCalled()
  })
})
