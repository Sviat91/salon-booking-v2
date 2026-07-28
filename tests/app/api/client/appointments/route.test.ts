import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    appointment: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    service: {
      findUnique: vi.fn(),
    },
    // Discounts (prisma/AGENTS.md: a schema change requires updating mocks) —
    // resnapshotAppointmentPrice() is called whenever the service changes.
    masterProfile: {
      findUnique: vi.fn(),
    },
    masterService: {
      findUnique: vi.fn(),
    },
    discountRedemption: {
      deleteMany: vi.fn(),
    },
  },
}))

vi.mock("@/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}))

vi.mock("@/lib/prisma", () => ({
  default: mockPrisma,
}))

import {
  PATCH,
  DELETE,
} from "../../../../../src/app/api/client/appointments/[id]/route"

function createPatchRequest(body: unknown) {
  return {
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Request
}

describe("Client appointments route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: "u_client", role: "CLIENT" },
    })
    mockPrisma.masterProfile.findUnique.mockResolvedValue(null)
    mockPrisma.masterService.findUnique.mockResolvedValue(null)
    mockPrisma.discountRedemption.deleteMany.mockResolvedValue({ count: 0 })
  })

  it("PATCH updates procedure/time for accessible appointment", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ phone: "+48501748708" })
    mockPrisma.user.findMany.mockResolvedValue([{ id: "u_client" }])

    mockPrisma.appointment.findUnique.mockResolvedValue({
      id: "appt_1",
      clientId: "u_client",
      masterId: "m_1",
      status: "CONFIRMED",
      date: new Date("2099-01-20T00:00:00.000Z"),
      startTime: "12:00",
      service: { name_pl: "Old service" },
    })

    mockPrisma.appointment.findFirst.mockResolvedValue(null)
    mockPrisma.service.findUnique.mockResolvedValue({
      id: "srv_new",
      name_pl: "New service",
    })
    mockPrisma.appointment.update.mockResolvedValue({ id: "appt_1" })

    const response = await PATCH(
      createPatchRequest({
        newProcedureId: "srv_new",
        newStartISO: "2099-01-21T10:00:00.000Z",
        newEndISO: "2099-01-21T11:00:00.000Z",
      }) as any,
      { params: Promise.resolve({ id: "appt_1" }) }
    )

    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockPrisma.appointment.update).toHaveBeenCalledTimes(1)
  })

  it("PATCH rejects appointment that does not belong to current user group", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ phone: null })
    mockPrisma.appointment.findUnique.mockResolvedValue({
      id: "appt_2",
      clientId: "other_user",
      masterId: "m_1",
      status: "CONFIRMED",
      date: new Date("2099-01-20T00:00:00.000Z"),
      startTime: "12:00",
      service: { name_pl: "Service" },
    })

    const response = await PATCH(
      createPatchRequest({ newProcedureId: "srv_new" }) as any,
      { params: Promise.resolve({ id: "appt_2" }) }
    )

    expect(response.status).toBe(403)
    expect(mockPrisma.appointment.update).not.toHaveBeenCalled()
  })

  it("DELETE blocks cancellation when less than 24h remains", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ phone: null })

    const nearFuture = new Date(Date.now() + 2 * 60 * 60 * 1000)
    const warsawTime = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Warsaw",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    }).format(nearFuture)

    mockPrisma.appointment.findUnique.mockResolvedValue({
      id: "appt_3",
      clientId: "u_client",
      status: "CONFIRMED",
      date: nearFuture,
      startTime: warsawTime,
    })

    const response = await DELETE(
      {} as any,
      { params: Promise.resolve({ id: "appt_3" }) }
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.code).toBe("TOO_LATE_TO_MODIFY")
    expect(mockPrisma.appointment.update).not.toHaveBeenCalled()
  })
})
