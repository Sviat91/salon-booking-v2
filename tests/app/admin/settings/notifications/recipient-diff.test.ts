import { describe, it, expect } from "vitest"
import { diffRecipients } from "@/app/admin/settings/notifications/recipient-diff"
import type { RecipientRow } from "@/app/admin/settings/notifications/recipient-schema"

describe("diffRecipients", () => {
  it("returns empty buckets for an empty baseline and the single blank placeholder row", () => {
    const current: RecipientRow[] = [{ dbId: null, chatId: "", label: "" }]

    const result = diffRecipients([], current)

    expect(result.toCreate).toEqual([])
    expect(result.toUpdate).toEqual([])
    expect(result.toDeleteIds).toEqual([])
  })

  it("puts a filled new row (empty baseline) into toCreate only", () => {
    const current: RecipientRow[] = [{ dbId: null, chatId: "12345", label: "Owner" }]

    const result = diffRecipients([], current)

    expect(result.toCreate).toEqual(current)
    expect(result.toUpdate).toEqual([])
    expect(result.toDeleteIds).toEqual([])
  })

  it("puts a saved row with an edited chatId into toUpdate only", () => {
    const baseline = [{ dbId: "r1", chatId: "111", label: "A" }]
    const current: RecipientRow[] = [{ dbId: "r1", chatId: "222", label: "A" }]

    const result = diffRecipients(baseline, current)

    expect(result.toCreate).toEqual([])
    expect(result.toUpdate).toEqual(current)
    expect(result.toDeleteIds).toEqual([])
  })

  it("puts a saved row with only the label edited into toUpdate", () => {
    const baseline = [{ dbId: "r1", chatId: "111", label: "A" }]
    const current: RecipientRow[] = [{ dbId: "r1", chatId: "111", label: "B" }]

    const result = diffRecipients(baseline, current)

    expect(result.toCreate).toEqual([])
    expect(result.toUpdate).toEqual(current)
    expect(result.toDeleteIds).toEqual([])
  })

  it("returns empty buckets for an untouched saved row (no redundant PATCH)", () => {
    const baseline = [{ dbId: "r1", chatId: "111", label: "A" }]
    const current: RecipientRow[] = [{ dbId: "r1", chatId: "111", label: "A" }]

    const result = diffRecipients(baseline, current)

    expect(result.toCreate).toEqual([])
    expect(result.toUpdate).toEqual([])
    expect(result.toDeleteIds).toEqual([])
  })

  it("deletes a saved row whose chatId was blanked out, and does not also update it", () => {
    const baseline = [{ dbId: "r1", chatId: "111", label: "A" }]
    const current: RecipientRow[] = [{ dbId: "r1", chatId: "", label: "A" }]

    const result = diffRecipients(baseline, current)

    expect(result.toDeleteIds).toEqual(["r1"])
    expect(result.toUpdate).toEqual([])
    expect(result.toCreate).toEqual([])
  })

  it("deletes a saved row dropped from the array entirely", () => {
    const baseline = [{ dbId: "r1", chatId: "111", label: "A" }]
    const current: RecipientRow[] = []

    const result = diffRecipients(baseline, current)

    expect(result.toDeleteIds).toEqual(["r1"])
    expect(result.toCreate).toEqual([])
    expect(result.toUpdate).toEqual([])
  })

  it("does not create a new row whose chatId is whitespace-only", () => {
    const current: RecipientRow[] = [{ dbId: null, chatId: "   ", label: "" }]

    const result = diffRecipients([], current)

    expect(result.toCreate).toEqual([])
    expect(result.toUpdate).toEqual([])
    expect(result.toDeleteIds).toEqual([])
  })

  it("handles a mixed batch: one kept, one deleted, one created, one blank trailing row ignored", () => {
    const baseline = [
      { dbId: "r1", chatId: "111", label: "A" },
      { dbId: "r2", chatId: "222", label: "B" },
    ]
    const current: RecipientRow[] = [
      { dbId: "r1", chatId: "111", label: "A" },
      { dbId: null, chatId: "333", label: "C" },
      { dbId: null, chatId: "", label: "" },
    ]

    const result = diffRecipients(baseline, current)

    expect(result.toCreate).toEqual([{ dbId: null, chatId: "333", label: "C" }])
    expect(result.toUpdate).toEqual([])
    expect(result.toDeleteIds).toEqual(["r2"])
  })
})
