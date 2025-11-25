import { expect, test } from "bun:test";
import { tmpdir } from "os";
import { fromJson, isError } from "./shared";
import { parseExcelPros, writeExcelPros } from "./pros";
import type { ProsPlanning } from "./types";

test("parse personnel 0", async () => {
  const file = Bun.file("src/logic/sample_personnel_redacted_0.xlsx");

  const planning = await parseExcelPros(file, new Date(2025, 8, 1));
  expect(isError(planning)).toBeFalse();
  if (isError(planning)) return;

  expect(planning.weeks).toHaveLength(4);
  const s1 = planning.weeks[0];
  const s2 = planning.weeks[1];
  const s3 = planning.weeks[2];
  expect(s1.week).toBe(0);
  expect(s1.roulement).toBe(2);
  expect(s2.week).toBe(1);
  expect(s2.roulement).toBe(3);
  expect(s3.roulement).toBe(0);

  expect(s1.prosHoraires).toHaveLength(5);
  const pro1 = s1.prosHoraires[0];
  expect(pro1.pro.prenom).toBe("Ilona R.");
  expect(pro1.horaires[0].presence).toEqual({
    start: { heure: 11, minute: 0 },
    end: { heure: 20, minute: 0 },
  });
  expect(pro1.horaires[0].pause).toEqual({
    start: { heure: 14, minute: 0 },
    end: { heure: 15, minute: 0 },
  });
  expect(pro1.horaires[1].presence).toEqual({
    start: { heure: 9, minute: 30 },
    end: { heure: 16, minute: 30 },
  });
  expect(pro1.horaires[1].pause).toEqual({
    start: { heure: 13, minute: 0 },
    end: { heure: 13, minute: 45 },
  });
  expect(s2.prosHoraires).toHaveLength(5);

  const pro5 = s1.prosHoraires[4];
  expect(pro5.pro.prenom).toBe("Léanne C.");
  expect(pro5.pro.color).toBe("#CC99FF");

  const pro2 = s2.prosHoraires[1];
  expect(pro2.pro.color).toBe("#B3C6E6");

  // reunions
  expect(s1.reunion).toBeNull();
  expect(s2.reunion).toEqual({ day: 1, horaire: { heure: 13, minute: 30 } });
  expect(s3.reunion).toEqual({ day: 1, horaire: { heure: 13, minute: 30 } });
});

test("parse personnel 1", async () => {
  const file = Bun.file("src/logic/sample_personnel_redacted_1.xlsx");
  const planning = await parseExcelPros(file, new Date(2025, 8, 29));
  expect(isError(planning)).toBeFalse();
  if (isError(planning)) return;
});

test("parse personnel 2", async () => {
  const file = Bun.file("src/logic/sample_personnel_redacted_2.xlsx");
  const planning = await parseExcelPros(file, new Date(2025, 10, 3));
  expect(isError(planning)).toBeFalse();
  if (isError(planning)) return;
  expect(planning.weeks).toHaveLength(2);
});

test("write personnel", async () => {
  for (const { path, date } of [
    {
      path: "src/logic/sample_personnel_redacted_0.xlsx",
      date: new Date(2025, 8, 1),
    },
    {
      path: "src/logic/sample_personnel_redacted_1.xlsx",
      date: new Date(2025, 8, 29),
    },
    {
      path: "src/logic/sample_personnel_redacted_2.xlsx",
      date: new Date(2025, 10, 3),
    },
  ]) {
    const file = Bun.file(path);
    const planning = await parseExcelPros(file, date);
    expect(isError(planning)).toBeFalse();
    if (isError(planning)) return;

    const plCopy = fromJson<ProsPlanning>(JSON.stringify(planning));
    plCopy.weeks.forEach((w) =>
      w.prosHoraires.forEach(
        (pro) =>
          (pro.detachement = {
            dayIndex: 0,
            horaires: {
              start: { heure: 10, minute: 0 },
              end: { heure: 11, minute: 25 },
            },
          })
      )
    );
    const buffer = await writeExcelPros(plCopy, "- 2025");
    const path2 = tmpdir() + `/test_${date.getMonth()}${date.getDay()}.xlsx`;
    await Bun.write(path2, buffer);

    // test roundtrip
    const file2 = Bun.file(path2);
    const planning2 = await parseExcelPros(file2, date);
    expect(isError(planning)).toBeFalse();
    if (isError(planning2)) return;

    expect(planning).toEqual(planning2);
  }
});

// test("log horaires", async () => {
//   const file0 = Bun.file("src/logic/sample_personnel_redacted_0.xlsx");
//   const planning0 = await Pros.parseExcelPros(file0, new Date(2025, 8, 1));
//   const file1 = Bun.file("src/logic/sample_personnel_redacted_1.xlsx");
//   const planning1 = await Pros.parseExcelPros(file1, new Date(2025, 8, 29));
//   if (isError(planning0) || isError(planning1)) return;

//   const lg = (pl: PlanningPros) => {
//     pl.weeks.forEach((week) => {
//       const l: [string, string, string][] = [];
//       week.prosHoraires.forEach((pro) =>
//         pro.horaires.forEach((day) => {
//           l.push([
//             formatHoraire(day.presence.debut),
//             formatHoraire(day.pause.debut),
//             formatHoraire(day.pause.fin),
//           ]);
//         })
//       );
//       l.sort();
//       console.log(l);
//     });
//   };

//   lg(planning0);
//   lg(planning1);
// });
