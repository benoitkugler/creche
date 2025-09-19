import { expect, test } from "bun:test";
import { Pros } from "./personnel";
import readXlsxFile from "read-excel-file/web-worker";
import { isError, Range } from "./shared";

test("parse personnel", async () => {
  const file = Bun.file("src/logic/sample_personnel.xlsx");
  const rows = await readXlsxFile(file);
  const planning = Pros.parseExcelPros(rows, new Date(2025, 7, 18));
  expect(isError(planning)).toBeFalse();
  if (isError(planning)) return;

  expect(planning.semaines).toHaveLength(2);
  const s1 = planning.semaines[0];
  const s2 = planning.semaines[1];
  expect(s1.semaine).toBe(1);
  expect(s2.semaine).toBe(19);
  expect(s1.prosHoraires).toHaveLength(4);
  const pro1 = s1.prosHoraires[0];
  expect(pro1.pro.prenom).toBe("Ilona R");
  expect(pro1.horaires[0].presence).toEqual(
    new Range({ heure: 9, minute: 0 }, { heure: 17, minute: 0 })
  );
  expect(pro1.horaires[0].pause).toEqual(
    new Range({ heure: 13, minute: 0 }, { heure: 14, minute: 0 })
  );
  expect(pro1.horaires[1].presence).toEqual(
    new Range({ heure: 9, minute: 0 }, { heure: 17, minute: 0 })
  );
  expect(pro1.horaires[1].pause).toEqual(
    new Range({ heure: 13, minute: 45 }, { heure: 14, minute: 0 })
  );
});
