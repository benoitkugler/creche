import { expect, test } from "bun:test";
import { Roulement } from "./roulement";
import { isError } from "./shared";

test("read excel roulements", async () => {
  const file = Bun.file("src/logic/sample_roulements.xlsx");
  const roulements = await Roulement.parseExcel(file);
  expect(isError(roulements)).toBeFalse();
  if (isError(roulements)) return;

  expect(roulements).toHaveLength(4);
  expect(roulements[0]).toHaveLength(4);
  expect(roulements[0][0]).toEqual({
    prenom: "R. Ilona",
    color: "#CCFFCC",
    positions: ["s", "o", "o", "f", "s"],
  });
  expect(roulements[3][3]).toEqual({
    prenom: "M. Magali",
    color: "#FFFF99",
    positions: ["s", "o", "o", "o", "s"],
  });
});
