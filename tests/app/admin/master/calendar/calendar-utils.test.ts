import { describe, it, expect } from "vitest"
import { resolveDayScheduleState } from "@/app/admin/master/calendar/calendar-utils"

describe("resolveDayScheduleState", () => {
  it("returns 'working' for a matching working override", () => {
    const result = resolveDayScheduleState(
      "2026-08-10",
      1,
      [{ date: "2026-08-10", isDayOff: false }],
      []
    )
    expect(result).toBe("working")
  })

  it("returns 'dayoff' for a matching day-off override", () => {
    const result = resolveDayScheduleState(
      "2026-08-10",
      1,
      [{ date: "2026-08-10", isDayOff: true }],
      []
    )
    expect(result).toBe("dayoff")
  })

  it("prefers the override over a contradicting template for the same weekday (working override beats day-off template)", () => {
    const result = resolveDayScheduleState(
      "2026-08-10",
      1,
      [{ date: "2026-08-10", isDayOff: false }],
      [{ dayOfWeek: 1, isDayOff: true }]
    )
    expect(result).toBe("working")
  })

  it("prefers the override over a contradicting template for the same weekday (day-off override beats working template)", () => {
    const result = resolveDayScheduleState(
      "2026-08-10",
      1,
      [{ date: "2026-08-10", isDayOff: true }],
      [{ dayOfWeek: 1, isDayOff: false }]
    )
    expect(result).toBe("dayoff")
  })

  it("returns 'working' from a matching working template when there is no override", () => {
    const result = resolveDayScheduleState(
      "2026-08-10",
      1,
      [],
      [{ dayOfWeek: 1, isDayOff: false }]
    )
    expect(result).toBe("working")
  })

  it("returns 'dayoff' from a matching day-off template when there is no override", () => {
    const result = resolveDayScheduleState(
      "2026-08-10",
      1,
      [],
      [{ dayOfWeek: 1, isDayOff: true }]
    )
    expect(result).toBe("dayoff")
  })

  it("returns null when neither an override nor a template matches", () => {
    const result = resolveDayScheduleState("2026-08-10", 1, [], [])
    expect(result).toBeNull()
  })

  it("ignores an override for a different date", () => {
    const result = resolveDayScheduleState(
      "2026-08-10",
      1,
      [{ date: "2026-08-11", isDayOff: true }],
      [{ dayOfWeek: 1, isDayOff: false }]
    )
    expect(result).toBe("working")
  })
})
