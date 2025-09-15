import { expect, test } from "bun:test";
import { parseEnfants } from "./read";

test("2 + 2", () => {
  const file = Bun.file("src/logic/sample.xlsx");
  parseEnfants(file);
  expect(2 + 2).toBe(4);
});
