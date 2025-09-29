import Excel from "exceljs";
import {
  isError,
  newError,
  parseHoraire,
  parseRange,
  Range,
  type error,
  type Heure,
  type Horaire,
  type int,
  type SemaineOf,
} from "./shared";

export type Pro = {
  prenom: string;
  color: string; // "#HEX"
};

export type HoraireTravail = {
  presence: Range;
  pause: Range;
};

export type Detachement = { dayIndex: int; horaires: Range };

export type SemainePro = {
  pro: Pro;
  horaires: SemaineOf<HoraireTravail>;
  detachement?: Detachement;
};

export type Reunion = {
  day: int;
  horaire: Horaire; // la durée est toujours d'une heure
};

export type PlanningProsSemaine = {
  week: int; // index (0 based) par rapport au tableau des enfants
  prosHoraires: SemainePro[]; // pour chaque pro
  reunion?: Reunion;
};

export type PlanningPros = {
  firstMonday: Date; // convenience field, copied from enfants
  semaines: PlanningProsSemaine[];
};

export namespace Pros {
  /** returns the maximum semaine + 1 */
  export function semaineCount(input: PlanningPros) {
    return Math.max(...input.semaines.map((e) => e.week)) + 1;
  }

  export async function parseExcelPros(
    file: Blob,
    firstMonday: Date
  ): Promise<PlanningPros | error> {
    // read from a stream
    const workbook = new Excel.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    // ... use workbook
    const sheet = workbook.worksheets[0];
    const rows = sheet.getRows(0, sheet.rowCount + 1) || [];

    const out: PlanningPros = { firstMonday, semaines: [] };
    let currentWeek: PlanningProsSemaine = { week: -1, prosHoraires: [] };

    for (let index = 0; index < rows.length; index++) {
      const row = collectCells(rows[index]);
      if (!row.length) continue;

      // check for Reunion row
      const reunion = isReunionRow(row);
      if (isError(reunion)) return reunion;
      if (reunion != null && currentWeek.week != -1) {
        currentWeek.reunion = reunion;
        continue;
      }

      // detect a week start
      const firstCell = row[0].value;
      if (typeof firstCell != "string") continue;
      if (firstCell.toLowerCase().includes("semaine")) {
        const semaine = parseSemaine(firstCell, firstMonday);
        if (isError(semaine)) return semaine;

        // ignore previous weeks
        if (semaine < 0) {
          continue;
        }

        // flush the current week if any
        if (currentWeek.week != -1) {
          out.semaines.push(currentWeek);
        }
        currentWeek = { week: semaine, prosHoraires: [] }; // start a new week
      } else if (firstCell.trim().length != 0 && currentWeek.week != -1) {
        // this is a pro !
        // fetch the next line
        index += 1;
        if (index >= rows.length)
          return newError("Ligne de pauses manquantes.");
        const res = parseHorairesPros(row, collectCells(rows[index]));
        if (isError(res)) return newError(`Ligne ${index + 1} : ${res.err}`);
        currentWeek.prosHoraires.push(res);
      }
    }

    // flush the last week if any
    if (currentWeek.prosHoraires.length != 0) {
      out.semaines.push(currentWeek);
    }

    return out;
  }

  export function reunionHoraires(debut: Horaire) {
    return new Range(debut, {
      heure: (debut.heure + 1) as Heure,
      minute: debut.minute,
    });
  }
}

function parseSemaine(firstCell: string, firstMonday: Date): int | error {
  const reSemaine =
    /semaine\s*\d+\s*du\s*(\d+)(?:\/\d+)?\s*au\s*(\d+)\/(\d+)\/(\d+)/i;
  const match = reSemaine.exec(firstCell);
  if (match === null)
    return newError("Format de la cellule 'Semaine...' invalide.");
  const firstDay = Number(match[1]);
  const lastDay = Number(match[2]);
  const lastMonth = Number(match[3]) - 1;
  const lastYear = Number(match[4]);
  if (lastYear >= 1000) return newError("Date invalide.");
  const last = new Date(2000 + lastYear, lastMonth, lastDay);
  if (last.getDay() != 5)
    return newError("Dernier jour invalide (vendredi attendu).");
  const first = new Date(last.getTime());
  first.setDate(first.getDate() - 4);
  if (first.getDate() != firstDay) {
    return newError("Premier jour invalide.");
  }
  const semaine =
    (first.getTime() - firstMonday.getTime()) / (1000 * 60 * 60 * 24 * 7);
  return semaine;
}

