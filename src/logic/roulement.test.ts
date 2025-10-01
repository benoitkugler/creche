import { expect, test } from "bun:test";
import { Roulement } from "./roulement";
import { isError } from "./shared";

test("read excel roulements", async () => {
    const file = Bun.file("src/logic/sample_roulements.xlsx");
    const planning = await Roulement.parseExcel(file);
    expect(isError(planning)).toBeFalse();
    if (isError(planning)) return;

    expect(planning).toHaveLength(4)
    expect(planning[0]).toHaveLength(4)
    expect(planning[0][0]).toEqual({ prenom: "R. Ilona", positions: ["s", "o", "o", "f", "s"] })
})