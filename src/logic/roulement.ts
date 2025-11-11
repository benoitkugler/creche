import {
  arrayEquals,
  isError,
  newError,
  readExcelFile,
  type Cell,
  type error,
  type int,
} from "./shared";
import Excel from "exceljs";
import type { Creneau, Pro, Roulements } from "./types";

function parsePosition(s: Excel.CellValue): Creneau | error {
  if (s == "o" || s == "m" || s == "s" || s == "f") {
    return s;
  }
  return newError("Position dans la journée invalide.");
}

type ProRoulement = {
  prenom: string;
  color: string;
  positions: [Creneau, Creneau, Creneau, Creneau, Creneau];
};
type SemaineRoulement = ProRoulement[];
type RoulementsExcel = SemaineRoulement[];

export async function _parseExcelRoulements(
  file: Blob
): Promise<RoulementsExcel | error> {
  const rows = await readExcelFile(file);

  const out: RoulementsExcel = [];
  let currentWeek: SemaineRoulement = [];
  let inWeek = false;
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (!row.length) continue;

    const firstCell = row[0].value;
    if (
      typeof firstCell == "string" &&
      firstCell.toLocaleLowerCase().includes("equipe")
    ) {
      // week start
      inWeek = true;
      if (currentWeek.length) {
        out.push(currentWeek);
        currentWeek = [];
      }
    } else if (
      firstCell === null ||
      (typeof firstCell == "string" && firstCell == "")
    ) {
      // we are between weeks
      inWeek = false;
    } else if (inWeek) {
      // we are in a week
      const week = parseRoulementRow(row);
      if (isError(week)) return week;
      currentWeek.push(week);
    }
  }

  // flush current week
  if (currentWeek.length) {
    out.push(currentWeek);
    currentWeek = [];
  }

  return out;
}

export async function parseExcelRoulements(
  file: Blob
): Promise<{ pros: Arr4<Pro>; roulements: Roulements } | error> {
  const out = await _parseExcelRoulements(file);
  if (isError(out)) return out;
  return normalizeRoulements(out);
}

function parseRoulementRow(row: Cell[]): ProRoulement | error {
  if (row.length < 7) {
    return newError("Ficher de roulement invalide (ligne trop courte)");
  }
  if (typeof row[0].value != "string") {
    return newError("Ficher de roulement invalide (type invalide)");
  }
  const prenom = row[0].value;

  const p1 = parsePosition(row[2].value);
  if (isError(p1)) return p1;
  const p2 = parsePosition(row[3].value);
  if (isError(p2)) return p2;
  const p3 = parsePosition(row[4].value);
  if (isError(p3)) return p3;
  const p4 = parsePosition(row[5].value);
  if (isError(p4)) return p4;
  const p5 = parsePosition(row[6].value);
  if (isError(p5)) return p5;

  return {
    prenom,
    color: row[0].color,
    positions: [p1, p2, p3, p4, p5] as const,
  };
}

export type Arr4<T> = [T, T, T, T];

// check we follow these simplifying rules :
//  - 4 pros, always in the same order
//  - exactly one Position per pro per day
function normalizeRoulements(
  roulements: RoulementsExcel
): { pros: Arr4<Pro>; roulements: Roulements } | error {
  if (!roulements.length) return newError("Roulements manquants.");

  const pros = prosFromRoulement(roulements[0]);

  const out: Roulements["weeks"] = [];
  for (const prosR of roulements) {
    if (prosR.length != 4) {
      return newError(`Semaine de roulements à ${prosR.length} pro(s).`);
    }

    // check name are consistent
    if (
      !arrayEquals(
        prosFromRoulement(prosR).map((p) => p.prenom),
        pros.map((p) => p.prenom)
      )
    ) {
      return newError("Ordre des pros. inconsistent.");
    }

    const day0 = checkDay(prosR, 0);
    if (isError(day0)) return day0;
    const day1 = checkDay(prosR, 1);
    if (isError(day1)) return day1;
    const day2 = checkDay(prosR, 2);
    if (isError(day2)) return day2;
    const day3 = checkDay(prosR, 3);
    if (isError(day3)) return day3;
    const day4 = checkDay(prosR, 4);
    if (isError(day4)) return day4;

    out.push([day0, day1, day2, day3, day4]);
  }
  return { pros: pros as Arr4<Pro>, roulements: { weeks: out } };
}

function checkDay(
  pros: SemaineRoulement,
  dayI: int
): Roulements["weeks"][0][0] | error {
  const dayPositions = [
    pros[0].positions[dayI],
    pros[1].positions[dayI],
    pros[2].positions[dayI],
    pros[3].positions[dayI],
  ] satisfies Roulements["weeks"][0][0];
  if (new Set(dayPositions).size != 4) {
    return newError(`Roulement invalide (journée ${dayPositions}).`);
  }
  return dayPositions;
}

function prosFromRoulement(pros: SemaineRoulement): Pro[] {
  return pros.map((pro) => ({
    prenom: pro.prenom,
    color: pro.color,
    isInterimaire: false,
  }));
}
