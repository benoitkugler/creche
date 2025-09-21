import type { CellValue, Row } from "read-excel-file";
import {
  isError,
  newError,
  parseRange,
  Range,
  type error,
  type int,
  type SemaineOf
} from "./shared";

export type Pro = {
  prenom: string;
};

export type HoraireTravail = {
  presence: Range;
  pause: Range;
};

type SemainePro = {
  pro: Pro;
  horaires: SemaineOf<HoraireTravail>;
};

type PlanningProsSemaine = {
  semaine: int; // index (0 based) par rapport au tableau des enfants
  prosHoraires: SemainePro[]; // pour chaque pro
};

export type PlanningPros = {
  firstMonday: Date; // convenience field, copied from enfants
  semaines: PlanningProsSemaine[];
};

export namespace Pros {
  /** returns the maximum semaine + 1 */
  export function semaineCount(input: PlanningPros) {
    return Math.max(...input.semaines.map(e => e.semaine)) + 1;
  }

  /** You should use `readXlsxFile` to produce rows */
  export function parseExcelPros(
    rows: Row[],
    firstMonday: Date
  ): PlanningPros | error {
    const out: PlanningPros = { firstMonday, semaines: [] };
    let currentWeek: PlanningProsSemaine = { semaine: -1, prosHoraires: [] };

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      if (!row.length) continue;

      // detect a week start
      const firstCell = row[0];
      if (typeof firstCell != "string") continue;
      if (firstCell.toLowerCase().includes("semaine")) {
        const semaine = parseSemaine(firstCell, firstMonday);
        if (isError(semaine)) return semaine;

        // flush the current week if any
        if (currentWeek.semaine != -1) {
          out.semaines.push(currentWeek);
        }
        currentWeek = { semaine, prosHoraires: [] }; // start a new week
      } else if (firstCell.trim().length != 0 && currentWeek.semaine != -1) {
        // this is a pro !
        // fetch the next line
        index += 1;
        if (index >= rows.length)
          return newError("Ligne de pauses manquantes.");
        const res = parseHorairesPros(row, rows[index]);
        if (isError(res)) return res;
        currentWeek.prosHoraires.push(res);
      }
    }

    // flush the last week if any
    if (currentWeek.prosHoraires.length != 0) {
      out.semaines.push(currentWeek);
    }

    return out;
  }
}

function parseSemaine(firstCell: string, firstMonday: Date): int | error {
  const reSemaine =
    /semaine\s*\d+\s*du\s*(\d+)\/(\d+)\s*au\s*(\d+)\/(\d+)\/(\d+)/i;
  const match = reSemaine.exec(firstCell);
  if (match === null)
    return newError("Format de la cellule 'Semaine...' invalide.");
  const firstDay = Number(match[1]);
  const firstMonth = Number(match[2]) - 1;
  const lastDay = Number(match[3]);
  const lastMonth = Number(match[4]) - 1;
  const lastYear = Number(match[5]);
  if (lastYear >= 1000) return newError("Date invalide.");
  const last = new Date(2000 + lastYear, lastMonth, lastDay);
  if (last.getDay() != 5)
    return newError("Dernier jour invalide (vendredi attendu).");
  const first = new Date(last.getTime());
  first.setDate(first.getDate() - 4);
  if (first.getDate() != firstDay || first.getMonth() != firstMonth) {
    return newError("Premier jour invalide.");
  }
  const semaine =
    (first.getTime() - firstMonday.getTime()) / (1000 * 60 * 60 * 24 * 7);
  if (semaine < 0) {
    return newError("Semaine antérieure au début du planning enfants.");
  }
  return semaine;
}

function parseHorairesPros(row: Row, pauses: Row): SemainePro | error {
  if (row.length < 10 || pauses.length < 10) {
    return newError("Ligne trop courte.");
  }
  const pro: Pro = { prenom: (row[0] as string).trim() };
  const d1 = parseHorairesDay(row[1], pauses[1]);
  if (isError(d1)) return d1;
  const d2 = parseHorairesDay(row[3], pauses[3]);
  if (isError(d2)) return d2;
  const d3 = parseHorairesDay(row[5], pauses[5]);
  if (isError(d3)) return d3;
  const d4 = parseHorairesDay(row[7], pauses[7]);
  if (isError(d4)) return d4;
  const d5 = parseHorairesDay(row[9], pauses[9]);
  if (isError(d5)) return d5;

  return { pro, horaires: [d1, d2, d3, d4, d5] };
}

function parseHorairesDay(
  presence: CellValue,
  pause: CellValue
): HoraireTravail | error {
  const presenceI = parseRangeOrEmpty(presence);
  if (isError(presenceI)) return presenceI;
  const pauseI = parseRangeOrEmpty(pause);
  if (isError(pauseI)) return pauseI;

  // check inclusion
  if (!presenceI.includes(pauseI))
    return newError("Pause non comprise dans les horaires de travail.");
  return { presence: presenceI, pause: pauseI };
}

function parseRangeOrEmpty(cell: CellValue): Range | error {
  if (typeof cell != "string" || cell.length == 0) {
    return Range.empty();
  }
  return parseRange(cell)
}
