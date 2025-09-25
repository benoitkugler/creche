import { expect, test } from "bun:test";
import { Pros } from "./personnel";
import { isError, Range } from "./shared";

test("parse personnel", async () => {
  const file = Bun.file("src/logic/sample_personnel.xlsx");

  const planning = await Pros.parseExcelPros(file, new Date(2025, 8, 1));
  expect(isError(planning)).toBeFalse();
  if (isError(planning)) return;

  expect(planning.semaines).toHaveLength(4);
  const s1 = planning.semaines[0];
  const s2 = planning.semaines[1];
  expect(s1.week).toBe(0);
  expect(s2.week).toBe(1);
  expect(s1.prosHoraires).toHaveLength(5);
  const pro1 = s1.prosHoraires[0];
  expect(pro1.pro.prenom).toBe("Ilona R.");
  expect(pro1.horaires[0].presence).toEqual(
    new Range({ heure: 11, minute: 0 }, { heure: 20, minute: 0 })
  );
  expect(pro1.horaires[0].pause).toEqual(
    new Range({ heure: 14, minute: 0 }, { heure: 15, minute: 0 })
  );
  expect(pro1.horaires[1].presence).toEqual(
    new Range({ heure: 9, minute: 30 }, { heure: 16, minute: 30 })
  );
  expect(pro1.horaires[1].pause).toEqual(
    new Range({ heure: 13, minute: 0 }, { heure: 13, minute: 45 })
  );
  expect(s2.prosHoraires).toHaveLength(4); // empty Pro name : ignored
  const pro5 = s1.prosHoraires[4];
  expect(pro5.pro.prenom).toBe("Léanne C.");
  expect(pro5.pro.color).toBe("#CC99FF");
});