function parseHorairesPros(
  rowPresences: Excel.Cell[],
  rowPauses: Excel.Cell[]
): SemainePro | error {
  if (rowPresences.length < 15 || rowPauses.length < 15) {
    return newError("Ligne trop courte.");
  }

  const firstCell = rowPresences[0];
  const prenom = (firstCell.value as string).trim();
  const fill = firstCell.style.fill;
  let color = "FFFFFFFF";
  if (fill?.type == "pattern") {
    color = (fill.fgColor?.argb ?? fill.bgColor?.argb) || "FFFFFFFF";
  }
  color = "#" + color.slice(2);
  const pro: Pro = { prenom, color };
  const d1 = parseHorairesDay(
    rowPresences[1],
    rowPresences[2],
    rowPauses[1],
    rowPauses[2]
  );
  if (isError(d1)) return d1;
  const d2 = parseHorairesDay(
    rowPresences[4],
    rowPresences[5],
    rowPauses[4],
    rowPauses[5]
  );
  if (isError(d2)) return d2;
  const d3 = parseHorairesDay(
    rowPresences[7],
    rowPresences[8],
    rowPauses[7],
    rowPauses[8]
  );
  if (isError(d3)) return d3;
  const d4 = parseHorairesDay(
    rowPresences[10],
    rowPresences[11],
    rowPauses[10],
    rowPauses[11]
  );
  if (isError(d4)) return d4;
  const d5 = parseHorairesDay(
    rowPresences[13],
    rowPresences[14],
    rowPauses[13],
    rowPauses[14]
  );
  if (isError(d5)) return d5;

  return {
    pro,
    horaires: [d1, d2, d3, d4, d5],
  };
}

function parseHorairesDay(
  presenceStart: Excel.Cell,
  presenceEnd: Excel.Cell,
  pauseStart: Excel.Cell,
  pauseEnd: Excel.Cell
): HoraireTravail | error {
  const presenceI = parseRangeOrEmpty(presenceStart.value, presenceEnd.value);
  if (isError(presenceI)) return presenceI;
  const pauseI = parseRangeOrEmpty(pauseStart.value, pauseEnd.value);
  if (isError(pauseI)) return pauseI;

  // check inclusion
  if (!presenceI.includes(pauseI)) {
    return newError("Pause non comprise dans les horaires de travail.");
  }
  return { presence: presenceI, pause: pauseI };
}

function parseRangeOrEmpty(
  cellStart: Excel.CellValue,
  cellEnd: Excel.CellValue
): Range | error {
  if (cellStart instanceof Date) {
    cellStart = cellStart.toISOString().slice(11, 16);
  }
  if (cellEnd instanceof Date) {
    cellEnd = cellEnd.toISOString().slice(11, 16);
  }
  if (typeof cellStart != "string" || cellStart.length == 0) {
    return Range.empty();
  }
  return parseRange(`${cellStart} ${cellEnd}`);
}

function collectCells(row: Excel.Row) {
  const out: Excel.Cell[] = [];
  row.eachCell({ includeEmpty: true }, (v) => out.push(v));
  return out;
}

function isReunionRow(row: Excel.Cell[]): Reunion | error | null {
  const reReunion = /R[é|e]union\s?(\d+)[h|:](\d+)/i;
  for (let index = 0; index < row.length; index++) {
    const cell = row[index].value;
    if (typeof cell != "string") continue;

    const match = reReunion.exec(cell);
    if (!match) continue;
    const horaire = parseHoraire(match[1], match[2]);
    if (isError(horaire)) return horaire;

    const day = Math.round((index - 1) / 3);
    return { day, horaire };
  }
  return null;
}
