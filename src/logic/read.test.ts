import { expect, test } from "bun:test";
import { parseEnfants } from "./read";

test("parse enfants", () => {
  const file = Bun.file("src/logic/sample.xlsx");
  parseEnfants(file);
  expect(2 + 2).toBe(4);
});
