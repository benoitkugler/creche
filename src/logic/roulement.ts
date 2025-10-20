import {
  backgroundColor,
  isError,
  newError,
  readExcelFile,
  type error,
  type SemaineOf,
} from "./shared";
import Excel from "exceljs";

export type PositionR = "o" | "m" | "s" | "f";

function parsePosition(s: Excel.CellValue): PositionR | error {
  if (s == "o" || s == "m" || s == "s" || s == "f") {
    return s;
  }
  return newError("Position dans la journée invalide.");
}

export type ProRoulement = {
  prenom: string;
  color: string;
  positions: SemaineOf<PositionR>;
};

export type SemaineRoulement = ProRoulement[];
export type Roulements = SemaineRoulement[];

export namespace Roulement {
  export async function parseExcel(file: Blob): Promise<Roulements | error> {
    const rows = await readExcelFile(file);

    const out: Roulements = [];
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

  function parseRoulementRow(row: Excel.Cell[]): ProRoulement | error {
    if (row.length < 7) {
      return newError("Ficher de roulement invalide (ligne trop courte)");
    }
    if (typeof row[0].value != "string") {
      return newError("Ficher de roulement invalide (type invalide)");
    }
    const prenom = row[0].value;
    const color = backgroundColor(row[0]);

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

    return { prenom, color, positions: [p1, p2, p3, p4, p5] as const };
  }
}
