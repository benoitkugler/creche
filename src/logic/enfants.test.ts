import { expect, test } from "bun:test";
import { type TextBlock, Enfants } from "./enfants";
import { isError, Range } from "./shared";

test("parse personnel", async () => {
    const file = Bun.file("src/logic/sample_enfants.json");
    const data: TextBlock[] = await file.json()
    const res = Enfants.parsePDFEnfants(data)
    expect(isError(res)).toBeFalse()
    if (isError(res)) return;

    expect(res.firstMonday.toISOString()).toBe("2025-09-01T00:00:00.000Z")
    expect(res.enfants).toHaveLength(12)
    expect(res.enfants[1].creneaux[2][2]?.horaires).toEqual(new Range({ heure: 6, minute: 30 }, { heure: 19, minute: 0 }))
})