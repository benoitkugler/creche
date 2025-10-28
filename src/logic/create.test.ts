import { expect, test } from "bun:test";
import { isError } from "./shared";
import { createPlanningPros } from "./create";
import { Children, type TextBlock } from "./children";
import { Roulement as Roulements } from "./roulement";

async function loadInputs(childrenFile: string, roulementsFile: string) {
  const childrenF = Bun.file(childrenFile);
  const data: TextBlock[] = await childrenF.json();
  const planningChildren = Children.parsePDFEnfants(data);
  if (isError(planningChildren)) throw "invalid input";

  const roulementsF = Bun.file(roulementsFile);
  const roulements = await Roulements.parseExcel(roulementsF);
  if (isError(roulements)) throw "invalid input";

  return { planningChildren, roulements };
}

test("create planning", async () => {
  const { planningChildren, roulements } = await loadInputs(
    "src/logic/sample_enfants_redacted_0.json",
    "src/logic/sample_roulements.xlsx"
  );
  const planningPros = createPlanningPros(planningChildren, roulements, 0);
  expect(isError(planningPros)).toBeFalse();
});
