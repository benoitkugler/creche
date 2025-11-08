import { expect, test } from "bun:test";
import { isError } from "./shared";
import { _selectDayHoraires } from "./create";
import { Children, type TextBlock } from "./children";
import { Roulement as Roulements } from "./roulement";
import { normalizeChildren } from "./check";
import { formatHoraireTravail } from "./pros";

async function loadChildren(file: string) {
  const childrenF = Bun.file(file);
  const data: TextBlock[] = await childrenF.json();
  const planningChildren = Children.parsePDFEnfants(data);
  if (isError(planningChildren)) throw "invalid input";
  return planningChildren;
}

async function loadInputs(childrenFile: string, roulementsFile: string) {
  const planningChildren = await loadChildren(childrenFile);

  const roulementsF = Bun.file(roulementsFile);
  const roulements = await Roulements.parseExcel(roulementsF);
  if (isError(roulements)) throw "invalid input";

  return { planningChildren, roulements };
}

test("select horaires", async () => {
  const planningChildren = await loadChildren(
    "src/logic/sample_enfants_redacted_0.json"
  );

  //   const norm1 = normalizeChildren(planningChildren);
  //   const props1 = _selectDayHoraires(norm1[0][3]);
  //   expect(props1).not.toHaveLength(0);
  //   console.log(props1.map((prop) => prop.map(formatHoraireTravail)));

  //   console.log(planningChildren.enfants[4].creneaux[1][0]);
  planningChildren.children[4].creneaux[1][0]!.isAdaptation = true;
  const norm2 = normalizeChildren(planningChildren);
  const props2 = _selectDayHoraires(norm2[1][0]);

  expect(props2).not.toHaveLength(0);
  console.log(props2.map((prop) => prop.map(formatHoraireTravail)));
});

// test("create planning", async () => {
//   const { planningChildren, roulements } = await loadInputs(
//     "src/logic/sample_enfants_redacted_0.json",
//     "src/logic/sample_roulements.xlsx"
//   );
//   const planningPros = createPlanningPros(planningChildren, roulements, 0);
//   console.log(planningPros);

//   expect(isError(planningPros)).toBeFalse();
// });
