import { describe, it, expect } from "vitest"
import {
  resolveDayScheduleState,
  externalSummaryLine,
  entryPrimaryLabel,
  entrySecondaryLabel,
  markConflicts,
} from "@/app/admin/master/calendar/calendar-utils"
import type { Appointment } from "@/app/admin/master/calendar/ModernCalendar"

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

const t = (k: string) => `T:${k}`

function appt(over: Partial<Appointment> = {}): Appointment {
  return {
    id: "a1",
    date: "2026-09-22T00:00:00.000Z",
    startTime: "10:00",
    endTime: "11:00",
    status: "CONFIRMED",
    notes: null,
    service: { id: "s", name_pl: "Masaż", name_en: "Massage", name_uk: "Масаж", duration: 60, price: 100 },
    client: { id: "c", name: "Anna", phone: null, email: null },
    master: { id: "m1", name: "M", masterProfile: { color: null } },
    ...over,
  }
}

describe("externalSummaryLine", () => {
  it("picks the first non-empty line, trimmed", () => {
    expect(externalSummaryLine("\n  Telefon 600  \nsecond")).toBe("Telefon 600")
  })
  it("returns null for empty / whitespace-only / nullish", () => {
    expect(externalSummaryLine("  \n \t")).toBeNull()
    expect(externalSummaryLine("")).toBeNull()
    expect(externalSummaryLine(null)).toBeNull()
    expect(externalSummaryLine(undefined)).toBeNull()
  })
  it("truncates over 80 chars with an ellipsis", () => {
    const out = externalSummaryLine("x".repeat(200))!
    expect(out.length).toBe(80)
    expect(out.endsWith("…")).toBe(true)
  })
  it("leaves exactly 80 chars untouched", () => {
    expect(externalSummaryLine("y".repeat(80))).toBe("y".repeat(80))
  })
})

describe("entryPrimaryLabel / entrySecondaryLabel", () => {
  it("site entry: client name (or fallback) and localized service", () => {
    expect(entryPrimaryLabel(appt(), "FB", t)).toBe("Anna")
    expect(entryPrimaryLabel(appt({ client: { id: "c", name: null, phone: null, email: null } }), "FB", t)).toBe("FB")
    expect(entrySecondaryLabel(appt(), "en", t)).toBe("Massage")
    expect(entrySecondaryLabel(appt(), "uk", t)).toBe("Масаж")
  })
  it("external entry: title / first description line", () => {
    const e = appt({ isExternal: true, externalTitle: " Anna masaż ", externalDescription: "Telefon 600\nmore" })
    expect(entryPrimaryLabel(e, "FB", t)).toBe("Anna masaż")
    expect(entrySecondaryLabel(e, "pl", t)).toBe("Telefon 600")
  })
  it("external entry: missing title/description use localized fallbacks", () => {
    const e = appt({ isExternal: true, externalTitle: null, externalDescription: "  " })
    expect(entryPrimaryLabel(e, "FB", t)).toBe("T:admin.calendar.external.titleFallback")
    expect(entrySecondaryLabel(e, "pl", t)).toBe("T:admin.calendar.external.descriptionFallback")
  })
})

describe("markConflicts", () => {
  it("flags both entries of an overlapping pair and leaves others alone", () => {
    const out = markConflicts([
      appt({ id: "a", startTime: "10:00", endTime: "11:00" }),
      appt({ id: "ext:b", isExternal: true, startTime: "10:30", endTime: "11:30" }),
      appt({ id: "c", startTime: "12:00", endTime: "13:00" }),
    ])
    expect(out.map((e) => !!e.hasConflict)).toEqual([true, true, false])
  })
  it("touching entries do not conflict", () => {
    const out = markConflicts([
      appt({ id: "a", startTime: "10:00", endTime: "11:00" }),
      appt({ id: "b", startTime: "11:00", endTime: "12:00" }),
    ])
    expect(out.some((e) => e.hasConflict)).toBe(false)
  })
  it("different days or different masters never conflict", () => {
    const out = markConflicts([
      appt({ id: "a" }),
      appt({ id: "b", date: "2026-09-23T00:00:00.000Z" }),
      appt({ id: "c", master: { id: "m2", name: "N" } }),
    ])
    expect(out.some((e) => e.hasConflict)).toBe(false)
  })
})
